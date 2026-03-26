/** Maximum number of bytes to scan for binary detection. */
const SCAN_LIMIT = 8192;

/**
 * Detect if a file is binary by checking for null bytes in the first 8KB.
 * Empty files are considered text (not binary).
 *
 * @param bytes - Raw file bytes from readFile()
 * @returns true if the file appears to be binary
 */
export function isBinaryFile(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const limit = Math.min(bytes.length, SCAN_LIMIT);
  for (let i = 0; i < limit; i++) {
    if (bytes[i] === 0x00) return true;
  }
  return false;
}
