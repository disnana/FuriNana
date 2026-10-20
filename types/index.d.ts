/** FuriIME public TypeScript types. */
export type ReadingScript = 'hiragana' | 'katakana';
export type CommitStatus = 'captured' | 'no-kanji' | 'unavailable';
export type ChangeReason = 'commit' | 'input' | 'paste' | 'cut' | 'refresh' | 'clear';

export interface OutputOptions {
  text?: boolean;
  reading?: boolean;
  tokens?: boolean;
  ruby?: boolean;
  /** Include token.source when tokens=true. */
  source?: boolean;
  /** Include token.confidence when tokens=true; heuristic, not a calibrated probability. */
  confidence?: boolean;
}

export interface ReadingToken {
  text: string;
  /** Reading for kanji spans only. Unannotated spans use null. */
  reading: string | null;
  start: number;
  end: number;
  source?: 'ime';
  confidence?: number;
}

export interface ReadingMark {
  start: number;
  end: number;
  reading: string;
}

export interface FuriIMEResult {
  /** Only present when output.text=true. */
  text?: string;
  /** Null if any kanji in the full string has no known reading. */
  reading?: string | null;
  tokens?: ReadingToken[];
  /** HTML-escaped ruby markup, only when output.ruby=true. */
  ruby?: string;
}

export interface ChangeMeta {
  reason: ChangeReason;
  status?: CommitStatus;
  committed?: string;
  added?: number;
}

export interface CommitMeta extends ChangeMeta {
  reason: 'commit';
  status: CommitStatus;
  committed: string;
  added: number;
}

export interface CompositionData {
  phase: 'start' | 'update' | 'end';
  data: string;
}

export interface DebugEvent {
  type: string;
  [key: string]: unknown;
}

export interface FuriIMEOptions {
  element: HTMLInputElement | HTMLTextAreaElement | string;
  reading?: ReadingScript;
  output?: OutputOptions;
  onChange?: (result: FuriIMEResult, meta: ChangeMeta) => void;
  onCommit?: (result: FuriIMEResult, meta: CommitMeta) => void;
  onComposition?: (event: CompositionData) => void;
  onDebug?: (event: DebugEvent) => void;
}

export interface FuriIMEInstance {
  getResult(): FuriIMEResult;
  setOptions(options: Partial<Omit<FuriIMEOptions, 'element'>>): FuriIMEResult;
  /** Synchronize programmatic changes to input.value and notify onChange. */
  refresh(): FuriIMEResult;
  clear(): FuriIMEResult;
  destroy(): void;
}

export function init(options: FuriIMEOptions): FuriIMEInstance;
export function convertReading(text: string, script?: ReadingScript): string;
/** Returns [] when an alignment is missing or ambiguous. Offsets are UTF-16. */
export function alignReading(committed: string, reading: string): ReadingMark[];
/** HTML-escapes every text and ruby reading before producing markup. */
export function toRubyHTML(text: string, marks: readonly ReadingMark[], script?: ReadingScript): string;
