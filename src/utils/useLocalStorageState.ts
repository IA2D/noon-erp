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

/**
 * Same persistence contract, but bound to a fiscal-year namespace. Changing the
 * selected year reloads that year's authoritative value instead of retaining
 * the previous year's React state.
 */
export function useFiscalYearStorageState<T>(
  baseKey: string,
  fiscalYear: string,
  initialValue: T,
  legacyYear = fiscalYear
): [T, Dispatch<SetStateAction<T>>] {
  const key = `${baseKey}::fiscal-year::${fiscalYear}`;
  const read = (): T => {
    try {
      let stored = window.desktopStore?.getItem(key) ?? localStorage.getItem(key);
      if ((stored === null || stored === 'null') && fiscalYear === legacyYear) {
        stored = window.desktopStore?.getItem(baseKey) ?? localStorage.getItem(baseKey);
        if (stored !== null && stored !== 'null') {
          if (window.desktopStore) window.desktopStore.setItem(key, stored);
          else localStorage.setItem(key, stored);
        }
      }
      if (stored !== null && stored !== 'null') return JSON.parse(stored) as T;
    } catch {}
    return initialValue;
  };
  const [state, setState] = useState<T>(read);
  const versionRef = useRef<number>(window.desktopStore?.version(key) ?? 0);
  const loadedKeyRef = useRef(key);
  const skipWriteRef = useRef(false);

  useEffect(() => {
    skipWriteRef.current = true;
    loadedKeyRef.current = key;
    versionRef.current = window.desktopStore?.version(key) ?? 0;
    setState(read());
  // initialValue is a fallback seed; a year switch is the reload boundary.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (loadedKeyRef.current !== key) return;
    if (skipWriteRef.current) { skipWriteRef.current = false; return; }
    const serialized = JSON.stringify(state);
    if (window.desktopStore) {
      const result = window.desktopStore.setItemVersioned(key, serialized, versionRef.current);
      if (result.ok) versionRef.current = result.version ?? versionRef.current + 1;
      else {
        versionRef.current = result.actualVersion ?? window.desktopStore.version(key);
        const authoritative = window.desktopStore.getItem(key);
        if (authoritative !== null) setState(JSON.parse(authoritative) as T);
        window.dispatchEvent(new CustomEvent(result.closed ? 'fullerp:closed-year-write' : 'fullerp:storage-conflict', { detail: { key, error: result.error } }));
      }
    } else localStorage.setItem(key, serialized);
  }, [key, state]);

  const visibleState = loadedKeyRef.current === key ? state : read();
  return [visibleState, setState];
}
