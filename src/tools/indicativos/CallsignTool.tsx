// The callsign tool's interactive part. M2.8: data loading and status only;
// filters, grid and search come in the next tasks.
import { useCallsignIndex } from './useCallsignIndex.ts';
import './callsigns.css';

export default function CallsignTool() {
  const data = useCallsignIndex();

  if (data.state === 'loading') {
    return (
      <div class="cs-loading" role="status">
        <p>Carregando a base de indicativos…</p>
        <div class="cs-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    );
  }

  if (data.state === 'error') {
    return (
      <div class="cs-error" role="alert">
        <p>
          <strong>Não foi possível carregar os dados.</strong>
        </p>
        <p>
          Verifique sua conexão e tente de novo. <small>({data.message})</small>
        </p>
        <button class="btn" type="button" onClick={data.retry}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const total = data.index.active.size + data.index.expired.size;
  return (
    <p>
      {total.toLocaleString('pt-BR')} indicativos em uso carregados. A grade e a busca chegam em breve.
    </p>
  );
}
