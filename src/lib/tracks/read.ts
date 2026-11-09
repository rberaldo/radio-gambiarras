// Reads a trail from a dropped file, whatever its format. Only GPX for now;
// KML, KMZ, GeoJSON or TCX are one more entry in READERS.
import { looksLikeGpx, parseGpx } from './gpx.ts';
import type { Track } from './track.ts';

/** A problem worth telling the person, in Portuguese. */
export class TrackError extends Error {}

interface Reader {
  /** Format name for messages. */
  name: string;
  matches: (fileName: string, content: string) => boolean;
  parse: (content: string) => Track | undefined;
}

const READERS: readonly Reader[] = [{ name: 'GPX', matches: looksLikeGpx, parse: parseGpx }];

/** Larger than any reasonable hike log (a day at one point per second is about 10 MB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const SUPPORTED = READERS.map((r) => r.name).join(', ');

export function readTrack(fileName: string, content: string): Track {
  const reader = READERS.find((r) => r.matches(fileName, content));
  if (!reader) throw new TrackError(`Este arquivo não é uma trilha que eu saiba ler (por enquanto: ${SUPPORTED}).`);
  const track = reader.parse(content);
  if (!track) throw new TrackError(`O arquivo ${reader.name} não tem nenhuma trilha ou rota, só pontos soltos.`);
  return track;
}
