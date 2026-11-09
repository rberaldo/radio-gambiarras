// One symbol large, and how to type it: table + character = code.
import { TABLE_NAMES, type AprsSymbol } from '../../lib/aprs/symbols.ts';
import { CopyButton } from '../../ui/CopyButton.tsx';
import { ToolPanel } from '../../ui/ToolPanel.tsx';
import { SymbolIcon } from './SymbolIcon.tsx';

export function SymbolPanel({ symbol, onClose }: { symbol: AprsSymbol; onClose: () => void }) {
  return (
    <ToolPanel
      label={`Símbolo ${symbol.code}: ${symbol.description}`}
      onClose={onClose}
      header={
        <>
          <SymbolIcon symbol={symbol} size={64} />
          <p class="aprs-panel__title">{symbol.description}</p>
        </>
      }
    >
      <h3 class="aprs-panel__heading">Como digitar</h3>
      <dl class="tool-panel__facts">
        <dt>Tabela</dt>
        <dd>
          {TABLE_NAMES[symbol.table]} <code class="aprs-char">{symbol.table}</code>
        </dd>
        <dt>Símbolo</dt>
        <dd>
          <code class="aprs-char">{symbol.char}</code>
        </dd>
        <dt>Código</dt>
        <dd class="aprs-panel__code">
          <code>{symbol.code}</code>
          <CopyButton text={symbol.code} label={`Copiar o código ${symbol.code}`} class="tool-panel__copy" />
        </dd>
      </dl>

      <p>
        O código tem dois caracteres: o da tabela e o do símbolo. Num relatório de posição, o da tabela vai entre a latitude
        e a longitude, e o do símbolo logo depois da longitude:
      </p>
      <p class="aprs-example">
        <code>
          !2254.12S<mark>{symbol.table}</mark>04312.34W<mark>{symbol.char}</mark>
        </code>
      </p>
    </ToolPanel>
  );
}
