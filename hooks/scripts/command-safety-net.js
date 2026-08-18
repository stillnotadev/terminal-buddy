#!/usr/bin/env node
'use strict';

// PreToolUse hook, matched to the Bash tool.
//
// This is the one hook event that can actually influence whether a tool
// call runs at all — via hookSpecificOutput.permissionDecision — unlike
// PostToolUse/PostToolUseFailure (used by detect-error.js), which only run
// after the fact and can add context, not stop anything. So this script,
// and only this script in the plugin, has the power to interrupt a command
// before it executes.
//
// It never uses permissionDecision: "deny". The philosophy here mirrors the
// rest of the plugin: never run something blind, but always leave the
// actual call to the person. "ask" surfaces a plain-English explanation of
// what the command does and why it's flagged, and — for anything a local
// git snapshot could help undo — takes that snapshot automatically before
// asking, so a "yes" that turns out to be a mistake is still recoverable.
//
// Claude Code sends this script a JSON payload on stdin with
// { tool_name, tool_input: { command } } before the Bash tool runs.
// It never blocks anything by crashing or hanging: any error, or any
// command that doesn't match a known risky pattern, falls through to exit
// 0 with no output, which leaves Claude Code's normal permission flow
// completely unaffected.

const path = require('path');
const { execSync } = require('child_process');
const { assessRisk } = require(path.join(__dirname, '..', '..', 'lib', 'risk-patterns.js'));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    // Never hang the tool loop waiting on stdin that never closes.
    setTimeout(() => resolve(data), 4000);
  });
}

function run(cmd, cwd) {
  return execSync(cmd, { cwd, timeout: 4000, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
}

// Takes a non-destructive snapshot of the current repo state, if there is
// one, so a bad outcome can still be undone. `git stash create` is safe to
// call here specifically because — unlike `git stash` / `git stash push` —
// it never touches the working tree or the index; it just builds a commit
// object representing the current state and prints its hash. Nothing about
// the person's in-progress work changes because this ran.
function buildCheckpointNote(cwd) {
  try {
    run('git rev-parse --is-inside-work-tree', cwd);
  } catch (e) {
    return 'This isn\'t inside a git project (or git isn\'t available), so there\'s no automatic local checkpoint for this one.';
  }

  let headNote;
  try {
    const sha = run('git rev-parse --short HEAD', cwd);
    headNote = `you're currently at commit ${sha}`;
  } catch (e) {
    headNote = 'this repo has no commits yet';
  }

  let stashNote = '';
  try {
    const stashSha = run('git stash create', cwd);
    if (stashSha) {
      const short = stashSha.slice(0, 7);
      stashNote = `, and any uncommitted changes were just snapshotted (restore them anytime with: git stash apply ${short})`;
    }
  } catch (e) {
    // Nothing to snapshot, or stash create failed — not worth surfacing as an error.
  }

  return `Checkpoint taken before this runs: ${headNote}${stashNote}.`;
}

async function main() {
  let payload;
  try {
    const raw = await readStdin();
    payload = raw ? JSON.parse(raw) : {};
  } catch (e) {
    process.exit(0); // never block on a parse failure
  }

  if (!payload || payload.tool_name !== 'Bash') {
    process.exit(0);
  }

  const command = payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string' || !command.trim()) {
    process.exit(0);
  }

  let risk;
  try {
    risk = assessRisk(command);
  } catch (e) {
    process.exit(0);
  }

  if (!risk) {
    process.exit(0); // not a known risky pattern — stay silent, don't influence the decision
  }

  const cwd = payload.cwd || process.cwd();

  let checkpointNote = '';
  if (risk.checkpointHelps) {
    try {
      checkpointNote = buildCheckpointNote(cwd);
    } catch (e) {
      checkpointNote = '';
    }
  }

  const prefix = risk.severity === 'critical' ? 'This one is worth stopping for. ' : '';
  const reason =
    `${prefix}${risk.title}. ${risk.whatItDoes} ${risk.whyRisky} ${checkpointNote} ${risk.suggestion} ` +
    `Explain this to the person in plain English using this exact information before they decide, ` +
    `then respect whatever they choose.`;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: reason.replace(/\s+/g, ' ').trim(),
      },
    })
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
