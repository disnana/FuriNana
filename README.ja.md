# FuriIME

**IME変換前の「かな」を利用して、ふりがなを生成する軽量JavaScriptライブラリ。** React Hook・TypeScript・GitHub Pagesデモにも対応しています。

[English README](./README.md) · [MITライセンス](./LICENSE) · [変更履歴](./CHANGELOG.md)

> **v0.1.0 初期リリース。** ブラウザのIMEイベントから変換前の読みを取得できた場合に利用します。IMEによっては読みを取得できず、貼り付けた漢字や既存の文章の読みも推測できません。分からない読みを勝手に生成しない設計です。

## 特徴

- `compositionupdate` で取得した変換前の「かな」と確定した漢字を対応付け。
- `init()` で返却する `text` / `reading` / `tokens` / `ruby` / `source` / `confidence` を選択。
- ひらがな・カタカナを切り替え可能。変更しても既存のルビは失われません。
- `input` / `textarea` 対応。途中編集で無効になった対応付けのみ破棄します。
- **依存ライブラリ0・辞書0・外部API通信0**。入力内容はライブラリから送信しません。
- React / Vite / Next.js（Client Component）向けHook、TypeScript型定義、単一HTMLデモ付き。
- ユーザー入力をHTMLエスケープして安全な `<ruby><rt>` マークアップを生成。

## インストール（初期はGitHubから直接）

GitHub上にリポジトリを作った後、`OWNER` を実際のユーザー名・Organization名に変更してください。**現段階ではnpmへの公開は不要**です。

```bash
npm install github:OWNER/FuriIME#v0.1.0
# または
npm install git+https://github.com/OWNER/FuriIME.git#v0.1.0
```

GitHubから直接インストールできるよう、`src/` をパッケージのエントリにしています。利用者側でビルドする必要はありません。Reactは任意のpeerDependencyです。

### JavaScript / TypeScript / Vite

```js
import { init } from 'furi-ime';

const ime = init({
  element: '#name',
  reading: 'katakana', // 'hiragana' | 'katakana'
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
  },
  onCommit(result, meta) {
    // 'captured' | 'no-kanji' | 'unavailable'
    console.log(meta.status);
  },
});

ime.getResult();
ime.setOptions({ reading: 'hiragana', output: { ruby: false } });
ime.refresh(); // JavaScriptで input.value を直接書き換えた後
ime.clear();
ime.destroy(); // 使わなくなったらイベントリスナーを解放
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
    <main>
      <textarea ref={ref} placeholder="かくにんは → 確認は" />
      <div dangerouslySetInnerHTML={{ __html: result?.ruby ?? '' }} />
      <pre>{JSON.stringify(result, null, 2)}</pre>
      <button onClick={clear}>クリア</button>
    </main>
  );
}
```

React用コードは `furi-ime/react` から明示的にimportします。本体だけ使う場合はReactが読み込まれません。Next.jsではClient Componentに記述してください。サンプルは [`examples/react-vite/App.tsx`](./examples/react-vite/App.tsx) にあります。

### HTMLに直接組み込む

GitHub ReleaseのZIPに同梱される `dist/furi-ime.global.js` を利用できます。

```html
<input id="name" />
<script src="./dist/furi-ime.global.js"></script>
<script>
  const ime = FuriIME.init({ element: '#name', output: { ruby: true } });
</script>
```

[`demo-standalone.html`](./demo-standalone.html) はHTMLとJavaScriptを**完全に1ファイル化**したデモです。ダブルクリックで開いて利用できます。

## `init()` の返却情報

`init()` はインスタンスを返し、**`output` で `getResult()` とコールバックに含めるデータを選べます**。省略時は `text` と `tokens` のみ有効です。

| 設定 | 返す情報 | 初期値 |
|---|---|---|
| `text` | `result.text`：変換後の全文 | `true` |
| `reading` | `result.reading`：全文の読み。未取得の漢字がある場合 `null` | `false` |
| `tokens` | `result.tokens`：対応付けた範囲・読み | `true` |
| `ruby` | `result.ruby`：HTMLエスケープ済みルビ付きHTML | `false` |
| `source` | `tokens` 内に `source: "ime"` を付加 | `false` |
| `confidence` | `tokens` 内に参考スコアを付加 | `false` |

例えば、IMEで `かくにんは` を `確認は` に変換した場合、すべての出力を有効化していれば次のようになります（confidenceは無効）：

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

`confidence` は統計的な正解確率ではありません。1つの漢字範囲に対応付けた場合0.95、複数範囲の場合0.80という**参考用ヒューリスティック値**です。重要な内容は人間が確認してください。

独立したユーティリティもあります。

```js
import { alignReading, convertReading, toRubyHTML } from 'furi-ime';
const spans = alignReading('確認は', 'かくにんは');
convertReading('かくにん', 'katakana'); // 'カクニン'
toRubyHTML('確認は', spans);            // '<ruby>確認<rt>かくにん</rt></ruby>は'
```

`alignReading()` は読みが既知の文字列を対応付ける関数であり、辞書による読み推測ではありません。

## 制約・プライバシー

- `compositionupdate.data` の内容はOS・IME・ブラウザごとに異なります。かなが取得できない環境もあります。
- **貼り付け**（`insertFromPaste`）では変換前の情報が存在しないため、漢字のルビを生成できません。
- かなだけのIME確定は失敗ではなく `no-kanji` です。
- 複数文節で対応付けが曖昧なときは見送ります。成功したときも必ず正しいとは限りません。
- JavaScriptから `input.value = ...` と変更した場合、`input` イベントは自動発火しないので `ime.refresh()` を呼んでください。
- 位置情報はUTF-16文字オフセットで管理します。`contenteditable` はv0.1.0では対象外です。
- FuriIME自体は**テキストを外部送信・永続保存しません**。アプリケーション側で送信・保存する場合は、その実装が別途必要です。

## GitHub Pages / GitHub Releasesで公開する

1. GitHubで `OWNER/FuriIME` というリポジトリを作成し、`dist/` や `docs/assets/` も含む全ファイルをプッシュ。
2. GitHubの **Settings → Pages → Build and deployment → GitHub Actions** を選択。`main` へのプッシュで付属ワークフローが `docs/` をビルド・公開します。
3. `npm test && npm run build && npm run pack:release` を実行するか、CIの成功を確認。
4. GitHubのReleasesで新しいタグ **`v0.1.0`** を作成して公開。ワークフローがZIPと単体ブラウザ用JSをReleaseに添付します。
5. READMEの `OWNER` を実際のアカウント名に置換して、GitHub Pagesのリンクを追加。想定URLは `https://OWNER.github.io/FuriIME/` です。

**リリース先はGitHub Releases、インストール元もGitHub**に統一します。npmレジストリへの公開は不要です。

## 開発・テスト

Node.js 18以上。通常のビルド・テストに依存パッケージはありません。

```bash
npm ci
npm test
npm run build
npm run pack:release  # zipコマンドが必要
```

[コントリビューション](./CONTRIBUTING.md)・[セキュリティポリシー](./SECURITY.md)も参照してください。

## ライセンス

MIT © 2026 tp-li。詳しくは [LICENSE](./LICENSE)。
