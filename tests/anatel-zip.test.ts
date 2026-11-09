import { crc32, deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { fetchMember } from '../scripts/anatel/fetch.ts';
import { bufferReader, listEntries, readEntry, ZipError } from '../scripts/anatel/zip.ts';

interface FileSpec {
  name: string;
  content: string;
  method?: 0 | 8;
}

/**
 * Builds a zip in memory. With `zip64`, sizes and offsets are written as
 * 0xFFFFFFFF with a zip64 extra field and zip64 end records, the way large
 * archives store them.
 */
function buildZip(files: FileSpec[], { zip64 = false, comment = '' } = {}): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const raw = enc.encode(f.content);
    const method = f.method ?? 8;
    const data = method === 8 ? deflateRawSync(raw) : raw;
    const name = enc.encode(f.name);
    const crc = crc32(raw) >>> 0;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, method, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, name.length, true);
    // A local extra field that differs from the central one, as real zips do.
    const localExtra = new Uint8Array([0xfe, 0xca, 2, 0, 0, 0]);
    local.setUint16(28, localExtra.length, true);
    chunks.push(new Uint8Array(local.buffer), name, localExtra, data);

    const extra = new DataView(new ArrayBuffer(zip64 ? 28 : 0));
    if (zip64) {
      extra.setUint16(0, 0x0001, true);
      extra.setUint16(2, 24, true);
      extra.setBigUint64(4, BigInt(raw.length), true);
      extra.setBigUint64(12, BigInt(data.length), true);
      extra.setBigUint64(20, BigInt(offset), true);
    }
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(10, method, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, zip64 ? 0xffffffff : data.length, true);
    cd.setUint32(24, zip64 ? 0xffffffff : raw.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint16(30, extra.byteLength, true);
    cd.setUint32(42, zip64 ? 0xffffffff : offset, true);
    central.push(new Uint8Array(cd.buffer), name, new Uint8Array(extra.buffer));

    offset += 30 + name.length + localExtra.length + data.length;
  }

  const cdOffset = offset;
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  chunks.push(...central);

  if (zip64) {
    const z = new DataView(new ArrayBuffer(56));
    z.setUint32(0, 0x06064b50, true);
    z.setBigUint64(4, 44n, true);
    z.setBigUint64(24, BigInt(files.length), true);
    z.setBigUint64(32, BigInt(files.length), true);
    z.setBigUint64(40, BigInt(cdSize), true);
    z.setBigUint64(48, BigInt(cdOffset), true);
    const loc = new DataView(new ArrayBuffer(20));
    loc.setUint32(0, 0x07064b50, true);
    loc.setBigUint64(8, BigInt(cdOffset + cdSize), true);
    loc.setUint32(16, 1, true);
    chunks.push(new Uint8Array(z.buffer), new Uint8Array(loc.buffer));
  }

  const commentBytes = enc.encode(comment);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, zip64 ? 0xffff : files.length, true);
  eocd.setUint16(10, zip64 ? 0xffff : files.length, true);
  eocd.setUint32(12, zip64 ? 0xffffffff : cdSize, true);
  eocd.setUint32(16, zip64 ? 0xffffffff : cdOffset, true);
  eocd.setUint16(20, commentBytes.length, true);
  chunks.push(new Uint8Array(eocd.buffer), commentBytes);

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

const CSV = '﻿Indicativo;COER\r\nPY2AA;Classe A\r\nPU2KAA;Classe C\r\n';
const FILES: FileSpec[] = [
  { name: 'Estacoes_SLP.csv', content: 'x'.repeat(5000) },
  { name: 'Estacoes_Radioamador.csv', content: CSV },
  { name: 'stored.txt', content: 'plain', method: 0 },
];

describe('zip reader', () => {
  it.each([
    ['plain', false],
    ['zip64', true],
  ])('lists entries and extracts members (%s)', async (_label, zip64) => {
    const reader = bufferReader(buildZip(FILES, { zip64, comment: 'Anatel' }));
    const entries = await listEntries(reader);
    expect(entries.map((e) => e.name)).toEqual(FILES.map((f) => f.name));
    const ham = entries.find((e) => e.name === 'Estacoes_Radioamador.csv')!;
    expect((await readEntry(reader, ham)).toString('utf8')).toBe(CSV);
    const stored = entries.find((e) => e.name === 'stored.txt')!;
    expect((await readEntry(reader, stored)).toString('utf8')).toBe('plain');
  });

  it('detects corrupted data', async () => {
    const zip = buildZip(FILES);
    const reader = bufferReader(zip);
    const entry = (await listEntries(reader)).find((e) => e.method === 0)!;
    const at = entry.localHeaderOffset + 30 + entry.name.length + 6;
    zip[at] = zip[at]! ^ 0xff;
    await expect(readEntry(reader, entry)).rejects.toThrow(/CRC32/);
  });

  it('rejects files that are not zips', async () => {
    await expect(listEntries(bufferReader(new TextEncoder().encode('<html>blocked</html>')))).rejects.toThrow(ZipError);
  });
});

/** A fake fetch serving a zip, honoring Range and If-Range like a real server. */
function fakeServer(zip: Uint8Array, { ranges = true, etag = '"v1"' } = {}) {
  const calls: string[] = [];
  const impl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const range = headers.get('range');
    calls.push(range ?? 'full');
    const ifRange = headers.get('if-range');
    if (!ranges || !range || (ifRange && ifRange !== etag)) {
      return new Response(zip.slice(), { status: 200, headers: { etag } });
    }
    let start: number;
    let end: number;
    const suffix = /^bytes=-(\d+)$/.exec(range);
    if (suffix) {
      start = Math.max(0, zip.length - Number(suffix[1]));
      end = zip.length - 1;
    } else {
      const m = /^bytes=(\d+)-(\d+)$/.exec(range)!;
      start = Number(m[1]);
      end = Number(m[2]);
    }
    return new Response(zip.slice(start, end + 1), {
      status: 206,
      headers: { etag, 'content-range': `bytes ${start}-${end}/${zip.length}` },
    });
  }) as typeof fetch;
  return { impl, calls };
}

describe('fetchMember', () => {
  it('uses range requests and fetches only what it needs', async () => {
    const zip = buildZip(FILES, { zip64: true });
    const server = fakeServer(zip);
    const result = await fetchMember('https://example.test/a.zip', 'Estacoes_Radioamador.csv', server.impl);
    expect(result.data.toString('utf8')).toBe(CSV);
    expect(result.usedRanges).toBe(true);
    expect(server.calls.every((c) => c !== 'full')).toBe(true);
  });

  it('falls back to a full download when ranges are ignored', async () => {
    const server = fakeServer(buildZip(FILES), { ranges: false });
    const result = await fetchMember('https://example.test/a.zip', 'Estacoes_Radioamador.csv', server.impl);
    expect(result.data.toString('utf8')).toBe(CSV);
    expect(result.usedRanges).toBe(false);
  });

  it('names the members when the one we need is missing', async () => {
    const server = fakeServer(buildZip(FILES.filter((f) => !f.name.includes('Radioamador'))));
    await expect(fetchMember('https://example.test/a.zip', 'Estacoes_Radioamador.csv', server.impl)).rejects.toThrow(
      /not found.*Estacoes_SLP\.csv/,
    );
  });
});
