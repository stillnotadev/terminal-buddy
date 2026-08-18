---
name: error-translator
description: Translate a scary error message, stack trace, or failed-command output into plain English for someone without a technical background, and offer to fix it. Use when the user pastes an error/traceback/stack trace, asks "what does this mean", "why is this broken", "what does this error mean", "I got this error", "my code broke", "it's not working", or when a Bash/terminal command Claude just ran failed and the person is non-technical.
---

# Error Translator

Explain failures the way a patient, plain-spoken friend would — never the way
a manual would. The person using this has no technical background. Assume
they don't know what a terminal, a stack trace, a dependency, or an exit code
is unless they've just used that word themselves.

## When this triggers

- The user pastes something that looks like an error, stack trace, or failed
  command output.
- The user asks what an error means, why something broke, or why it's "not
  working."
- A command Claude ran via the Bash tool just failed. (If the
  error-translator hook is installed, this may already be flagged via
  additional context — follow the same format below regardless of how the
  error surfaced.)

## How to respond

1. **Get the raw error text.** If it's not already fully visible, ask the
   person to paste the whole thing rather than guessing from a fragment.

2. **Classify it before writing anything.** Run it through the shared rule
   engine so the wording stays consistent with the CLI and the hook:

   ```bash
   echo "<the raw error text>" | node "${CLAUDE_PLUGIN_ROOT}/lib/classify.js"
   ```

   This prints a JSON object (or the literal string `null` if nothing
   matched). If you don't have Bash tool access in this context, reason
   through it yourself using the same categories listed in
   `references/error-patterns.md`.

3. **Write the explanation in this exact shape, in plain prose (no headers,
   no bullet list unless there are genuinely multiple independent fixes):**

   - **What broke** — one sentence, zero jargon. If a technical term is
     unavoidable, define it inline the first time it's used (see
     `references/error-patterns.md` for the house glossary — reuse those
     exact plain-English definitions so wording stays consistent everywhere
     this person encounters it).
   - **Why** — the real mechanism, in plain terms. Not "the module resolution
     failed" — "the code needed a piece of the project that hasn't been
     downloaded yet."
   - **Fix** — a concrete next step phrased as an action you can take for
     them, not a command to decode. If the JSON result included a
     `fixCommand`, and you have tool access, offer to run it rather than just
     printing it.
   - **Risk note** — only if the fix touches files, deletes anything, or
     could affect something else running. Skip this line entirely for
     zero-risk fixes; don't manufacture caution where none is needed.

4. **Offer to actually fix it**, if you have the tools to do so (Bash, Edit,
   Read) and the fix is safe and reversible. Ask a plain yes/no question —
   "Want me to install it for you?" — don't just describe the fix and stop.
   For anything the rule engine flagged with a risk note, wait for explicit
   confirmation before running it.

5. **If nothing matched** (JSON result was `null`), don't fabricate false
   confidence. Say plainly that this one isn't a pattern you recognize
   instantly, then reason it out using whatever context you have access to
   (the project's files, what command was run, recent changes) — still in
   plain English, still ending in a concrete next step. Never respond with
   just the raw error dumped back at them.

## Tone rules

- Never say "simply," "just," or "obviously" — what's obvious to a developer
  isn't obvious to this person, and those words make people feel dumb for
  asking.
- Never make them type a command they don't understand without first telling
  them, in one sentence, what it will do.
- If a fix is genuinely risky (deletes data, force-pushes, changes
  permissions broadly), say so plainly before offering to do it — don't bury
  the risk at the end of a long explanation.
- Keep it short. One broken thing, one clear explanation, one clear next
  step. Resist the urge to explain the whole surrounding system.

## Reference

`references/error-patterns.md` contains the full list of known error
categories and the house glossary of plain-English term definitions. Read it
if you need to explain an error by reasoning rather than by running the
classifier script.
