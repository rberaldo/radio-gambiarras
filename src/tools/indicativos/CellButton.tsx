// One callsign in the grid or in the suggestions: styled by status, with
// the free-up date in its tooltip when it is in quarantine.
import { STATUS_INFO, describeFreeFrom, freeFrom, type CallsignIndex, type Cell } from '../../lib/callsigns/index.ts';
import { STATUS_MARK } from './statusStyle.ts';

interface Props {
  cell: Cell;
  index: CallsignIndex;
  selected: boolean;
  onSelect: (callsign: string) => void;
}

export function CellButton({ cell, index, selected, onSelect }: Props) {
  const label = STATUS_INFO[cell.status].label;
  const inQuarantine = cell.status === 'quarentena' || cell.status === 'quarentena-incerta';
  const free = inQuarantine ? freeFrom(cell.callsign, index) : undefined;
  const hint = free ? `${label}. ${describeFreeFrom(free)}` : label;
  return (
    <button
      type="button"
      class={`cs-cell cs-cell--${cell.status}`}
      aria-pressed={selected}
      aria-label={`${cell.callsign}: ${hint}`}
      title={hint}
      onClick={() => onSelect(cell.callsign)}
    >
      {cell.callsign}
      {STATUS_MARK[cell.status] && <span class="cs-cell__mark">{STATUS_MARK[cell.status]}</span>}
    </button>
  );
}
