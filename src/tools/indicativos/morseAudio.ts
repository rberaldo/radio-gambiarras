// Plays Morse code with the Web Audio API.
import { useEffect, useRef, useState } from 'preact/hooks';
import { dotSeconds, morseTimeline } from '../../lib/callsigns/index.ts';

const TONE_HZ = 700;
const RAMP = 0.005; // short fades avoid clicks

export function useMorsePlayer() {
  const ctx = useRef<AudioContext | undefined>(undefined);
  const stopAt = useRef<(() => void) | undefined>(undefined);
  const [playing, setPlaying] = useState(false);

  const stop = () => {
    stopAt.current?.();
    stopAt.current = undefined;
    setPlaying(false);
  };

  const play = (callsign: string, wpm: number) => {
    stop();
    ctx.current ??= new AudioContext();
    const ac = ctx.current;
    void ac.resume();

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = TONE_HZ;
    gain.gain.value = 0;
    osc.connect(gain).connect(ac.destination);

    const dot = dotSeconds(wpm);
    let t = ac.currentTime + 0.05;
    for (const el of morseTimeline(callsign)) {
      const len = Math.abs(el) * dot;
      if (el > 0) {
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + RAMP);
        gain.gain.setValueAtTime(0.3, t + len - RAMP);
        gain.gain.linearRampToValueAtTime(0, t + len);
      }
      t += len;
    }
    osc.start();
    osc.stop(t + 0.05);
    setPlaying(true);
    const timer = setTimeout(() => setPlaying(false), (t - ac.currentTime) * 1000 + 100);
    stopAt.current = () => {
      clearTimeout(timer);
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    };
  };

  useEffect(() => () => stopAt.current?.(), []);
  return { play, stop, playing };
}
