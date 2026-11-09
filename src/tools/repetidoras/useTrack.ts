// The trail dropped on the map (a hidden feature for now), kept in the link
// after "#" so it can be shared and survives a reload.
import { useEffect, useState } from 'preact/hooks';
import { readTrackHash, shareableTrack, writeTrackHash } from '../../lib/tracks/link.ts';
import { MAX_FILE_BYTES, TrackError, readTrack } from '../../lib/tracks/read.ts';
import { simplifyTrack } from '../../lib/tracks/simplify.ts';
import { trackLengthKm, type Track } from '../../lib/tracks/track.ts';

export interface LoadedTrack {
  /** Drawn on the map: close to the file (5 m). */
  shown: Track;
  /** In the link, and what the repeaters are measured against, so a shared link gives the same list. */
  shared: Track;
  lengthKm: number;
}

function load(track: Track): LoadedTrack {
  return { shown: simplifyTrack(track, 0.005), shared: shareableTrack(track), lengthKm: trackLengthKm(track) };
}

export function useTrack() {
  const [track, setTrack] = useState<LoadedTrack | undefined>(() => {
    const t = typeof location === 'undefined' ? undefined : readTrackHash(location.hash);
    return t && load(t);
  });

  useEffect(() => {
    const hash = track ? writeTrackHash(track.shared) : '';
    if (hash !== location.hash) history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  }, [track]);

  /** Reads a dropped file; throws a TrackError with a message for the person. */
  const loadFile = async (file: File): Promise<LoadedTrack> => {
    if (file.size > MAX_FILE_BYTES) throw new TrackError('Arquivo grande demais para uma trilha (mais de 50 MB).');
    const loaded = load(readTrack(file.name, await file.text()));
    setTrack(loaded);
    return loaded;
  };

  return { track, loadFile, clearTrack: () => setTrack(undefined) };
}
