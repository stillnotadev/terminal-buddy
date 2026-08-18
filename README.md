# Error Translator

Two things, both built for people who code with Claude Code, Codex, Cursor,
and similar tools but don't have a technical background:

1. Turns scary error messages and failed terminal commands into plain
   English, automatically. No more panicking at a wall of red text.
2. Keeps *every* response short, plain, and jargon-free by default, not
   just error explanations, so Claude reads more like a helpful person and
   less like a manual.

For every error it recognizes, you get:

- **What broke** — one plain sentence, no jargon
- **Why** — the real mechanism, translated
- **Fix** — a concrete next step, with the actual command if there is one
- **A risk note** — what the fix could touch, so nothing gets run blind

It covers ~25 of the most common failures out of the box: missing packages
(npm/pip), permission errors, Git conflicts and push rejections, "port
already in use," Docker not running, typos in code, missing API keys, and
more. Anything it doesn't recognize still gets a best-effort plain-English
pass, plus a glossary of any jargon terms spotted in the text.

The error-translation half works two ways, sharing the same core logic
(`lib/classify.js`) so the explanations are identical either way. The
short-and-simple half only applies inside Claude Code / Cowork, since it's
a response-style rule, not a standalone tool.

## 1. As a Claude Code / Cowork plugin

Install this whole folder as a plugin (or drag the packaged `.plugin` file
into Cowork). You get three things automatically:

- **A skill** (`skills/error-translator`) — paste any error into chat, or
  just ask "what does this mean," and Claude explains it in plain English
  using the format above, and offers to fix it if it can.
- **A hook** (`hooks/hooks.json`, `PostToolUseFailure`) — watches every
  terminal command Claude runs on your behalf. If one fails, Claude
  explains it automatically, without you having to notice something went
  wrong and ask.
- **Short, plain responses by default** (`skills/simple-explanations` +
  a `SessionStart` hook) — every response in the session, not just error
  explanations, stays short, avoids unexplained jargon, and ends with a
  clear recommendation when a decision or action is needed. Applies
  automatically from the moment a session starts.

No setup beyond installing the plugin — everything runs locally, nothing is
sent anywhere.

## 2. As a standalone CLI (`explain-error`)

For when you're not inside Claude Code at all — using Codex, Cursor, or just
a plain terminal:

```bash
cd cli
npm link
```

Then:

```bash
npm start 2>&1 | explain-error
```

See `cli/README.md` for full usage. It runs entirely on your own computer —
no AI, no API key, no internet connection needed for the built-in patterns.

## Project layout

```
error-translator/
├── .claude-plugin/plugin.json      Plugin manifest
├── skills/error-translator/        Chat-triggered skill (SKILL.md + reference glossary)
├── skills/simple-explanations/     Standing "keep it short and plain" style rule
├── hooks/                          PostToolUseFailure (failed commands) + SessionStart (style) hooks
├── lib/classify.js                 Shared rule engine (~25 error patterns) — the core logic
├── lib/glossary.js                 Plain-English definitions for common jargon
├── cli/                            Standalone explain-error command
└── test/classify.test.js           Tests for the rule engine
```

## Extending the pattern list

Everything lives in `lib/classify.js` as a plain array of
`{ id, test(text), build(text) }` objects — no framework, easy to add a new
error pattern in a couple of lines. Run `node test/classify.test.js` after
any change.

## License

MIT — see `LICENSE`.
