#!/usr/bin/env node
'use strict';

// SessionStart hook. Runs once when a session begins and injects the
// "simple-explanations" style rule as standing context for the whole
// session, so it applies to every response automatically, not just when
// the simple-explanations skill happens to get triggered on demand.
//
// This mirrors error-translator's own PostToolUseFailure hook in spirit
// (make the behavior automatic rather than something that has to be
// asked for each time), using SessionStart specifically because that's
// the one hook event proven, in this project's own testing, to reliably
// fire in both local and cloud Claude Code sessions.

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext:
        'Standing style rule for this session, from the simple-explanations skill: ' +
        'the person you are talking to does not have a technical background. Keep every ' +
        'response short (a few plain sentences, not long technical write-ups), avoid ' +
        'unexplained jargon (define any unavoidable technical term briefly, in plain words, ' +
        'the first time it comes up), and when a decision or action is needed end with one ' +
        'clear, short recommendation rather than a menu of options. This applies to all ' +
        'responses in this session, not only error explanations (those are already covered ' +
        'separately by the error-translator skill/hook). Still be accurate: short and simple ' +
        'does not mean oversimplified, misleading, or dropping real risk warnings. Give more ' +
        'detail if the person actually asks for it.',
    },
  })
);
process.exit(0);
