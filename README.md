# FuriIME

**Readings from Japanese IME input—not guessed from a dictionary.** Lightweight JavaScript furigana capture with a React hook, a TypeScript API, and a GitHub Pages demo.

[日本語 README](./README.ja.md) · [MIT License](./LICENSE) · [Changelog](./CHANGELOG.md)

> **Early release (v0.1.0).** FuriIME records kana **when an IME exposes it** via browser composition events. It cannot read the user's private IME dictionary, infer readings from pasted text, or guarantee correct segmentation for every IME/browser. Unknown readings remain unknown.

## Features

- Captures kana exposed during `compositionupdate` and aligns it with committed kanji.
- Configurable `init()` output: `text`, full `reading`, `tokens`, `ruby`, token `source`, and `confidence`.
- Output in hiragana or katakana; update settings without losing captured readings.
- Input/textarea support, reactive updates, UTF-16 ranges, safe ruby HTML escaping.
- **No runtime dependencies, external API requests, dictionaries, or global listeners.**
- Opt-in `furi-ime/react` hook; works in React/Vite and Next.js client components.
- Usable through ES modules, TypeScript, or a plain browser `<script>` tag.

## Install from GitHub

FuriIME is initially distributed **from GitHub**, not npm. Replace `OWNER` with your GitHub username/organization after creating the repository.

```bash
npm install github:OWNER/FuriIME#v0.1.0
# or
npm install git+https://github.com/OWNER/FuriIME.git#v0.1.0
```

`src/` is committed and exported directly, so a GitHub install does not require a build or `prepare` hook. `react` is an **optional** peer dependency; core users do not need it.

### Plain JavaScript / Vite

```js
import { init } from 'furi-ime';

const tracker = init({
  element: '#name',                  // input, textarea, or CSS selector
  reading: 'katakana',               // 'hiragana' or 'katakana'
  output: {
    text: true,
    reading: true,
    tokens: true,
    ruby: true,
    source: true,
    confidence: false,
  },
  onChange(result, meta) {
    console.log(meta.reason, result);
    // result.ruby is HTML-escaped; render it in a trusted preview container.
  },
  onCommit(result, meta) {
    console.log(meta.status);         // 'captured' | 'no-kanji' | 'unavailable'
  },
});

const result = tracker.getResult();
tracker.setOptions({ reading: 'hiragana', output: { ruby: false } });
tracker.refresh();                    // after programmatic input.value changes
tracker.clear();
tracker.destroy();                    // when the field is removed
```

### React / Vite

```tsx
import { useFuriIME } from 'furi-ime/react';

export default function Example() {
  const { ref, result, clear } = useFuriIME({
    reading: 'hiragana',
    output: { text: true, reading: true, tokens: true, ruby: true },
  });
  return (
    <div>
      <textarea ref={ref} placeholder="かくにんは → 確認は" />
      <div dangerouslySetInnerHTML={{ __html: result?.ruby ?? '' }} />
      <pre>{JSON.stringify(result, null, 2)}</pre>
      <button onClick={clear}>Clear</button>
    </div>
  );
}
```

The hook only attaches listeners after mounting; import from `furi-ime/react` **inside a client component** for Next.js. It uses an uncontrolled input in this example. See [`examples/react-vite/App.tsx`](./examples/react-vite/App.tsx).

### Browser with no bundler

Use the build included in the GitHub Release ZIP:

```html
<input id="name" />
<script src="./dist/furi-ime.global.js"></script>
<script>
  const tracker = FuriIME.init({ element: '#name', output: { ruby: true } });
</script>
```

[`demo-standalone.html`](./demo-standalone.html) is an **entirely self-contained** demo you can open without hosting or installing dependencies.

## Output contract

`init()` returns an instance; **the `output` flags select the fields of each `getResult()` and callback result**. All unspecified flags are `false`, except `text` and `tokens`, which default to `true`.

| Flag | Returns | Default |
|---|---|---|
| `text` | Whole committed text as `result.text` | `true` |
| `reading` | Full reading as `result.reading`, or `null` if any kanji is unknown | `false` |
| `tokens` | Annotated spans and plain spans as `result.tokens` | `true` |
| `ruby` | Escaped `<ruby><rt>` markup as `result.ruby` | `false` |
| `source` | `token.source: "ime"` **inside tokens** | `false` |
| `confidence` | `token.confidence` **inside tokens**, heuristic score only | `false` |

For example, converting `かくにんは` to `確認は` can produce:

```json
{
  "text": "確認は",
  "reading": "かくにんは",
  "tokens": [
    { "text": "確認", "reading": "かくにん", "start": 0, "end": 2, "source": "ime" },
    { "text": "は", "reading": null, "start": 2, "end": 3 }
  ],
  "ruby": "<ruby>確認<rt>かくにん</rt></ruby>は"
}
```

`confidence` is **not** a statistical probability. It is a rough alignment indicator (0.95 for one kanji span, 0.80 for multiple), and should not be used as a security or accuracy guarantee.

Additional pure helpers:

```js
import { alignReading, convertReading, toRubyHTML } from 'furi-ime';
const spans = alignReading('確認は', 'かくにんは');
convertReading('かくにん', 'katakana'); // 'カクニン'
toRubyHTML('確認は', spans);            // '<ruby>確認<rt>かくにん</rt></ruby>は'
```

`alignReading` needs a *known reading*; it is not a dictionary or a text-to-speech engine.

## Known limitations and privacy

- `compositionupdate.data` contents vary by OS, browser, and IME; a complete preconversion kana string may not be exposed.
- **Paste** (`insertFromPaste`) has no composition history. No reading is fabricated for pasted kanji.
- Unconverted kana-only commits return status `no-kanji`, not an error.
- Ambiguous multi-segment alignments are skipped; successful heuristics can still be incorrect, so verify important text.
- Direct assignments to `input.value` do not fire browser `input` events; use `tracker.refresh()` afterward. Ranges use UTF-16 positions.
- Inputs are local to your page. **FuriIME does not transmit or persist text**, capture passwords globally, or make network requests. Your own application controls storage and transport.
- Only regular `input` / `textarea` are supported in v0.1.0; not `contenteditable`.

## GitHub Pages and Releases

1. Create a repository, e.g. `OWNER/FuriIME`. Commit **all files including** `dist/` and `docs/assets/`.
2. Push to `main`. In **Settings → Pages**, select **GitHub Actions** as the source. The included workflow builds and deploys `docs/` on pushes to `main`.
3. Run `npm test && npm run build && npm run pack:release` locally, or confirm the CI checks have passed.
4. Create a GitHub Release with the **new** tag `v0.1.0` and publish it. The included release workflow validates the source and uploads the full ZIP and standalone browser JavaScript asset automatically.
5. Replace `OWNER` in README/example install commands with your actual repository owner, and link your live Pages URL. The expected URL for a project site is `https://OWNER.github.io/FuriIME/`.

The ZIP already includes an offline HTML demo, browser bundle, source, tests, and bilingual READMEs. The GitHub Releases page (not an npm registry) is the initial distribution channel.

## Development

Node.js 18+ is sufficient. No npm dependencies are needed to run tests or build the browser bundle.

```bash
npm ci
npm test
npm run build
npm run pack:release   # needs the `zip` utility
```

Please see [Contributing](./CONTRIBUTING.md) and [Security](./SECURITY.md) for support and responsible disclosures.

## License

MIT © 2026 tp-li. See [LICENSE](./LICENSE).
