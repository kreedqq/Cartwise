import * as React from "react";

/**
 * Returns a debounced version of `callback` that also exposes `flush()` to
 * run immediately (e.g. on blur) and `cancel()` to drop a pending call
 * (e.g. when the component unmounts or the row is deleted mid-edit).
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number,
) {
  const callbackRef = React.useRef(callback);
  // Keep the ref pointing at the latest callback without re-creating
  // `debounced` on every render (the "latest ref" pattern). Assigning inside
  // an effect - rather than directly during render - keeps this compatible
  // with the react-hooks/refs rule; the one-render delay is irrelevant since
  // callbackRef is only ever read later, asynchronously, from setTimeout.
  React.useEffect(() => {
    callbackRef.current = callback;
  });

  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = React.useRef<Args | null>(null);

  const cancel = React.useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    pendingArgsRef.current = null;
  }, []);

  const flush = React.useCallback(() => {
    if (pendingArgsRef.current) {
      const args = pendingArgsRef.current;
      cancel();
      callbackRef.current(...args);
    }
  }, [cancel]);

  const debounced = React.useCallback(
    (...args: Args) => {
      pendingArgsRef.current = args;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        flush();
      }, delayMs);
    },
    [delayMs, flush],
  );

  React.useEffect(() => cancel, [cancel]);

  return { debounced, flush, cancel };
}
