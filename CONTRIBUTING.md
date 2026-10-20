# Contributing / コントリビューション

Thanks for helping improve FuriIME! / ご協力ありがとうございます。

1. Run `npm ci && npm test && npm run build` before submitting a pull request.
2. Include minimal reproduction steps, **OS + browser version + IME name**, and expected/actual behavior for IME compatibility reports.
3. Please **do not share real personal names or sensitive input logs** in public issues. Use invented sample names instead.
4. Keep the core dependency-free and avoid network access in the capture path.
5. Any new alignment rule must include tests for correct, ambiguous, and malformed cases.

To test manually, open `demo-standalone.html` with a Japanese IME. GitHub Pages uses `docs/index.html`.

Bug reports and PRs in either English or Japanese are welcome. / 日本語・英語のどちらでも歓迎します。
