# explain-error (standalone CLI)

A tiny, dependency-free command-line tool that turns scary error messages into
plain English — no coding background required. Use it with any tool: Codex,
Cursor, plain Node/Python, or a raw terminal. No AI, no API key, no internet
connection required for the ~25 most common errors — it's pure pattern
matching that runs instantly on your own computer.

## Install

```bash
cd error-translator/cli
npm link
```

That makes the `explain-error` command available anywhere on your computer.
(No `npm link` permissions? You can also just run it directly with
`node /path/to/error-translator/cli/explain-error.js`.)

## Use it

Pipe a failing command straight in — this is the easiest way:

```bash
npm start 2>&1 | explain-error
```

Or paste an error you got from somewhere else:

```bash
explain-error "Cannot find module 'express'"
```

Or point it at a saved log file:

```bash
explain-error --file crash.log
```

Or just run it with no arguments, paste the error, and press Ctrl-D (Cmd-D on
Mac) when you're done:

```bash
explain-error
```

## What you get back

For the ~25 most common errors (missing packages, permission issues, Git
conflicts, "port already in use," Docker not running, typos in code, and
more), you'll get:

- **What broke** — one plain sentence, no jargon
- **Why** — the real mechanism, translated
- **Fix** — a concrete next step (with the actual command, when there is one)
- **A risk note** — anything the fix could affect, so you're not running
  commands blind

For errors it doesn't recognize yet, it still pulls out any jargon terms it
spots and defines them in plain English, plus a tip for finding the fix.

## Extending it

All the pattern-matching logic lives in `../lib/classify.js` as a plain list
of `{ test, build }` rules — no framework, easy to read, easy to add to.
