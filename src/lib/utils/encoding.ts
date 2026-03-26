import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import type { Encoding } from '../types';

export interface EncodingDetectionResult {
  encoding: Encoding;
  hasBOM: boolean;
  /** Number of BOM bytes at the start (to skip when decoding). */
  bomLength: number;
}

/**
 * Detect file encoding from raw bytes by checking BOM markers.
 *
 * Detection order (IMPORTANT — must check 2-byte BOMs before 3-byte):
 * 1. UTF-16 LE: FF FE
 * 2. UTF-16 BE: FE FF
 * 3. UTF-8 BOM: EF BB BF
 * 4. Default: UTF-8 (no BOM)
 */
export function detectEncoding(bytes: Uint8Array): EncodingDetectionResult {
  if (bytes.length >= 2) {
    // UTF-16 LE BOM: FF FE
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
      return { encoding: 'utf-16le', hasBOM: true, bomLength: 2 };
    }
    // UTF-16 BE BOM: FE FF
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
      return { encoding: 'utf-16be', hasBOM: true, bomLength: 2 };
    }
  }
  if (bytes.length >= 3) {
    // UTF-8 BOM: EF BB BF
    if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
      return { encoding: 'utf-8', hasBOM: true, bomLength: 3 };
    }
  }
  return { encoding: 'utf-8', hasBOM: false, bomLength: 0 };
}

/**
 * Decode file bytes to string using detected encoding.
 */
export function decodeContent(bytes: Uint8Array, encoding: Encoding, bomLength: number): string {
  const payload = bomLength > 0 ? bytes.slice(bomLength) : bytes;
  const decoderLabel =
    encoding === 'utf-16le' ? 'utf-16le' :
    encoding === 'utf-16be' ? 'utf-16be' :
    'utf-8';
  const decoder = new TextDecoder(decoderLabel);
  return decoder.decode(payload);
}

/**
 * Encode string to bytes, adding BOM if required.
 */
export function encodeContent(content: string, encoding: Encoding, hasBOM: boolean): Uint8Array {
  if (encoding === 'utf-16le') {
    const encoded = encodeUTF16LE(content);
    if (hasBOM) {
      const withBOM = new Uint8Array(encoded.length + 2);
      withBOM[0] = 0xFF; withBOM[1] = 0xFE;
      withBOM.set(encoded, 2);
      return withBOM;
    }
    return encoded;
  }

  if (encoding === 'utf-16be') {
    const encoded = encodeUTF16BE(content);
    if (hasBOM) {
      const withBOM = new Uint8Array(encoded.length + 2);
      withBOM[0] = 0xFE; withBOM[1] = 0xFF;
      withBOM.set(encoded, 2);
      return withBOM;
    }
    return encoded;
  }

  // UTF-8 (default)
  const encoder = new TextEncoder();
  const encoded = encoder.encode(content);
  if (hasBOM) {
    const withBOM = new Uint8Array(encoded.length + 3);
    withBOM[0] = 0xEF; withBOM[1] = 0xBB; withBOM[2] = 0xBF;
    withBOM.set(encoded, 3);
    return withBOM;
  }
  return encoded;
}

function encodeUTF16LE(str: string): Uint8Array {
  const buf = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2] = code & 0xFF;
    buf[i * 2 + 1] = (code >> 8) & 0xFF;
  }
  return buf;
}

function encodeUTF16BE(str: string): Uint8Array {
  const buf = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2] = (code >> 8) & 0xFF;
    buf[i * 2 + 1] = code & 0xFF;
  }
  return buf;
}

/**
 * Read a file from disk with full encoding detection.
 * ALWAYS uses readFile() (binary) — never readTextFile() which is UTF-8 only.
 */
export async function readFileWithEncoding(path: string): Promise<{
  content: string;
  encoding: Encoding;
  hasBOM: boolean;
  bytes: Uint8Array;
}> {
  const bytes = await readFile(path);
  const { encoding, hasBOM, bomLength } = detectEncoding(bytes);
  const content = decodeContent(bytes, encoding, bomLength);
  return { content, encoding, hasBOM, bytes };
}

/**
 * Write a file to disk preserving original encoding and BOM.
 * ALWAYS uses writeFile() (binary) to handle all encodings.
 */
export async function writeFileWithEncoding(
  path: string,
  content: string,
  encoding: Encoding,
  hasBOM: boolean
): Promise<void> {
  const data = encodeContent(content, encoding, hasBOM);
  await writeFile(path, data);
}
