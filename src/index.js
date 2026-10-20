/**
 * FuriIME — dependency-free reading capture from Japanese IME composition events.
 * No dictionary, network access, or global listeners. Browser input/textarea only.
 * MIT License.
 */

const DEFAULT_OUTPUT = Object.freeze({
  text: true,
  reading: false,
  tokens: true,
  ruby: false,
  source: false,
  confidence: false,
});
const HAN = /[\p{Script=Han}々〆ヶ]/u;
const HIRAGANA = /^[\u3040-\u309fー]+$/u;
const KANA_CHAR = /[\u3040-\u30ffー]/u;
const MAX_COMPOSITION_STATES = 128;
const MAX_ALIGNMENT_LENGTH = 256;
const MAX_ALIGNMENT_UNITS = 48;
const MAX_ALIGNMENT_STEPS = 6000;

function toHiragana(text) {
  return String(text).normalize('NFKC').replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60));
}

function toKatakana(text) {
  return toHiragana(text).replace(/[ぁ-ゖ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0x60));
}

/** Convert kana without translating kanji. */
function convertReading(text, script = 'hiragana') {
  if (script !== 'hiragana' && script !== 'katakana') {
    throw new TypeError('reading must be "hiragana" or "katakana"');
  }
  return script === 'hiragana' ? toHiragana(text) : toKatakana(text);
}

function normalizeCandidate(value) {
  const canonical = toHiragana(value).replace(/[\s\u3000、。・!?！？]/gu, '');
  return canonical && HIRAGANA.test(canonical) && /[ぁ-ゖ]/u.test(canonical)
    ? canonical : null;
}

function unitsOf(committed) {
  const units = [];
  let offset = 0;
  for (const char of committed) {
    const kind = HAN.test(char) ? 'han' : KANA_CHAR.test(char) ? 'kana' : 'other';
    const last = units.at(-1);
    if (last && last.kind === kind) {
      last.text += char;
      last.end += char.length;
    } else {
      units.push({ kind, text: char, start: offset, end: offset + char.length });
    }
    offset += char.length;
  }
  return units;
}

/**
 * Align a provided *known* kana reading with kanji spans in committed text.
 * Returns [] when there is no unambiguous segmentation; never guesses pronunciations.
 * Indices are UTF-16 offsets, suitable for textarea selectionStart/selectionEnd.
 */
function alignReading(committed, reading) {
  if (typeof committed !== 'string' || typeof reading !== 'string') {
    throw new TypeError('committed and reading must be strings');
  }
  if (!HAN.test(committed)) return [];
  const source = normalizeCandidate(reading);
  if (!source || source.length > MAX_ALIGNMENT_LENGTH || committed.length > MAX_ALIGNMENT_LENGTH) return [];
  const units = unitsOf(committed);
  if (units.length > MAX_ALIGNMENT_UNITS) return [];
  let steps = 0;
  const solutions = [];
  function visit(index, pos, spans) {
    if (solutions.length > 1 || ++steps > MAX_ALIGNMENT_STEPS) return;
    if (index === units.length) {
      if (pos === source.length) solutions.push(spans.slice());
      return;
    }
    const unit = units[index];
    if (unit.kind === 'other') {
      visit(index + 1, pos, spans);
    } else if (unit.kind === 'kana') {
      const anchor = toHiragana(unit.text);
      if (source.startsWith(anchor, pos)) visit(index + 1, pos + anchor.length, spans);
    } else {
      // Cap work on hostile/very long input; ambiguity causes a safe rejection.
      const max = Math.min(source.length - pos, Math.max(12, [...unit.text].length * 6));
      for (let len = 1; len <= max && solutions.length <= 1 && steps <= MAX_ALIGNMENT_STEPS; len++) {
        spans.push({ start: unit.start, end: unit.end, reading: source.slice(pos, pos + len) });
        visit(index + 1, pos + len, spans);
        spans.pop();
      }
    }
  }
  visit(0, 0, []);
  // If search was capped, it cannot prove that the match is unique.
  return steps > MAX_ALIGNMENT_STEPS || solutions.length !== 1 ? [] : solutions[0];
}

function escapeHTML(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Safely render text + reading marks. No direct user input reaches HTML markup. */
function toRubyHTML(text, marks, script = 'hiragana') {
  if (typeof text !== 'string' || !Array.isArray(marks)) {
    throw new TypeError('text must be a string and marks must be an array');
  }
  let cursor = 0;
  let result = '';
  for (const mark of [...marks].sort((a, b) => a.start - b.start)) {
    if (!Number.isInteger(mark.start) || !Number.isInteger(mark.end) ||
        mark.start < cursor || mark.end <= mark.start || mark.end > text.length ||
        typeof mark.reading !== 'string') continue;
    result += escapeHTML(text.slice(cursor, mark.start));
    result += `<ruby>${escapeHTML(text.slice(mark.start, mark.end))}<rt>${escapeHTML(convertReading(mark.reading, script))}</rt></ruby>`;
    cursor = mark.end;
  }
  return result + escapeHTML(text.slice(cursor));
}

function diff(previous, current) {
  let start = 0;
  while (start < previous.length && start < current.length && previous[start] === current[start]) start++;
  let endA = previous.length;
  let endB = current.length;
  while (endA > start && endB > start && previous[endA - 1] === current[endB - 1]) {
    endA--;
    endB--;
  }
  return { start, oldEnd: endA, inserted: current.slice(start, endB) };
}

function selectionEdit(previous, current, hint) {
  if (!hint || !Number.isInteger(hint.start) || !Number.isInteger(hint.end)) {
    return diff(previous, current);
  }
  let { start, end } = hint;
  const removed = previous.length - current.length;
  if (start === end && removed > 0 && hint.inputType === 'deleteContentBackward') {
    start = Math.max(0, start - removed);
  } else if (start === end && removed > 0 && hint.inputType === 'deleteContentForward') {
    end = Math.min(previous.length, end + removed);
  }
  if (start <= end && previous.slice(0, start) === current.slice(0, start) &&
      previous.slice(end) === current.slice(current.length - (previous.length - end))) {
    const insertEnd = current.length - (previous.length - end);
    if (insertEnd >= start) {
      return { start, oldEnd: end, inserted: current.slice(start, insertEnd) };
    }
  }
  return diff(previous, current);
}

function moveMarks(marks, edit) {
  const { start, oldEnd, inserted } = edit;
  const delta = inserted.length - (oldEnd - start);
  const next = [];
  for (const mark of marks) {
    if (mark.end <= start) next.push(mark);
    else if (mark.start >= oldEnd) next.push({ ...mark, start: mark.start + delta, end: mark.end + delta });
    // Anything touching inside the mark invalidates that reading.
  }
  return next;
}

function normalizedOptions(input, previous) {
  const merged = {
    reading: input.reading ?? previous?.reading ?? 'hiragana',
    output: { ...DEFAULT_OUTPUT, ...previous?.output, ...input.output },
    onChange: input.onChange ?? previous?.onChange,
    onCommit: input.onCommit ?? previous?.onCommit,
    onComposition: input.onComposition ?? previous?.onComposition,
    onDebug: input.onDebug ?? previous?.onDebug,
  };
  if (!['hiragana', 'katakana'].includes(merged.reading)) {
    throw new TypeError('reading must be "hiragana" or "katakana"');
  }
  for (const [key, value] of Object.entries(merged.output)) {
    if (!(key in DEFAULT_OUTPUT) || typeof value !== 'boolean') {
      throw new TypeError(`output.${key} must be one of the documented boolean fields`);
    }
  }
  for (const key of ['onChange', 'onCommit', 'onComposition', 'onDebug']) {
    if (merged[key] != null && typeof merged[key] !== 'function') {
      throw new TypeError(`${key} must be a function`);
    }
  }
  return merged;
}

/** Initialize tracking for an input or textarea. No global state is installed. */
function init(options) {
  if (!options || typeof options !== 'object') throw new TypeError('init(options) requires an options object');
  let element = options.element;
  if (typeof element === 'string') {
    if (typeof document === 'undefined') throw new Error('CSS selectors require a browser document');
    element = document.querySelector(element);
  }
  if (!element || typeof element.addEventListener !== 'function' ||
      typeof element.value !== 'string' ||
      (typeof element.tagName === 'string' && !['INPUT', 'TEXTAREA'].includes(element.tagName.toUpperCase()))) {
    throw new TypeError('element must be an input or textarea (or a selector for one)');
  }
  let config = normalizedOptions(options);
  let active = true;
  let stableText = element.value;
  let marks = [];
  let composing = false;
  let session = null;
  let finalizeTimer = null;
  let editHint = null;

  function debug(type, details = {}) {
    config.onDebug?.({ type, ...details });
  }

  function updatePlainText() {
    if (session || stableText === element.value) return;
    const edit = selectionEdit(stableText, element.value, editHint);
    marks = moveMarks(marks, edit);
    stableText = element.value;
    editHint = null;
  }

  function tokensFor(text) {
    const results = [];
    let at = 0;
    for (const mark of marks) {
      if (mark.start < at || mark.end > text.length) continue;
      if (at < mark.start) results.push({ text: text.slice(at, mark.start), reading: null, start: at, end: mark.start });
      const token = {
        text: text.slice(mark.start, mark.end),
        reading: convertReading(mark.reading, config.reading),
        start: mark.start,
        end: mark.end,
      };
      if (config.output.source) token.source = mark.source;
      if (config.output.confidence) token.confidence = mark.confidence;
      results.push(token);
      at = mark.end;
    }
    if (at < text.length) results.push({ text: text.slice(at), reading: null, start: at, end: text.length });
    return results;
  }

  function fullReading(text) {
    let offset = 0;
    let reading = '';
    for (const mark of marks) {
      if (mark.start < offset || mark.end > text.length) return null;
      const plain = text.slice(offset, mark.start);
      if (HAN.test(plain)) return null;
      reading += convertReading(plain, config.reading) + convertReading(mark.reading, config.reading);
      offset = mark.end;
    }
    const tail = text.slice(offset);
    return HAN.test(tail) ? null : reading + convertReading(tail, config.reading);
  }

  function getResult() {
    if (!active) throw new Error('FuriIME instance was destroyed');
    updatePlainText();
    const text = element.value;
    const out = {};
    if (config.output.text) out.text = text;
    if (config.output.reading) out.reading = fullReading(text);
    if (config.output.tokens) out.tokens = tokensFor(text);
    if (config.output.ruby) out.ruby = toRubyHTML(text, marks, config.reading);
    return out;
  }

  function notify(reason, extra = {}) {
    config.onChange?.(getResult(), { reason, ...extra });
  }

  function finishComposition() {
    if (!active || !session || !session.ended) return;
    if (finalizeTimer !== null) clearTimeout(finalizeTimer);
    finalizeTimer = null;
    const completed = session;
    session = null;
    composing = false;
    const current = element.value;
    const change = selectionEdit(completed.before, current, completed.selection);
    marks = moveMarks(marks, change);
    const committed = change.inserted;
    let status = 'no-kanji';
    let added = 0;
    if (HAN.test(committed)) {
      status = 'unavailable';
      // Most recent fully-kana IME composition wins; no dictionary fallback.
      for (let i = completed.states.length - 1; i >= 0; i--) {
        const candidate = completed.states[i];
        const aligned = alignReading(committed, candidate);
        if (!aligned.length) continue;
        // A single reading is directly observed; segmented alignments are heuristic.
        const confidence = aligned.length === 1 ? 0.95 : 0.80;
        for (const match of aligned) {
          marks.push({ ...match, start: match.start + change.start,
            end: match.end + change.start, source: 'ime', confidence });
          added++;
        }
        status = 'captured';
        break;
      }
    }
    marks.sort((a, b) => a.start - b.start);
    stableText = current;
    editHint = null;
    debug('commit', { status, committed, added });
    const metadata = { reason: 'commit', status, committed, added };
    config.onCommit?.(getResult(), metadata);
    notify('commit', { status, committed, added });
  }

  function onCompositionStart(event) {
    if (session && session.ended) finishComposition();
    if (session) return;
    updatePlainText();
    composing = true;
    editHint = null;
    session = {
      before: element.value,
      selection: {
        start: element.selectionStart ?? null,
        end: element.selectionEnd ?? null,
        inputType: 'insertCompositionText',
      },
      states: [],
      ended: false,
    };
    debug('compositionstart', { data: event.data ?? '' });
    config.onComposition?.({ phase: 'start', data: event.data ?? '' });
  }

  function onCompositionUpdate(event) {
    if (!session) return;
    const candidate = normalizeCandidate(event.data ?? '');
    if (candidate && session.states.at(-1) !== candidate) {
      session.states.push(candidate);
      if (session.states.length > MAX_COMPOSITION_STATES) session.states.shift();
    }
    debug('compositionupdate', { data: event.data ?? '' });
    config.onComposition?.({ phase: 'update', data: event.data ?? '' });
  }

  function onCompositionEnd(event) {
    if (!session) return;
    composing = false;
    session.ended = true;
    debug('compositionend', { data: event.data ?? '' });
    config.onComposition?.({ phase: 'end', data: event.data ?? '' });
    // Some browsers deliver the final input before compositionend, others after.
    finalizeTimer = setTimeout(finishComposition, 0);
  }

  function onBeforeInput(event) {
    if (session || event.isComposing) return;
    editHint = {
      start: element.selectionStart ?? null,
      end: element.selectionEnd ?? null,
      inputType: event.inputType ?? '',
    };
  }

  function onInput(event) {
    if (session) {
      if (session.ended && !event.isComposing) finishComposition();
      return;
    }
    updatePlainText();
    const reason = event.inputType === 'insertFromPaste' ? 'paste' :
      event.inputType === 'deleteByCut' ? 'cut' : 'input';
    debug(reason, { inputType: event.inputType ?? '' });
    notify(reason);
  }

  element.addEventListener('compositionstart', onCompositionStart);
  element.addEventListener('compositionupdate', onCompositionUpdate);
  element.addEventListener('compositionend', onCompositionEnd);
  element.addEventListener('beforeinput', onBeforeInput);
  element.addEventListener('input', onInput);

  return {
    getResult,
    setOptions(next) {
      if (!active) throw new Error('FuriIME instance was destroyed');
      if (!next || typeof next !== 'object' || 'element' in next) {
        throw new TypeError('setOptions accepts reading/output/callback updates, not element');
      }
      config = normalizedOptions(next, config);
      return getResult();
    },
    refresh() {
      if (!active) throw new Error('FuriIME instance was destroyed');
      updatePlainText();
      const next = getResult();
      notify('refresh');
      return next;
    },
    clear() {
      if (!active) throw new Error('FuriIME instance was destroyed');
      if (finalizeTimer !== null) clearTimeout(finalizeTimer);
      finalizeTimer = null;
      session = null;
      composing = false;
      marks = [];
      element.value = '';
      stableText = '';
      editHint = null;
      notify('clear');
      return getResult();
    },
    destroy() {
      if (!active) return;
      active = false;
      if (finalizeTimer !== null) clearTimeout(finalizeTimer);
      element.removeEventListener('compositionstart', onCompositionStart);
      element.removeEventListener('compositionupdate', onCompositionUpdate);
      element.removeEventListener('compositionend', onCompositionEnd);
      element.removeEventListener('beforeinput', onBeforeInput);
      element.removeEventListener('input', onInput);
      session = null;
      marks = [];
    },
  };
}

export { init, convertReading, alignReading, toRubyHTML };
