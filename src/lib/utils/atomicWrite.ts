import { writeTextFile, writeFile, rename, remove } from '@tauri-apps/plugin-fs';
import { BaseDirectory } from '@tauri-apps/plugin-fs';

/**
 * Atomically write a text file using temp-file-then-rename pattern.
 * Prevents data corruption if the app crashes during write.
 */
export async function atomicWriteText(
  path: string,
  content: string,
  baseDir?: BaseDirectory
): Promise<void> {
  const tmpPath = `${path}.tmp_${Date.now()}`;
  try {
    if (baseDir !== undefined) {
      await writeTextFile(tmpPath, content, { baseDir });
      await rename(tmpPath, path, { oldPathBaseDir: baseDir, newPathBaseDir: baseDir });
    } else {
      await writeTextFile(tmpPath, content);
      await rename(tmpPath, path);
    }
  } catch (err) {
    // Clean up temp file on failure
    try {
      if (baseDir !== undefined) {
        await remove(tmpPath, { baseDir });
      } else {
        await remove(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Atomically write binary data using temp-file-then-rename pattern.
 */
export async function atomicWriteBytes(
  path: string,
  data: Uint8Array,
  baseDir?: BaseDirectory
): Promise<void> {
  const tmpPath = `${path}.tmp_${Date.now()}`;
  try {
    if (baseDir !== undefined) {
      await writeFile(tmpPath, data, { baseDir });
      await rename(tmpPath, path, { oldPathBaseDir: baseDir, newPathBaseDir: baseDir });
    } else {
      await writeFile(tmpPath, data);
      await rename(tmpPath, path);
    }
  } catch (err) {
    try {
      if (baseDir !== undefined) {
        await remove(tmpPath, { baseDir });
      } else {
        await remove(tmpPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}
