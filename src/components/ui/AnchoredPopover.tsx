import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Position {
  top: number;
  left: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  width?: number;
  align?: 'start' | 'end';
  children: React.ReactNode;
  className?: string;
  dir?: 'rtl' | 'ltr';
}

const VIEWPORT_PADDING = 12;
const GAP = 8;

function computePosition(
  anchor: DOMRect,
  panelWidth: number,
  panelHeight: number,
  align: 'start' | 'end',
  dir: 'rtl' | 'ltr'
): Position {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left =
    align === 'end' || dir === 'rtl'
      ? anchor.right - panelWidth
      : anchor.left;

  left = Math.max(VIEWPORT_PADDING, Math.min(left, viewportWidth - panelWidth - VIEWPORT_PADDING));

  let top = anchor.bottom + GAP;
  if (top + panelHeight > viewportHeight - VIEWPORT_PADDING) {
    const above = anchor.top - panelHeight - GAP;
    if (above >= VIEWPORT_PADDING) {
      top = above;
    }
  }

  return { top, left };
}

export default function AnchoredPopover({
  open,
  onClose,
  anchorRef,
  width = 320,
  align = 'end',
  children,
  className = '',
  dir = 'rtl',
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    setPosition(
      computePosition(anchorRect, width, panelRect.height || 280, align, dir)
    );
  }, [anchorRef, width, align, dir]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    // أولاً نركّب اللوحة ثم نقيس موضعها في تأثير لاحق (لا يمكن قياس عنصر غير مرفوع بعد).
    setReady(true);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !ready) return;
    updatePosition();
  }, [open, ready, updatePosition, children]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef.current?.contains(target)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, onClose, anchorRef, updatePosition]);

  if (!open || !mounted || !ready) return null;

  return createPortal(
    <>
      <div
        className="nav-popover-backdrop"
        aria-hidden="true"
        onMouseDown={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`nav-popover animate-scale-in ${className}`}
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          width,
          zIndex: 10000,
        }}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
