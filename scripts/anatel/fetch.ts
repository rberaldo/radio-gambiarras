// Downloads Anatel's amateur-station CSV with HTTP range requests: about
// 64 KB for the zip's directory and 3.2 MB for the one member we need,
// instead of the whole 225 MB archive. Falls back to a full download when
// the server ignores ranges.
//
// CLI: node scripts/anatel/fetch.ts [out-file]
// Writes the CSV (default scripts/anatel/raw/Estacoes_Radioamador.csv, which
// is gitignored: it contains personal data) and prints a summary.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { bufferReader, listEntries, readEntry, TAIL_SIZE, ZipError, type RangeReader, type ZipEntry } from './zip.ts';

export const ANATEL_ZIP_URL =
  'https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_licenciadas.zip';
export const AMATEUR_MEMBER = 'Estacoes_Radioamador.csv';
export const DEFAULT_OUT = 'scripts/anatel/raw/Estacoes_Radioamador.csv';

const USER_AGENT = 'radio-gambiarras/1.0 (+https://github.com/rberaldo/radio-gambiarras)';

export interface FetchResult {
  data: Buffer;
  entry: ZipEntry;
  etag?: string;
  lastModified?: string;
  archiveSize: number;
  bytesDownloaded: number;
  usedRanges: boolean;
}

/** Thrown when the server answers a range request with the whole file. */
class RangesUnsupported extends Error {}

interface HttpReader extends RangeReader {
  etag?: string;
  lastModified?: string;
  bytesDownloaded: number;
}

async function rangeReader(url: string, fetchImpl: typeof fetch): Promise<HttpReader> {
  // A suffix range both returns the tail and tells us the total size.
  const res = await fetchImpl(url, { headers: { Range: `bytes=-${TAIL_SIZE}`, 'User-Agent': USER_AGENT } });
  if (res.status === 200) {
    await res.body?.cancel();
    throw new RangesUnsupported();
  }
  if (res.status !== 206) throw new Error(`GET ${url}: HTTP ${res.status}`);
  const total = Number(/\/(\d+)$/.exec(res.headers.get('content-range') ?? '')?.[1]);
  if (!Number.isFinite(total) || total <= 0) throw new Error('missing or invalid Content-Range');

  const tail = new Uint8Array(await res.arrayBuffer());
  const tailStart = total - tail.length;
  const etag = res.headers.get('etag') ?? undefined;

  const reader: HttpReader = {
    size: total,
    etag,
    lastModified: res.headers.get('last-modified') ?? undefined,
    bytesDownloaded: tail.length,
    async read(start, end) {
      if (start >= tailStart) return tail.subarray(start - tailStart, end - tailStart);
      const headers: Record<string, string> = { Range: `bytes=${start}-${end - 1}`, 'User-Agent': USER_AGENT };
      // If the archive changed between requests, get a 200 instead of mixing versions.
      if (etag) headers['If-Range'] = etag;
      const r = await fetchImpl(url, { headers });
      if (r.status === 200) {
        await r.body?.cancel();
        throw new Error('archive changed during download; run again');
      }
      if (r.status !== 206) throw new Error(`GET ${url} range ${start}-${end - 1}: HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.length !== end - start) throw new Error(`short range read: ${bytes.length} of ${end - start} bytes`);
      reader.bytesDownloaded += bytes.length;
      return bytes;
    },
  };
  return reader;
}

async function fullReader(url: string, fetchImpl: typeof fetch): Promise<HttpReader> {
  const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT } });
  if (res.status !== 200) throw new Error(`GET ${url}: HTTP ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return {
    ...bufferReader(bytes),
    etag: res.headers.get('etag') ?? undefined,
    lastModified: res.headers.get('last-modified') ?? undefined,
    bytesDownloaded: bytes.length,
  };
}

export async function fetchMember(
  url = ANATEL_ZIP_URL,
  member = AMATEUR_MEMBER,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchResult> {
  let reader: HttpReader;
  let usedRanges = true;
  try {
    reader = await rangeReader(url, fetchImpl);
  } catch (err) {
    if (!(err instanceof RangesUnsupported)) throw err;
    console.warn('Server ignored the range request; downloading the whole archive.');
    reader = await fullReader(url, fetchImpl);
    usedRanges = false;
  }

  const entries = await listEntries(reader);
  const entry = entries.find((e) => e.name === member);
  if (!entry) {
    const names = entries.map((e) => e.name).join(', ');
    throw new ZipError(`member ${member} not found; the archive has: ${names}`);
  }
  const data = await readEntry(reader, entry);
  return {
    data,
    entry,
    etag: reader.etag,
    lastModified: reader.lastModified,
    archiveSize: reader.size,
    bytesDownloaded: reader.bytesDownloaded,
    usedRanges,
  };
}

if (import.meta.main) {
  const out = process.argv[2] ?? DEFAULT_OUT;
  const started = Date.now();
  const result = await fetchMember();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, result.data);
  const rows = result.data.toString('utf8').split(/\r?\n/).filter(Boolean).length - 1;
  console.log(
    [
      `member:      ${result.entry.name}`,
      `size:        ${result.entry.uncompressedSize} bytes (${result.entry.compressedSize} compressed)`,
      `rows:        ${rows}`,
      `archive:     ${result.archiveSize} bytes, Last-Modified ${result.lastModified ?? '?'}`,
      `downloaded:  ${result.bytesDownloaded} bytes ${result.usedRanges ? 'with range requests' : '(full archive)'}`,
      `time:        ${((Date.now() - started) / 1000).toFixed(1)} s`,
      `written to:  ${out}`,
    ].join('\n'),
  );
}
