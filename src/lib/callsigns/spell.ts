// How a callsign sounds: ICAO phonetic alphabet (as used in Brazil, with
// digits in Portuguese) and Morse code with its length in dot units.

const PHONETIC: Record<string, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
  '0': 'Zero',
  '1': 'Um',
  '2': 'Dois',
  '3': 'Três',
  '4': 'Quatro',
  '5': 'Cinco',
  '6': 'Seis',
  '7': 'Sete',
  '8': 'Oito',
  '9': 'Nove',
};

const MORSE: Record<string, string> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
};

export function phonetic(callsign: string): string[] {
  return [...callsign].map((ch) => PHONETIC[ch] ?? ch);
}

/** Morse code of each character. */
export function morse(callsign: string): string[] {
  return [...callsign].map((ch) => MORSE[ch] ?? '');
}

/**
 * Length in dot units, with standard timing: dot 1, dash 3, gap inside a
 * character 1, gap between characters 3. Shorter callsigns are quicker to
 * send, which matters in contests and pile-ups.
 */
export function morseUnits(callsign: string): number {
  const chars = morse(callsign).filter(Boolean);
  let units = 0;
  chars.forEach((code, i) => {
    for (const sym of code) units += sym === '.' ? 1 : 3;
    units += code.length - 1;
    if (i < chars.length - 1) units += 3;
  });
  return units;
}

/** Elements to play, in dot units: positive is a tone, negative is silence. */
export function morseTimeline(callsign: string): number[] {
  const out: number[] = [];
  morse(callsign)
    .filter(Boolean)
    .forEach((code, i) => {
      if (i > 0) out.push(-3);
      [...code].forEach((sym, j) => {
        if (j > 0) out.push(-1);
        out.push(sym === '.' ? 1 : 3);
      });
    });
  return out;
}

/** Duration of one dot at a speed in words per minute (PARIS standard). */
export const dotSeconds = (wpm: number) => 1.2 / wpm;
