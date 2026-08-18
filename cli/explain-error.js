#!/usr/bin/env node
'use strict';

const path = require('path');
const { classify, looksLikeFailure } = require('../lib/classify.js');
const { GLOSSARY } = require('../lib/glossary.js');

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `${code}${s}${RESET}` : s);

function printHelp() {
  console.log(`explain-error — turn a scary error message into plain English

Usage:
  some-command 2>&1 | explain-error       Pipe a failing command's output straight in
  explain-error --file path/to/log.txt    Read error text from a file
  explain-error "paste the error here"    Pass the error text directly as an argument
  explain-error                           Paste text, then press Ctrl-D (Cmd-D on Mac)

Options:
  --json         Print the result as JSON instead of formatted text
  --help, -h     Show this help
`);
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    if (process.stdin.isTTY) return resolve('');
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
  });
}

function findGlossaryHits(text) {
  const lower = text.toLowerCase();
  return Object.keys(GLOSSARY).filter((term) => lower.includes(term));
}

function formatExplanation(result, sourceText) {
  const lines = [];
  lines.push(c(BOLD + CYAN, `\n${result.title}`));
  lines.push(`${c(BOLD, 'What broke:')} ${result.whatBroke}`);
  lines.push(`${c(BOLD, 'Why:')} ${result.why}`);
  lines.push(`${c(BOLD, 'Fix:')} ${result.fix}`);
  if (result.fixCommand) {
    lines.push(`  ${c(GREEN, '$ ' + result.fixCommand)}`);
  }
  if (result.riskNote) {
    lines.push(`${c(YELLOW, 'Before you run that:')} ${result.riskNote}`);
  }
  return lines.join('\n') + '\n';
}

function formatFallback(text) {
  const hits = findGlossaryHits(text);
  const lines = [];
  lines.push(c(BOLD + YELLOW, '\nThis one isn\'t in my known list yet, but here\'s what I can tell:'));
  if (hits.length) {
    lines.push(`${c(BOLD, 'Terms in this error, in plain English:')}`);
    for (const term of hits.slice(0, 6)) {
      lines.push(`  ${c(CYAN, term)} — ${GLOSSARY[term]}`);
    }
  }
  lines.push(
    `\n${c(
      DIM,
      'Tip: copy the first line of the error (the part right after "Error:" or "Exception:") and paste it into a search engine — for common errors, the exact wording usually leads straight to the fix.'
    )}`
  );
  lines.push(
    c(
      DIM,
      'If you\'re running this inside Claude Code or Cowork with the error-translator plugin installed, paste the error there instead — Claude can read your project and explain it with full context, or fix it directly.'
    )
  );
  return lines.join('\n') + '\n';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const jsonMode = args.includes('--json');
  const fileFlagIndex = args.indexOf('--file');
  let text = '';

  if (fileFlagIndex !== -1 && args[fileFlagIndex + 1]) {
    const fs = require('fs');
    const filePath = path.resolve(args[fileFlagIndex + 1]);
    text = fs.readFileSync(filePath, 'utf8');
  } else {
    const positional = args.filter((a) => a !== '--json' && a !== '--file');
    if (positional.length) {
      text = positional.join(' ');
    } else {
      text = await readStdin();
    }
  }

  if (!text || !text.trim()) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const result = classify(text);

  if (jsonMode) {
    console.log(
      JSON.stringify(
        result || { matched: false, looksLikeFailure: looksLikeFailure(text), glossaryHits: findGlossaryHits(text) },
        null,
        2
      )
    );
    return;
  }

  if (result) {
    process.stdout.write(formatExplanation(result, text));
  } else {
    process.stdout.write(formatFallback(text));
  }
}

main().catch((err) => {
  console.error('explain-error hit an internal problem:', err.message);
  process.exitCode = 1;
});
