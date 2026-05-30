/** Keep drag working after pointer capture is lost (video reload, leaving the track, etc.). */
export function bindDocumentPointerDrag(options: {
  pointerId: number;
  onMove: (clientX: number, clientY: number) => void;
  onEnd: () => void;
}): () => void {
  const { pointerId, onMove, onEnd } = options;
  const previousUserSelect = document.body.style.userSelect;
  const previousCursor = document.body.style.cursor;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'text';

  const cleanup = () => {
    document.removeEventListener('pointermove', onDocMove);
    document.removeEventListener('pointerup', onDocUp);
    document.removeEventListener('pointercancel', onDocUp);
    document.body.style.userSelect = previousUserSelect;
    document.body.style.cursor = previousCursor;
  };

  const onDocMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    ev.preventDefault();
    onMove(ev.clientX, ev.clientY);
  };

  const onDocUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    ev.preventDefault();
    cleanup();
    onEnd();
  };

  document.addEventListener('pointermove', onDocMove);
  document.addEventListener('pointerup', onDocUp);
  document.addEventListener('pointercancel', onDocUp);

  return cleanup;
}
