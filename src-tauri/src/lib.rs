use tauri::Manager;
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![is_portable])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
