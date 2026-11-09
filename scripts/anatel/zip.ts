// Reads one member out of a remote zip without downloading the archive: the
// central directory sits at the end of the file, and each member can be
// fetched by byte range. Handles zip64, which Anatel's archive needs (two of
// its members are over 4 GB).
import { crc32, inflateRawSync } from 'node:zlib';

/** Random access to the archive's bytes; `end` is exclusive. */
export interface RangeReader {
  size: number;
  read(start: number, end: number): Promise<Uint8Array>;
}

export interface ZipEntry {
  name: string;
  method: number;
  flags: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;
const EOCD_SIZE = 22;
const MAX_COMMENT = 0xffff;
const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

export class ZipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipError';
  }
}

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

function u64(dv: DataView, at: number): number {
  const value = dv.getBigUint64(at, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new ZipError('64-bit value too large');
  return Number(value);
}

/** How many bytes from the end hold the end-of-central-directory records. */
export const TAIL_SIZE = EOCD_SIZE + MAX_COMMENT + 20 + 56;

interface Directory {
  offset: number;
  size: number;
  entries: number;
}

/** Finds the central directory from the archive's last bytes. */
export function locateDirectory(tail: Uint8Array, tailStart: number): Directory {
  const dv = view(tail);
  let eocd = -1;
  for (let i = tail.length - EOCD_SIZE; i >= 0; i--) {
    if (dv.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('end of central directory not found; not a zip file?');

  let entries = dv.getUint16(eocd + 10, true);
  let size = dv.getUint32(eocd + 12, true);
  let offset = dv.getUint32(eocd + 16, true);

  const locator = eocd - 20;
  if (locator >= 0 && dv.getUint32(locator, true) === SIG_ZIP64_LOCATOR) {
    const z64 = u64(dv, locator + 8) - tailStart;
    if (z64 < 0 || dv.getUint32(z64, true) !== SIG_ZIP64_EOCD) throw new ZipError('zip64 record not found');
    entries = u64(dv, z64 + 32);
    size = u64(dv, z64 + 40);
    offset = u64(dv, z64 + 48);
  } else if (entries === U16_MAX || size === U32_MAX || offset === U32_MAX) {
    throw new ZipError('zip64 values without a zip64 record');
  }
  return { offset, size, entries };
}

/** Parses the central directory's file headers. */
export function parseDirectory(dir: Uint8Array, entries: number): ZipEntry[] {
  const dv = view(dir);
  const decoder = new TextDecoder();
  const result: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < entries; n++) {
    if (p + 46 > dir.length || dv.getUint32(p, true) !== SIG_CENTRAL) {
      throw new ZipError(`bad central directory entry ${n}`);
    }
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    let compressedSize = dv.getUint32(p + 20, true);
    let uncompressedSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    let localHeaderOffset = dv.getUint32(p + 42, true);
    const name = decoder.decode(dir.subarray(p + 46, p + 46 + nameLen));

    // The zip64 extra field holds, in order, only the values that overflowed.
    let x = p + 46 + nameLen;
    const extraEnd = x + extraLen;
    while (x + 4 <= extraEnd) {
      const id = dv.getUint16(x, true);
      const len = dv.getUint16(x + 2, true);
      if (id === 0x0001) {
        let q = x + 4;
        if (uncompressedSize === U32_MAX) {
          uncompressedSize = u64(dv, q);
          q += 8;
        }
        if (compressedSize === U32_MAX) {
          compressedSize = u64(dv, q);
          q += 8;
        }
        if (localHeaderOffset === U32_MAX) localHeaderOffset = u64(dv, q);
      }
      x += 4 + len;
    }

    result.push({ name, method, flags, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset });
    p = extraEnd + commentLen;
  }
  return result;
}

export async function listEntries(reader: RangeReader): Promise<ZipEntry[]> {
  const tailStart = Math.max(0, reader.size - TAIL_SIZE);
  const tail = await reader.read(tailStart, reader.size);
  const dir = locateDirectory(tail, tailStart);
  const dirBytes =
    dir.offset >= tailStart
      ? tail.subarray(dir.offset - tailStart, dir.offset - tailStart + dir.size)
      : await reader.read(dir.offset, dir.offset + dir.size);
  return parseDirectory(dirBytes, dir.entries);
}

/** Downloads and decompresses one member, checking its size and CRC32. */
export async function readEntry(reader: RangeReader, entry: ZipEntry): Promise<Buffer> {
  if (entry.flags & 0x1) throw new ZipError(`${entry.name} is encrypted`);
  const header = await reader.read(entry.localHeaderOffset, entry.localHeaderOffset + 30);
  const dv = view(header);
  if (dv.getUint32(0, true) !== SIG_LOCAL) throw new ZipError(`bad local header for ${entry.name}`);
  // The local extra field can differ from the central one, so read its length here.
  const dataStart = entry.localHeaderOffset + 30 + dv.getUint16(26, true) + dv.getUint16(28, true);
  const raw = await reader.read(dataStart, dataStart + entry.compressedSize);

  let data: Buffer;
  if (entry.method === 0) data = Buffer.from(raw);
  else if (entry.method === 8) data = inflateRawSync(raw);
  else throw new ZipError(`${entry.name} uses unsupported compression method ${entry.method}`);

  if (data.length !== entry.uncompressedSize) {
    throw new ZipError(`${entry.name}: expected ${entry.uncompressedSize} bytes, got ${data.length}`);
  }
  if (crc32(data) >>> 0 !== entry.crc32) throw new ZipError(`${entry.name}: CRC32 mismatch`);
  return data;
}

/** A reader over bytes already in memory. */
export function bufferReader(bytes: Uint8Array): RangeReader {
  return {
    size: bytes.length,
    read: async (start, end) => {
      if (start < 0 || end > bytes.length || start > end) throw new ZipError(`range ${start}-${end} out of bounds`);
      return bytes.subarray(start, end);
    },
  };
}
