import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { init, alignReading, convertReading, toRubyHTML } from '../src/index.js';

class Field extends EventTarget {
  constructor(value = '') {
    super();
    this.tagName = 'TEXTAREA';
    this.value = value;
    this.selectionStart = value.length;
    this.selectionEnd = value.length;
  }
}

function emit(el, type, props = {}) {
  const event = new Event(type);
  Object.assign(event, props);
  el.dispatchEvent(event);
}

async function compose(el, steps, final, { finalInputAfterEnd = true } = {}) {
  emit(el, 'compositionstart', { data: '' });
  for (const data of steps) {
    emit(el, 'compositionupdate', { data });
    // Browsers may already show in-progress composition in textarea.value.
    el.value = data;
    emit(el, 'input', { data, inputType: 'insertCompositionText', isComposing: true });
  }
  el.value = final;
  if (finalInputAfterEnd) {
    emit(el, 'compositionend', { data: final });
    emit(el, 'input', { data: final, inputType: 'insertFromComposition', isComposing: false });
  } else {
    emit(el, 'input', { data: final, inputType: 'insertCompositionText', isComposing: true });
    emit(el, 'compositionend', { data: final });
    await sleep(5);
  }
}

test('basic alignment from user log: 確認は → かくにんは', () => {
  assert.deepEqual(alignReading('確認は', 'かくにんは'), [
    { start: 0, end: 2, reading: 'かくにん' },
  ]);
  assert.deepEqual(alignReading('利用', 'りよう'), [
    { start: 0, end: 2, reading: 'りよう' },
  ]);
});

test('aligns multiple kanji spans with kana anchors, but rejects ambiguity', () => {
  assert.deepEqual(alignReading('山の川', 'やまのかわ'), [
    { start: 0, end: 1, reading: 'やま' },
    { start: 2, end: 3, reading: 'かわ' },
  ]);
  assert.deepEqual(alignReading('今日は東京都に行く', 'きょうはとうきょうとにいく'), [
    { start: 0, end: 2, reading: 'きょう' },
    { start: 3, end: 6, reading: 'とうきょうと' },
    { start: 7, end: 8, reading: 'い' },
  ]);
  assert.deepEqual(alignReading('山、川', 'やまかわ'), []);
  assert.deepEqual(alignReading('漢字は', 'かんじ'), []);
  assert.deepEqual(alignReading('確認', 'abc'), []);
  assert.deepEqual(alignReading('こんにちは', 'こんにちは'), []);
});

test('hiragana and katakana conversion', () => {
  assert.equal(convertReading('かくにん', 'katakana'), 'カクニン');
  assert.equal(convertReading('カクニン', 'hiragana'), 'かくにん');
  assert.throws(() => convertReading('あ', 'romaji'), /reading must/);
});

test('ruby HTML escaping and invalid spans', () => {
  const x = `東京<script>alert('x')</script>`;
  const html = toRubyHTML(x, [{ start: 0, end: 2, reading: '<evil>&"' }]);
  assert.equal(html, '<ruby>東京<rt>&lt;evil&gt;&amp;&quot;</rt></ruby>&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;');
  assert.equal(toRubyHTML('確認', [{ start: -1, end: 5, reading: 'test' }]), '確認');
});

test('captures IME readings with event order: compositionend before final input', async () => {
  const input = new Field();
  let commits = [];
  const tracker = init({
    element: input,
    output: { text:true, reading:true, tokens:true, ruby:true, source:true, confidence:true },
    onCommit: (_result, meta) => commits.push(meta),
  });
  await compose(input, ['ｋ', 'か', 'かｋ', 'かく', 'かくにん', 'かくにんは', '確認は'], '確認は');
  const result = tracker.getResult();
  assert.equal(result.text, '確認は');
  assert.equal(result.reading, 'かくにんは');
  assert.equal(result.ruby, '<ruby>確認<rt>かくにん</rt></ruby>は');
  assert.deepEqual(result.tokens, [
    { text:'確認', reading:'かくにん', start:0, end:2, source:'ime', confidence:0.95 },
    { text:'は', reading:null, start:2, end:3 },
  ]);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].status, 'captured');
  tracker.destroy();
});

test('captures when compositionend fires after final input', async () => {
  const input = new Field();
  const tracker = init({ element:input, output:{ reading:true, ruby:true } });
  await compose(input, ['ｒ', 'り', 'りよ', 'りよう', '利用'], '利用', { finalInputAfterEnd:false });
  assert.equal(tracker.getResult().reading, 'りよう');
  assert.equal(tracker.getResult().ruby, '<ruby>利用<rt>りよう</rt></ruby>');
  tracker.destroy();
});

test('supports changing to katakana without losing alignment, and configurable returns', async () => {
  const input = new Field();
  const tracker = init({ element:input, output:{ text:false, tokens:false, ruby:true } });
  await compose(input, ['あ', 'あい', '愛'], '愛');
  assert.deepEqual(tracker.getResult(), { ruby:'<ruby>愛<rt>あい</rt></ruby>' });
  assert.deepEqual(tracker.setOptions({ reading:'katakana', output:{ ruby:false, text:true, tokens:true } }), {
    text:'愛',
    tokens:[{ text:'愛', reading:'アイ', start:0, end:1 }],
  });
  assert.throws(() => tracker.setOptions({ element:input }), /not element/);
  assert.throws(() => tracker.setOptions({ output:{ tokens:'yes' } }), /must be one of/);
  tracker.destroy();
});

test('kana-only commit has no-kanji status, not unavailable', async () => {
  const input = new Field();
  const statuses = [];
  const tracker = init({ element:input, onCommit:(_result, meta) => statuses.push(meta.status) });
  await compose(input, ['する', 'すること', 'することができます。'], 'することができます。');
  assert.deepEqual(statuses, ['no-kanji']);
  assert.deepEqual(tracker.getResult().tokens, [{ text:'することができます。', reading:null, start:0, end:10 }]);
  tracker.destroy();
});

test('missing preconversion kana gets unavailable, not guessed', async () => {
  const input = new Field();
  const statuses = [];
  const tracker = init({element:input, output:{reading:true}, onCommit:(_r,m)=>statuses.push(m.status)});
  await compose(input, ['ｔ', '東京'], '東京');
  assert.equal(tracker.getResult().reading, null);
  assert.deepEqual(statuses, ['unavailable']);
  tracker.destroy();
});

test('paste does not invent readings; edits after kanji preserve or invalidate marks', async () => {
  const input = new Field();
  const reasons = [];
  const tracker = init({element:input, output:{ reading:true, ruby:true }, onChange:(_r,m)=>reasons.push(m.reason)});
  await compose(input, ['かくにん', '確認'], '確認');
  assert.equal(tracker.getResult().reading, 'かくにん');
  input.selectionStart = 2;
  input.selectionEnd = 2;
  emit(input, 'beforeinput', { inputType:'insertFromPaste', data:' は貼り付け' });
  input.value = '確認 は貼り付け';
  emit(input, 'input', { inputType:'insertFromPaste', data:' は貼り付け', isComposing:false });
  assert.equal(tracker.getResult().ruby, '<ruby>確認<rt>かくにん</rt></ruby> は貼り付け');
  assert.equal(tracker.getResult().reading, null);
  assert.ok(reasons.includes('paste'));
  input.selectionStart = 1;
  input.selectionEnd = 1;
  emit(input, 'beforeinput', { inputType:'insertText', data:'甲' });
  input.value = '確甲認 は貼り付け';
  emit(input, 'input', { inputType:'insertText', data:'甲', isComposing:false });
  assert.equal(tracker.getResult().ruby, '確甲認 は貼り付け');
  tracker.destroy();
});

test('edits before marked text shift ranges (including repeated text)', async () => {
  const input = new Field('例');
  const tracker = init({element:input, output:{ruby:true,tokens:true}});
  input.selectionStart = 1;
  input.selectionEnd = 1;
  emit(input, 'compositionstart', {data:''});
  emit(input, 'compositionupdate', {data:'りよう'});
  input.value = '例利用';
  emit(input, 'compositionend', {data:'利用'});
  emit(input, 'input', {data:'利用',inputType:'insertFromComposition',isComposing:false});
  assert.equal(tracker.getResult().ruby, '例<ruby>利用<rt>りよう</rt></ruby>');
  input.selectionStart = 0;
  input.selectionEnd = 0;
  emit(input, 'beforeinput', {inputType:'insertText',data:'例'});
  input.value = '例例利用';
  emit(input, 'input', {inputType:'insertText',data:'例',isComposing:false});
  assert.equal(tracker.getResult().ruby, '例例<ruby>利用<rt>りよう</rt></ruby>');
  tracker.destroy();
});

test('refresh, clear and destroy lifecycle', async () => {
  const input = new Field();
  const tracker = init({element:input, output:{ruby:true}});
  await compose(input, ['りよう'], '利用');
  input.value = '他利用';
  assert.equal(tracker.refresh().ruby, '他<ruby>利用<rt>りよう</rt></ruby>');
  assert.equal(tracker.clear().ruby, '');
  tracker.destroy();
  tracker.destroy();
  assert.throws(() => tracker.getResult(), /destroyed/);
  assert.throws(() => init({element:123}), /element must/);
});
