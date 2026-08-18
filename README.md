# Terminal Buddy

Three things, all built for people who code with Claude Code, Codex, Cursor,
and similar tools but don't have a technical background:

1. Turns scary error messages and failed terminal commands into plain
   English, automatically. No more panicking at a wall of red text.
2. Keeps *every* response short, plain, and jargon-free by default, not
   just error explanations, so Claude reads more like a helpful person and
   less like a manual.
3. Steps in *before* a risky command runs — a `rm -rf`, a force-push, a
   dropped database table, a disk format — explains in plain English what
   it does and what could go wrong, and quietly takes a local git
   checkpoint first when one would help, so a "yes" that turns out to be a
   mistake is still recoverable.

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
a response-style rule, not a standalone tool. The safety-net half also
shares one core logic file (`lib/risk-patterns.js`) between its hook and
its skill, same as the error translator does.

## 1. As a Claude Code / Cowork plugin

Install this whole folder as a plugin (or drag the packaged `.plugin` file
into Cowork). You get four things automatically:

- **A skill** (`skills/error-translator`) — paste any error into chat, or
  just ask "what does this mean," and Claude explains it in plain English
  using the format above, and offers to fix it if it can.
- **A hook** (`hooks/hooks.json`, `PostToolUseFailure`) — watches every
  terminal command Claude runs on your behalf. If one fails, Claude
  explains it automatically, without you having to notice something went
  wrong and ask.
- **A command safety net** (`skills/command-safety-net` +
  `hooks/hooks.json`, `PreToolUse`) — before Claude runs a command that
  deletes files recursively, force-pushes, hard-resets, drops a database
  table, formats a disk, or a dozen other known-risky patterns, it asks for
  confirmation with a plain-English explanation of what the command does
  and what could go wrong — and if a local git checkpoint would help (it
  usually does for anything touching files or repo history), it takes one
  automatically first, without touching your working tree, so a mistake is
  still recoverable. Runs on ~18 known risky patterns out of the box; see
  `lib/risk-patterns.js` to add more.
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
terminal-buddy/
├── .claude-plugin/plugin.json      Plugin manifest
├── skills/error-translator/        Chat-triggered skill (SKILL.md + reference glossary)
├── skills/simple-explanations/     Standing "keep it short and plain" style rule
├── skills/command-safety-net/      Chat-triggered skill for "is this command safe?"
├── hooks/                          PostToolUseFailure (failed commands), PreToolUse
│                                    (risky commands), SessionStart (style) hooks
├── lib/classify.js                 Shared rule engine (~25 error patterns) — the core logic
├── lib/risk-patterns.js            Shared risk engine (~18 risky command patterns)
├── lib/glossary.js                 Plain-English definitions for common jargon
├── cli/                            Standalone explain-error command
├── test/classify.test.js           Tests for the error rule engine
└── test/risk-patterns.test.js      Tests for the risk rule engine
```

## Extending the pattern list

Both rule engines are plain arrays of `{ id, test(text), build(text) }`
objects — no framework, easy to add a new pattern in a couple of lines.
`lib/classify.js` covers failed commands/errors; `lib/risk-patterns.js`
covers commands worth a confirmation before they run. Run
`node test/classify.test.js` and `node test/risk-patterns.test.js` after
any change.

## License

MIT — see `LICENSE`.
