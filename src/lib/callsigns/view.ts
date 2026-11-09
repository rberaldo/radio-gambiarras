// Data for the callsign grid: which blocks match the filters, and every
// callsign in a block with its status.
import { blockSize, blocksFor, isForbiddenSuffix, suffixAt, type Block, type LicenseClass } from './rules.ts';
import type { Uf } from './rules-data.ts';
import { statusOf, type CallsignIndex, type Status } from './status.ts';

export interface Cell {
  callsign: string;
  suffix: string;
  status: Status;
}

/** Blocks for a state and class, optionally limited to one suffix length. */
export function blockChoices(uf: Uf, licenseClass: LicenseClass, length?: 2 | 3): Block[] {
  return blocksFor(uf, licenseClass).filter((b) => length === undefined || b.length === length);
}

/** Every callsign in a block, in alphabetical order, with its status. */
export function blockCells(block: Block, index: CallsignIndex): Cell[] {
  const size = blockSize(block);
  const cells: Cell[] = new Array(size);
  for (let i = 0; i < size; i++) {
    const suffix = suffixAt(block, i);
    const callsign = block.prefix + suffix;
    cells[i] = { callsign, suffix, status: statusOf(callsign, index, isForbiddenSuffix(suffix) ? 'forbidden' : 'regular') };
  }
  return cells;
}

export type StatusCounts = Record<Status, number>;

export function countStatuses(cells: readonly Cell[]): StatusCounts {
  const counts: StatusCounts = {
    'em-uso': 0,
    vencida: 0,
    quarentena: 0,
    reservado: 0,
    livre: 0,
    invalido: 0,
  };
  for (const cell of cells) counts[cell.status]++;
  return counts;
}

/** Position of the first cell whose suffix starts with each letter. */
export function letterOffsets(cells: readonly Cell[]): Map<string, number> {
  const offsets = new Map<string, number>();
  cells.forEach((cell, i) => {
    const letter = cell.suffix[0]!;
    if (!offsets.has(letter)) offsets.set(letter, i);
  });
  return offsets;
}
