import { useCallback, useEffect, useRef, useState } from 'react';

export interface NarrationMenuPosition {
  x: number;
  y: number;
  rowIndex: number;
}

export interface NarrationCopyHandlers {
  onCopyMain: () => void;
  onCopyPrevious: () => void;
}

export function useNarrationContextMenu() {
  const [menu, setMenu] = useState<NarrationMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openAt = useCallback((e: React.MouseEvent<HTMLElement>, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, rowIndex });
  }, []);

  useEffect(() => {
    if (!menu) return;

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // النقر داخل القائمة لا يغلقها — نعتمد على سمة data-narration-menu على جذر القائمة
      if (menuRef.current?.contains(target) || target.closest('[data-narration-menu]')) return;
      closeMenu();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    const onScrollOrResize = () => closeMenu();

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [menu, closeMenu]);

  const onNarrationKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, handlers: NarrationCopyHandlers) => {
      const mod = e.ctrlKey || e.metaKey;
      if ((mod && !e.shiftKey && e.key.toLowerCase() === 'd') || e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        if (rowIndex > 0) handlers.onCopyPrevious();
      } else if ((mod && e.shiftKey && e.key.toLowerCase() === 'd') || e.key === 'F4') {
        e.preventDefault();
        e.stopPropagation();
        handlers.onCopyMain();
      }
    },
    []
  );

  return { menu, closeMenu, openAt, menuRef, onNarrationKeyDown };
}
