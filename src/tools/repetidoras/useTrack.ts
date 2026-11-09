// The trail opened with the button or dropped on the map, kept in the link
// after "#" so it can be shared and survives a reload.
import { useEffect, useRef, useState } from 'preact/hooks';
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

/** The trail in the address, if any; `broken` when the link has one that cannot be read (cut off when pasted). */
function fromHash(): { track?: LoadedTrack; broken: boolean } {
  if (typeof location === 'undefined') return { broken: false };
  const t = readTrackHash(location.hash);
  return t ? { track: load(t), broken: false } : { broken: /[#&]trilha=/.test(location.hash) };
}

export const BROKEN_LINK = 'O link desta trilha está incompleto (talvez cortado ao copiar). Peça o link de novo ou solte o arquivo GPX no mapa.';

export function useTrack() {
  const [initial] = useState(fromHash);
  const [track, setTrack] = useState<LoadedTrack | undefined>(initial.track);
  const [brokenLink, setBrokenLink] = useState(initial.broken);
  // Each drop takes a turn; a slow file read that finishes after a newer drop is ignored.
  const turn = useRef(0);

  useEffect(() => {
    const hash = track ? writeTrackHash(track.shared) : '';
    if (hash !== location.hash) history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`);
  }, [track]);

  // Another trail link pasted into the address bar only changes the "#": no reload, so read it here.
  useEffect(() => {
    const onHash = () => {
      turn.current++;
      const { track, broken } = fromHash();
      setTrack(track);
      setBrokenLink(broken);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  /** Reads a dropped file; throws a TrackError with a message for the person. Undefined if a newer drop won. */
  const loadFile = async (file: File): Promise<LoadedTrack | undefined> => {
    const mine = ++turn.current;
    setBrokenLink(false);
    if (file.size > MAX_FILE_BYTES) throw new TrackError(`Arquivo grande demais para uma trilha (mais de ${MAX_FILE_BYTES / 1024 / 1024} MB).`);
    const loaded = load(readTrack(file.name, await file.text()));
    if (mine !== turn.current) return undefined;
    setTrack(loaded);
    return loaded;
  };

  const clearTrack = () => {
    turn.current++;
    setTrack(undefined);
    setBrokenLink(false);
  };

  return { track, brokenLink, loadFile, clearTrack };
}
