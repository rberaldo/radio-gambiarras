// Loading and error states for tools that download their data.

export function Loading({ message }: { message: string }) {
  return (
    <div class="tool-loading" role="status">
      <p>{message}</p>
      <div class="tool-progress" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

export function LoadError({ detail, onRetry }: { detail: string; onRetry: () => void }) {
  return (
    <div class="tool-error" role="alert">
      <p>
        <strong>Não foi possível carregar os dados.</strong>
      </p>
      <p>
        Verifique sua conexão e tente de novo. <small>({detail})</small>
      </p>
      <button class="btn" type="button" onClick={onRetry}>
        Tentar de novo
      </button>
    </div>
  );
}
