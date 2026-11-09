// "Nothing here" with a way out: says what happened and offers the action
// that fixes it (clear the search, show everything).
import type { ComponentChildren } from 'preact';

interface Props {
  children: ComponentChildren;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ children, action }: Props) {
  return (
    <div class="tool-empty" role="status">
      <p>{children}</p>
      {action && (
        <button class="btn" type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
