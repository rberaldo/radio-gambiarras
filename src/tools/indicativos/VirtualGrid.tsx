// A scrollable grid that renders only the rows in view, so blocks of
// 16,900 callsigns stay fast on phones. Columns adapt to the width.
import type { ComponentChildren, Ref } from 'preact';
import { forwardRef, useImperativeHandle } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface VirtualGridHandle {
  /** Scrolls so the item at this position is on the first visible row. */
  scrollToItem(index: number): void;
}

interface Props {
  count: number;
  /** Minimum cell width in px; columns fill the available width. */
  minCellWidth: number;
  rowHeight: number;
  renderCell: (index: number) => ComponentChildren;
  label: string;
  overscanRows?: number;
}

function VirtualGridImpl(
  { count, minCellWidth, rowHeight, renderCell, label, overscanRows = 4 }: Props,
  ref: Ref<VirtualGridHandle>,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => {
      setWidth(el.clientWidth);
      setHeight(el.clientHeight);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = Math.max(1, Math.floor(width / minCellWidth));
  const rows = Math.ceil(count / columns);

  useImperativeHandle(
    ref,
    () => ({
      scrollToItem(index: number) {
        scroller.current?.scrollTo({ top: Math.floor(index / columns) * rowHeight });
      },
    }),
    [columns, rowHeight],
  );

  // A new list starts at the top.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [count]);

  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
  const last = Math.min(rows, Math.ceil((scrollTop + height) / rowHeight) + overscanRows);
  const items: ComponentChildren[] = [];
  for (let r = first; r < last; r++) {
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      if (i >= count) break;
      items.push(
        <div
          key={i}
          class="vgrid__cell"
          role="listitem"
          style={{ top: `${r * rowHeight}px`, left: `${(c * 100) / columns}%`, width: `${100 / columns}%`, height: `${rowHeight}px` }}
        >
          {renderCell(i)}
        </div>,
      );
    }
  }

  return (
    <div
      ref={scroller}
      class="vgrid"
      tabIndex={-1}
      onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
    >
      <div class="vgrid__inner" role="list" aria-label={label} style={{ height: `${rows * rowHeight}px` }}>
        {width > 0 && items}
      </div>
    </div>
  );
}

export const VirtualGrid = forwardRef(VirtualGridImpl);
