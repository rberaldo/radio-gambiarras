// Drop a trail file anywhere on the tool (the button in ControlBar opens one
// too). The overlay shows only while a file is dragged over.
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';

interface Props {
  onFile: (file: File) => void;
  children: ComponentChildren;
}

const carriesFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

export function TrackDrop({ onFile, children }: Props) {
  const [over, setOver] = useState(false);
  // dragenter and dragleave fire for every child element crossed; count them.
  const depth = useRef(0);

  return (
    <div
      class="rp-drop"
      onDragEnter={(e) => {
        if (!carriesFiles(e)) return;
        depth.current++;
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!carriesFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setOver(false);
      }}
      onDragOver={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        if (!carriesFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setOver(false);
        const file = e.dataTransfer?.files[0];
        if (file) onFile(file);
      }}
    >
      {children}
      {over && (
        <div class="rp-drop__overlay" aria-hidden="true">
          <p>Solte o arquivo GPX para ver as repetidoras ao longo da trilha</p>
        </div>
      )}
    </div>
  );
}
