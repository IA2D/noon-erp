import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';

/**
 * Persists ERP state to SQLite in Electron and retains localStorage as the web fallback.
 * Existing browser data is imported lazily the first time each key is opened on desktop.
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const desktopStore = window.desktopStore;
      let stored = desktopStore?.getItem(key) ?? null;
      if (stored === null) {
        stored = localStorage.getItem(key);
        if (desktopStore && stored !== null) desktopStore.setItem(key, stored);
      }
      if (stored !== null && stored !== 'null') {
        const parsed = JSON.parse(stored);
        if (Array.isArray(initialValue)) {
          return (Array.isArray(parsed) ? parsed : initialValue) as T;
        }
        return parsed as T;
      }
    } catch {
    }
    return initialValue;
  });
  const versionRef = useRef<number>(typeof window !== 'undefined' && window.desktopStore ? window.desktopStore.version(key) : 0);

  useEffect(() => {
    const syncVersion = (event: Event) => {
      const versions = (event as CustomEvent<Record<string, number>>).detail;
      if (versions && typeof versions[key] === 'number') versionRef.current = versions[key];
    };
    window.addEventListener('fullerp:versions-updated', syncVersion);
    return () => window.removeEventListener('fullerp:versions-updated', syncVersion);
  }, [key]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(state);
      if (window.desktopStore) {
        const result = window.desktopStore.setItemVersioned(key, serialized, versionRef.current);
        if (result.ok) versionRef.current = result.version ?? versionRef.current + 1;
        else if (result.conflict) {
          versionRef.current = result.actualVersion ?? window.desktopStore.version(key);
          const authoritative = window.desktopStore.getItem(key);
          if (authoritative !== null) setState(JSON.parse(authoritative) as T);
          window.dispatchEvent(new CustomEvent('fullerp:storage-conflict', { detail: { key, expectedVersion: result.expectedVersion, actualVersion: result.actualVersion } }));
        }
      }
      else localStorage.setItem(key, serialized);
    } catch {
    }
  }, [key, state]);

  return [state, setState];
}
