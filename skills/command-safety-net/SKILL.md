---
name: command-safety-net
description: Explain what a terminal/Bash command actually does, in plain English, before it runs — and flag whether it's risky (deletes data, force-pushes, wipes a database, formats a disk, etc.). Use when the user asks "is this command safe?", "what does this command do?", pastes a command before running it, or when a Bash command Claude is about to run itself is worth a plain-English heads-up first (this may already be handled automatically by the command-safety-net hook, which asks for confirmation on risky commands and takes a local git checkpoint first when one would help).
---

# Command Safety Net

Explain commands the way a careful, plain-spoken friend would look over your
shoulder before you hit enter — never assume the person reading knows what a
flag, a device path, or "recursive" means.

## When this triggers

- The user pastes a command and asks what it does, or whether it's safe.
- Claude is about to run a Bash command on the user's behalf that isn't
  obviously safe, and no hook has already flagged it (if the
  command-safety-net hook is installed, it already interrupts risky commands
  automatically with a permission prompt — this skill covers cases where
  that automatic layer isn't present, or the user is asking proactively).

## How to respond

1. **Classify it before writing anything**, so wording matches the automatic
   hook exactly:

   ```bash
   echo "<the command>" | node "${CLAUDE_PLUGIN_ROOT}/lib/risk-patterns.js"
   ```

   This prints a JSON object (or the literal string `null` if nothing risky
   matched). If you don't have Bash tool access here, reason through it
   yourself using the same categories in `lib/risk-patterns.js` — recursive
   deletes, force-pushes, hard resets, force-deleting branches, wide
   `chmod`/`chown`, dropping/truncating a database, `dd`/`mkfs`/raw disk
   writes, `sudo` combined with any of the above, Docker/Kubernetes/Terraform
   teardown commands, and publishing/unpublishing packages.

2. **If nothing matched**, say plainly what the command does in one or two
   sentences anyway — "is this safe?" deserves a real answer even for benign
   commands, not just a "no risk found."

3. **If something matched, explain in this order, in plain prose:**

   - **What it does** — one sentence, no jargon.
   - **What could go wrong** — the real risk, not a vague "be careful."
   - **Whether a checkpoint would help.** If `checkpointHelps` is true and
     you're in a git project with tool access, offer to take one before
     anything runs: capture the current commit (`git rev-parse --short
     HEAD`) and snapshot any uncommitted changes without touching the
     working tree (`git stash create`) — note the resulting hash so it can
     be restored later (`git stash apply <hash>`). If `checkpointHelps` is
     false, say so and explain why a local git checkpoint wouldn't help here
     (the risk is in a database, a remote, a disk, or a cloud resource that
     git doesn't track).
   - **The suggestion** from the classifier, verbatim or lightly reworded.

4. **Never run a flagged command without an explicit yes**, even if Claude
   has general tool permission. A "yes" after a plain explanation is the
   whole point of this skill — don't shortcut it by explaining briefly and
   proceeding anyway.

## Tone rules

- Don't manufacture caution for ordinary commands — most things people run
  are fine, and treating everything as scary trains people to stop reading
  the warnings that matter.
- Don't hide behind vague language ("this could be risky") — say exactly
  what's at stake: which files, which branch, which table, which disk.
- If the command looks like it could hit something far broader than intended
  (a bare `rm -rf /`, `chmod -R` on `/`, a `DROP DATABASE` with no obvious
  scope), lead with that before anything else.
