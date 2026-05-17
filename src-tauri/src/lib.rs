use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_window_state::StateFlags;

#[tauri::command]
fn is_portable() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|p| {
            p.file_name()
                .map(|n| n.to_string_lossy().to_lowercase().contains("portable"))
        })
        .unwrap_or(false)
}

/// Buffer for files passed via argv on cold start.
///
/// We can't just emit a Tauri event during `setup` — the webview may not have
/// registered its listener yet. Instead we stash the paths here and let the
/// frontend drain them once via `take_startup_files()` after it mounts.
struct StartupFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_startup_files(state: tauri::State<'_, StartupFiles>) -> Vec<String> {
    let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
    std::mem::take(&mut *guard)
}

/// Extract real file paths from process argv.
///
/// Skips the program name (index 0) and anything starting with `-` (flags such
/// as `--no-default-features`, Tauri-injected switches, etc). Filters down to
/// entries that actually exist on disk so we don't accidentally open garbage.
fn extract_file_paths(argv: &[String]) -> Vec<String> {
    argv.iter()
        .skip(1)
        .filter(|a| !a.starts_with('-'))
        .filter_map(|a| {
            let p = std::path::Path::new(a);
            if p.is_file() {
                // Prefer absolute path so the frontend can de-dup against
                // already-open tabs regardless of how the OS launched us.
                Some(
                    std::fs::canonicalize(p)
                        .ok()
                        .and_then(|c| c.to_str().map(|s| s.to_string()))
                        // canonicalize on Windows yields `\\?\C:\...` extended
                        // paths which break some downstream consumers. Strip
                        // the prefix when present.
                        .map(|s| s.strip_prefix(r"\\?\").map(|t| t.to_string()).unwrap_or(s))
                        .unwrap_or_else(|| a.clone()),
                )
            } else {
                None
            }
        })
        .collect()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_files = extract_file_paths(&std::env::args().collect::<Vec<_>>());

    let mut builder = tauri::Builder::default();

    // Single-instance MUST be the first plugin registered (per upstream docs).
    // Without this, "Open With <WSText>" launches a brand-new process every
    // time instead of reusing the running window.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let paths = extract_file_paths(&argv);

            // Bring the existing main window forward so the user actually sees
            // the file they just opened.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            if paths.is_empty() {
                return;
            }

            // Push paths to the frontend. If the webview happens to not be
            // ready yet (extremely unlikely for a second instance — the first
            // one has been running long enough to register listeners), also
            // append to the startup buffer as a safety net.
            let _ = app.emit("wstext:open-files", &paths);
            if let Some(state) = app.try_state::<StartupFiles>() {
                let mut guard = state.0.lock().unwrap_or_else(|e| e.into_inner());
                guard.extend(paths);
            }
        }));
    }

    builder
        .manage(StartupFiles(Mutex::new(startup_files)))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::all() & !StateFlags::DECORATIONS)
                .build(),
        )
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let _ = window.set_decorations(false);
            let _ = window.set_shadow(false);
            window.show().unwrap();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![is_portable, take_startup_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
