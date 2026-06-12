import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { useToast } from './Toast';

// Coordinates a single Save action for whichever tab is active. The active tab
// registers a `saver` and reports whether it has unsaved changes (`dirty`);
// the header Save button reads that and triggers the saver. Nothing auto-saves.
const SaveContext = createContext(null);

export function SaveProvider({ children }) {
  const toast = useToast();
  const [dirty, setDirtyState] = useState(false);
  const [saving, setSaving] = useState(false);
  const saverRef = useRef(null);

  const setSaver = useCallback((fn) => {
    saverRef.current = fn;
  }, []);

  const setDirty = useCallback((v) => setDirtyState(!!v), []);

  // Called when a tab unmounts so the header doesn't keep a stale saver.
  const reset = useCallback(() => {
    saverRef.current = null;
    setDirtyState(false);
    setSaving(false);
  }, []);

  const save = useCallback(async () => {
    if (saving || !saverRef.current) return;
    setSaving(true);
    try {
      await saverRef.current();
      setDirtyState(false);
      toast.show('Saved');
    } catch {
      toast.show('Save failed — your changes are still here, try again', {
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  }, [saving, toast]);

  // Warn before a refresh / tab close / navigation drops unsaved edits.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  return (
    <SaveContext.Provider
      value={{ dirty, saving, setDirty, setSaver, reset, save }}
    >
      {children}
    </SaveContext.Provider>
  );
}

export function useSave() {
  return useContext(SaveContext);
}

// Tab helper: register this tab's saver + keep the header in sync with whether
// the tab has unsaved changes. Cleans up automatically when the tab unmounts.
export function useTabSave(saver, dirty) {
  const ctx = useSave();
  const { setSaver, setDirty, reset } = ctx;

  useEffect(() => {
    setSaver(saver);
  }, [setSaver, saver]);

  useEffect(() => {
    setDirty(dirty);
  }, [setDirty, dirty]);

  useEffect(() => reset, [reset]);

  return ctx;
}
