// Link to the GitHub form for a repeater the map does not have, with the
// chosen point (if any) filled in.
import type { ComponentChildren } from 'preact';
import { correctionUrl, missingRepeater } from '../../lib/repeaters/correction.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import { site } from '../../site.ts';

export function MissingRepeaterLink({ picked, children }: { picked?: Point; children: ComponentChildren }) {
  return (
    <a href={correctionUrl(missingRepeater(site.repo, location.href, picked))} target="_blank" rel="noopener">
      {children}
    </a>
  );
}
