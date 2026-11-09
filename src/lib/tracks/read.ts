// Reads a trail from a dropped file, whatever its format. Only GPX for now;
// KML, KMZ, GeoJSON or TCX are one more entry in READERS.
import { hasWaypoints, isGpx, parseGpx } from './gpx.ts';
import type { Track } from './track.ts';

/** A problem worth telling the person, in Portuguese. */
export class TrackError extends Error {}

interface Reader {
  /** Format name for messages. */
  name: string;
  /** File names people give this format. */
  extension: RegExp;
  /** Whether the content is this format, whatever the file is called. */
  sniff: (content: string) => boolean;
  /** The trail, or undefined when the file has none. */
  parse: (content: string) => Track | undefined;
  /** Whether the file has loose points, to say so when it has no trail. */
  hasPoints?: (content: string) => boolean;
}

const READERS: readonly Reader[] = [{ name: 'GPX', extension: /\.gpx$/i, sniff: isGpx, parse: parseGpx, hasPoints: hasWaypoints }];

/** Larger than any reasonable hike log (a day at one point per second is about 10 MB). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

export const SUPPORTED = READERS.map((r) => r.name).join(', ');

export function readTrack(fileName: string, content: string): Track {
  const reader = READERS.find((r) => r.sniff(content));
  if (!reader) {
    const named = READERS.find((r) => r.extension.test(fileName));
    throw new TrackError(
      named
        ? `O arquivo tem nome de ${named.name}, mas o conteúdo não parece ${named.name}: pode estar corrompido.`
        : `Este arquivo não é uma trilha que eu saiba ler (por enquanto: ${SUPPORTED}).`,
    );
  }
  const track = reader.parse(content);
  if (track) return track;
  throw new TrackError(
    reader.hasPoints?.(content)
      ? `O arquivo ${reader.name} só tem pontos soltos, sem trilha nem rota.`
      : `O arquivo ${reader.name} não tem nenhuma trilha ou rota.`,
  );
}
