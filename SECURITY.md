# Security Policy / セキュリティポリシー

FuriIME processes user input in the browser and does not intentionally transmit, persist, or log typed text unless the **integrating application** passes a callback that does so.

## Supported version

| Version | Status |
|---|---|
| 0.1.x | Supported (early preview) |

## Reporting vulnerabilities

Please avoid publishing exploitable vulnerability details, passwords, or personal names in a public issue. Contact the repository maintainer privately using GitHub's **Private vulnerability reporting** feature (Settings → Security → Code security), if enabled, or another private contact method provided by the maintainer.

## Integration notes

- `toRubyHTML()` HTML-escapes text and readings. Do not turn off escaping or insert raw untrusted tokens elsewhere.
- Browser IME event readings are untrusted user-controlled content, not authorization input.
- Reading alignment confidence is not a security signal.
