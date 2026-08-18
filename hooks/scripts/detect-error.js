#!/usr/bin/env node
'use strict';

// PostToolUseFailure hook, matched to the Bash tool.
//
// This is deliberately NOT wired to PostToolUse. PostToolUse only fires
// when a tool call succeeds; a Bash command with a non-zero exit code
// counts as the tool call failing at the harness level, which fires the
// separate PostToolUseFailure event instead. (Confirmed empirically:
// isolated canary tests showed PostToolUse firing reliably on successful
// commands and never once on failing ones, across both local and cloud
// Claude Code sessions.) Since PostToolUseFailure only ever fires on a
// genuine failure, there's no need for the classifier to separately
// verify "did this actually fail" the way an implementation hung off
// PostToolUse would have to.
//
// Claude Code sends this script a JSON payload on stdin. For
// PostToolUseFailure on Bash, the failure is in a single `error` string
// (stdout+stderr folded together, prefixed "Exit code N"), not a
// tool_response object. It never blocks anything, it only ever exits 0.
// Its only job is to hand Claude a pre-classified, plain-English
// explanation via `hookSpecificOutput.additionalContext`, so a
// non-technical user gets a translation without having to ask.

const path = require('path');
const { classify } = require(path.join(__dirname, '..', '..', 'lib', 'classify.js'));

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

  // Defensive fallback in case the field name ever changes.
  const text = typeof payload.error === 'string' && payload.error ? payload.error : JSON.stringify(payload);

  const match = classify(text);
  const command = payload.tool_input && payload.tool_input.command;

  let additionalContext;
  if (match) {
    additionalContext =
      `A command just failed (command: ${JSON.stringify(command || 'unknown')}). ` +
      `It was auto-classified as "${match.title}". Follow the error-translator skill's response ` +
      `format to explain this to a non-technical user: ` +
      JSON.stringify({ whatBroke: match.whatBroke, why: match.why, fix: match.fix, fixCommand: match.fixCommand, riskNote: match.riskNote }) +
      `. Offer to run the fix if you have tool access and it's safe.`;
  } else {
    additionalContext =
      `A command just failed (command: ${JSON.stringify(command || 'unknown')}) and the error wasn't in the ` +
      `known pattern list. Follow the error-translator skill: explain in plain English (no jargon without ` +
      `a definition) what likely broke and suggest a concrete next step, using the raw output available above.`;
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PostToolUseFailure',
        additionalContext,
      },
    })
  );
  process.exit(0);
}

main().catch(() => process.exit(0));
