'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { init } from './index.js';

/**
 * Opt-in React adapter; import from 'furi-ime/react'.
 * React is an optional peer dependency, NOT bundled into the core.
 * Works in React + Vite and Next.js Client Components.
 */
export function useFuriIME(options = {}) {
  const [node, setNode] = useState(null);
  const [result, setResult] = useState(null);
  const instanceRef = useRef(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const ref = useCallback((element) => setNode(element), []);
  const settingsKey = JSON.stringify({
    reading: options.reading ?? 'hiragana',
    output: options.output ?? {},
  });

  useEffect(() => {
    if (!node) return;
    const instance = init({
      ...optionsRef.current,
      element: node,
      onChange: (value, meta) => {
        setResult(value);
        optionsRef.current.onChange?.(value, meta);
      },
      onCommit: (value, meta) => optionsRef.current.onCommit?.(value, meta),
      onComposition: (event) => optionsRef.current.onComposition?.(event),
      onDebug: (event) => optionsRef.current.onDebug?.(event),
    });
    instanceRef.current = instance;
    setResult(instance.getResult());
    return () => {
      instance.destroy();
      if (instanceRef.current === instance) instanceRef.current = null;
    };
  }, [node]);

  useEffect(() => {
    if (!instanceRef.current) return;
    instanceRef.current.setOptions({
      reading: optionsRef.current.reading,
      output: optionsRef.current.output,
    });
    setResult(instanceRef.current.getResult());
  }, [settingsKey]);

  const getResult = useCallback(() => instanceRef.current?.getResult() ?? null, []);
  const clear = useCallback(() => instanceRef.current?.clear() ?? null, []);
  const refresh = useCallback(() => instanceRef.current?.refresh() ?? null, []);

  return { ref, result, getResult, clear, refresh };
}
