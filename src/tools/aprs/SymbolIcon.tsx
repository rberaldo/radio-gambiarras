// A symbol drawn from hessu's sprite sheet for its table (see aprs.css).
import { cellOf, type AprsSymbol } from '../../lib/aprs/symbols.ts';

export function SymbolIcon({ symbol, size }: { symbol: AprsSymbol; size: number }) {
  const { column, row } = cellOf(symbol.char);
  return (
    <span
      class={symbol.table === '/' ? 'aprs-icon' : 'aprs-icon aprs-icon--alt'}
      style={{ '--size': `${size}px`, '--col': column, '--row': row }}
      aria-hidden="true"
    />
  );
}
