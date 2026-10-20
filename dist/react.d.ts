import type { RefCallback } from 'react';
import type {
  FuriIMEOptions, FuriIMEResult, FuriIMEInstance,
} from './index.js';

export type UseFuriIMEOptions = Omit<FuriIMEOptions, 'element'>;
export interface UseFuriIMEReturn {
  ref: RefCallback<HTMLInputElement | HTMLTextAreaElement>;
  /** null until the input element is mounted. */
  result: FuriIMEResult | null;
  getResult(): FuriIMEResult | null;
  clear(): FuriIMEResult | null;
  refresh(): FuriIMEResult | null;
}

/** React 18+ optional adapter. Valid in Vite and Next.js Client Components. */
export function useFuriIME(options?: UseFuriIMEOptions): UseFuriIMEReturn;
