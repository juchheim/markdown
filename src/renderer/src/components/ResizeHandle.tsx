import { useCallback, useRef, type PointerEvent } from "react";

type Props = {
  orientation: "vertical" | "horizontal";
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  title?: string;
};

export function ResizeHandle({
  orientation,
  onResize,
  onResizeEnd,
  title = "Drag to resize",
}: Props) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragging.current = true;
      lastPos.current =
        orientation === "vertical" ? event.clientX : event.clientY;
      event.currentTarget.setPointerCapture(event.pointerId);
      document.body.classList.add("is-resizing");
    },
    [orientation],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const pos = orientation === "vertical" ? event.clientX : event.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      onResize(delta);
    },
    [orientation, onResize],
  );

  const endDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("is-resizing");
      event.currentTarget.releasePointerCapture(event.pointerId);
      onResizeEnd?.();
    },
    [onResizeEnd],
  );

  return (
    <div
      className={`resize-handle resize-handle-${orientation}`}
      role="separator"
      aria-orientation={orientation}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    />
  );
}
