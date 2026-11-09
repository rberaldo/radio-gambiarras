// Reading coordinates people type: "-22.9497, -43.2851", "-22,9497 -43,2851"
// (Brazilian decimal comma), or degrees with hemispheres such as
// "22.9497 S 43.2851 W" / "22°56'59\"S 43°17'06\"W".

export interface LatLon {
  lat: number;
  lon: number;
}

/** "22°56'59\"S" style or plain decimal with optional hemisphere letter. */
function parseOne(text: string, positive: string, negative: string): number | undefined {
  const t = text.trim().toUpperCase().replace(/,/g, '.');
  const hemisphere = t.match(/[NSEWLO]$/)?.[0];
  const body = hemisphere ? t.slice(0, -1).trim() : t;
  const dms = /^(-?\d+(?:\.\d+)?)\s*°\s*(?:(\d+(?:\.\d+)?)\s*['′]\s*)?(?:(\d+(?:\.\d+)?)\s*["″]\s*)?$/.exec(body);
  let value: number;
  if (dms) value = Math.abs(Number(dms[1])) + Number(dms[2] ?? 0) / 60 + Number(dms[3] ?? 0) / 3600;
  else if (/^-?\d+(\.\d+)?$/.test(body)) value = Math.abs(Number(body));
  else return undefined;
  const sign = body.startsWith('-') || (hemisphere && negative.includes(hemisphere)) ? -1 : 1;
  if (hemisphere && !positive.includes(hemisphere) && !negative.includes(hemisphere)) return undefined;
  return sign * value;
}

/** Latitude and longitude from free text, or undefined if it does not look like coordinates. */
export function parseCoordinates(raw: string): LatLon | undefined {
  const text = raw.trim();
  if (!text) return undefined;
  let parts: string[];
  // Decimal commas make "," ambiguous: split on ";" or whitespace first, then on ", ".
  if (text.includes(';')) parts = text.split(';');
  else if (/,\s/.test(text)) parts = text.split(/,\s+/);
  else parts = text.split(/\s+(?=[-+\d])/);
  if (parts.length !== 2) return undefined;
  const lat = parseOne(parts[0]!, 'N', 'S');
  const lon = parseOne(parts[1]!, 'EL', 'WO');
  if (lat === undefined || lon === undefined || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { lat, lon };
}
