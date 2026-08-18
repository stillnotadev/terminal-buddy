'use strict';

/**
 * Rule-based error classifier.
 * Shared by: the standalone CLI (cli/explain-error.js), the PostToolUseFailure hook
 * (hooks/scripts/detect-error.js), and — via `node lib/classify.js` — the
 * error-translator skill, so all three surfaces give the same explanation
 * for the same error, in the same plain-English format.
 *
 * Every pattern returns:
 *   title      - short label
 *   whatBroke  - one plain-English sentence, no jargon
 *   why        - the mechanism, translated
 *   fix        - a concrete next step, phrased as an action
 *   fixCommand - optional, the actual command that would fix it
 *   riskNote   - what the fix could touch, if anything
 */

const PATTERNS = [
  {
    id: 'npm-module-not-found',
    test: (t) => /Cannot find module ['"]([^'"]+)['"]/.test(t),
    build: (t) => {
      const m = t.match(/Cannot find module ['"]([^'"]+)['"]/);
      const mod = m ? m[1] : 'a package';
      return {
        title: `Missing package: ${mod}`,
        whatBroke: `Your project is trying to use a piece of code called "${mod}", but it hasn't been downloaded onto this computer yet.`,
        why: 'This usually happens the first time you run a project, right after pulling new changes, or if a setup step got skipped.',
        fix: 'Run the command that downloads all the project\'s pieces, then try again.',
        fixCommand: 'npm install',
        riskNote: 'Safe — this only adds files into the project folder, it does not delete or change your code.',
      };
    },
  },
  {
    id: 'python-module-not-found',
    test: (t) => /ModuleNotFoundError: No module named ['"]([^'"]+)['"]/.test(t),
    build: (t) => {
      const m = t.match(/ModuleNotFoundError: No module named ['"]([^'"]+)['"]/);
      const mod = m ? m[1] : 'a package';
      return {
        title: `Missing Python package: ${mod}`,
        whatBroke: `Your program needs a piece of code called "${mod}", but Python can't find it installed.`,
        why: 'Either it was never installed, or it was installed somewhere Python isn\'t currently looking (a different environment).',
        fix: `Install it with pip, then run your program again.`,
        fixCommand: `pip install ${mod}`,
        riskNote: 'Safe — this only adds a package, it does not touch your project files.',
      };
    },
  },
  {
    id: 'addr-in-use',
    test: (t) => /EADDRINUSE/.test(t) || /address already in use/i.test(t),
    build: () => ({
      title: 'Something else is already using that port',
      whatBroke: 'The program tried to start a server on a "door" (port) that\'s already being used by another running program.',
      why: 'This usually means an earlier copy of your app is still running in the background, or another app happens to use the same port.',
      fix: 'Stop whatever is already using that port, or restart your computer if you\'re not sure what it is, then try again.',
      riskNote: 'Low risk, but stopping the wrong background process could interrupt something else you have running.',
    }),
  },
  {
    id: 'docker-port-allocated',
    test: (t) => /port is already allocated/i.test(t),
    build: () => ({
      title: 'Docker: that port is already taken',
      whatBroke: 'Docker tried to open a "door" (port) for your container, but something is already using it.',
      why: 'Usually an earlier container using the same port was never stopped.',
      fix: 'Stop the other running container, then try again.',
      fixCommand: 'docker ps',
      riskNote: 'Safe to look — stopping a container only pauses that one container.',
    }),
  },
  {
    id: 'eacces',
    test: (t) => /EACCES/.test(t),
    build: () => ({
      title: 'Permission denied',
      whatBroke: 'The program was blocked from reading, writing, or running a file because the computer\'s permission settings don\'t allow it.',
      why: 'Often happens when a package was installed with admin rights (sudo) at some point, and normal commands no longer have access to it.',
      fix: 'Avoid using "sudo" to force it — that usually causes more permission problems later. Instead, fix folder ownership or use a version manager for Node/Python.',
      riskNote: 'Be cautious with any command that changes permissions system-wide — ask before running "sudo chmod" broadly.',
    }),
  },
  {
    id: 'python-permission-error',
    test: (t) => /PermissionError:/.test(t),
    build: () => ({
      title: 'Permission denied',
      whatBroke: 'Python tried to open or change a file it\'s not allowed to touch.',
      why: 'The file might be locked by another program, owned by a different user, or marked read-only.',
      fix: 'Close any other program that might have the file open, then try again. Avoid forcing it with admin rights unless you\'re sure why it\'s blocked.',
      riskNote: 'Low risk to retry; higher risk if you override permissions system-wide.',
    }),
  },
  {
    id: 'enoent',
    test: (t) => /ENOENT[:,]?\s*no such file or directory/i.test(t),
    build: (t) => {
      const m = t.match(/no such file or directory,?\s*(?:open|stat|scandir)?\s*'([^']+)'/i);
      const file = m ? m[1] : null;
      return {
        title: 'A file or folder is missing',
        whatBroke: file
          ? `The program looked for "${file}" and couldn't find it.`
          : 'The program looked for a file or folder that doesn\'t exist where it expected.',
        why: 'Either the file was never created, was moved/renamed, or the command was run from the wrong folder.',
        fix: 'Double-check you\'re in the right project folder, and that the file exists. If it\'s a setup file, you may need to run the project\'s install/setup step first.',
        riskNote: 'Safe to investigate — just looking for a file changes nothing.',
      };
    },
  },
  {
    id: 'python-file-not-found',
    test: (t) => /FileNotFoundError:/.test(t),
    build: () => ({
      title: 'A file is missing',
      whatBroke: 'Python tried to open a file that isn\'t where it expected.',
      why: 'The file may not exist yet, was renamed, or the program is being run from the wrong folder.',
      fix: 'Check the file path mentioned in the error, and confirm you\'re running the command from the project\'s main folder.',
      riskNote: 'Safe to investigate.',
    }),
  },
  {
    id: 'git-not-a-repo',
    test: (t) => /fatal: not a git repository/i.test(t),
    build: () => ({
      title: 'This folder isn\'t tracked by Git yet',
      whatBroke: 'You ran a Git command, but this folder was never set up to be tracked by Git.',
      why: 'Either the project was copied without its hidden ".git" folder, or Git was never initialized here.',
      fix: 'If this is meant to be a Git project, initialize it, or make sure you\'re in the correct folder.',
      fixCommand: 'git init',
      riskNote: 'Safe if the folder truly has no history yet; if you expected existing history, check you\'re in the right folder before running this.',
    }),
  },
  {
    id: 'git-push-rejected',
    test: (t) => /failed to push some refs/i.test(t) || /\(non-fast-forward\)/i.test(t) || /\(fetch first\)/i.test(t),
    build: () => ({
      title: 'Your changes conflict with newer changes online',
      whatBroke: 'Git refused to upload (push) your changes because the online version has changes yours doesn\'t know about.',
      why: 'Someone else (or another one of your own devices) saved changes to the same project since you last downloaded it.',
      fix: 'Download the latest changes first, then try uploading again.',
      fixCommand: 'git pull',
      riskNote: 'Usually safe, but if it says there\'s a conflict after pulling, don\'t guess — ask for help resolving it so you don\'t lose work.',
    }),
  },
  {
    id: 'git-merge-conflict',
    test: (t) => /CONFLICT \(content\)/i.test(t) || /Automatic merge failed/i.test(t),
    build: () => ({
      title: 'Git found conflicting changes',
      whatBroke: 'Two saved versions changed the exact same lines of a file, and Git can\'t tell which one you want to keep.',
      why: 'This happens when combining two lines of changes (branches) that both touched the same spot.',
      fix: 'Open the flagged file(s), decide which version (or combination) to keep, then mark it resolved.',
      riskNote: 'Do this carefully — picking the wrong side can lose work. Worth asking for a second look before finishing.',
    }),
  },
  {
    id: 'git-unrelated-histories',
    test: (t) => /refusing to merge unrelated histories/i.test(t),
    build: () => ({
      title: 'These two project histories don\'t know about each other',
      whatBroke: 'Git tried to combine two versions of the project that don\'t share a common starting point.',
      why: 'Often happens when a project folder was re-initialized instead of properly downloaded (cloned).',
      fix: 'If you\'re sure both histories should be combined, allow it explicitly. If unsure, stop and get a second opinion first — this can be hard to undo cleanly.',
      fixCommand: 'git pull --allow-unrelated-histories',
      riskNote: 'Higher risk — can create a messy history. Worth confirming before running.',
    }),
  },
  {
    id: 'git-identity-missing',
    test: (t) => /Please tell me who you are/i.test(t),
    build: () => ({
      title: 'Git doesn\'t know your name yet',
      whatBroke: 'Git needs a name and email to label your saved changes, and neither has been set on this computer.',
      why: 'This is a one-time setup step Git requires before it will save (commit) anything.',
      fix: 'Set your name and email once, then retry.',
      fixCommand: 'git config --global user.email "you@example.com" && git config --global user.name "Your Name"',
      riskNote: 'Completely safe — this only labels future saves, it changes nothing about existing files.',
    }),
  },
  {
    id: 'git-repo-not-found',
    test: (t) => /repository not found/i.test(t) || /Could not read from remote repository/i.test(t),
    build: () => ({
      title: 'Git can\'t reach or find that project online',
      whatBroke: 'Git tried to connect to an online project (repository) and either it doesn\'t exist at that address, or you don\'t have access.',
      why: 'Common causes: a typo in the project URL, the project was renamed or deleted, or you\'re not logged in / don\'t have permission.',
      fix: 'Double-check the project URL, and confirm you\'re logged into the right account with access to it.',
      riskNote: 'Safe to investigate.',
    }),
  },
  {
    id: 'command-not-found',
    test: (t) => /(?:bash|zsh|sh): .*?: command not found/i.test(t) || /is not recognized as an internal or external command/i.test(t),
    build: (t) => {
      const m = t.match(/(?:bash|zsh|sh): (.+?): command not found/i);
      const cmd = m ? m[1] : 'that program';
      return {
        title: `"${cmd}" isn't installed`,
        whatBroke: `You (or the project) tried to run a program called "${cmd}", but the computer doesn't recognize it.`,
        why: 'The program either isn\'t installed, or it is installed but the computer doesn\'t know where to find it.',
        fix: `Install "${cmd}" (search "install ${cmd}" for your operating system), then try again in a new terminal window.`,
        riskNote: 'Safe to investigate before installing anything.',
      };
    },
  },
  {
    id: 'no-space',
    test: (t) => /No space left on device/i.test(t),
    build: () => ({
      title: 'Your computer is out of storage space',
      whatBroke: 'The program tried to save or download a file, but there\'s no free disk space left.',
      why: 'The hard drive is full.',
      fix: 'Free up space by deleting large unused files, emptying the trash, or clearing app caches, then try again.',
      riskNote: 'Be careful what you delete — when in doubt, ask before removing anything you don\'t recognize.',
    }),
  },
  {
    id: 'segfault',
    test: (t) => /Segmentation fault/i.test(t),
    build: () => ({
      title: 'The program crashed unexpectedly',
      whatBroke: 'A program tried to access a part of memory it wasn\'t allowed to, and crashed instantly (no normal error message).',
      why: 'This is usually a bug in the program itself, or in one of the packages it depends on — not something you did wrong.',
      fix: 'Try again once; if it keeps happening, it\'s worth reporting as a bug rather than trying to work around it yourself.',
      riskNote: 'Not something to fix by guessing — flag it rather than force through it.',
    }),
  },
  {
    id: 'docker-daemon',
    test: (t) => /Cannot connect to the Docker daemon/i.test(t),
    build: () => ({
      title: 'Docker isn\'t running',
      whatBroke: 'A command tried to talk to Docker\'s background service, but it isn\'t currently running.',
      why: 'The Docker Desktop app (or service) needs to be open and running before Docker commands will work.',
      fix: 'Open the Docker Desktop app, wait for it to fully start, then try the command again.',
      riskNote: 'Completely safe.',
    }),
  },
  {
    id: 'python-syntax-error',
    test: (t) => /IndentationError:/.test(t) || (/SyntaxError:/.test(t) && /(?:File "|Traceback \(most recent call last\))/.test(t)),
    build: () => ({
      title: 'There\'s a typo or formatting mistake in the code',
      whatBroke: 'Python found a line it couldn\'t understand — usually a small typo, a missing symbol, or inconsistent spacing.',
      why: 'Python is strict about exact formatting, especially indentation (spaces at the start of a line).',
      fix: 'Look at the line number in the error and compare it closely to the lines around it — a missing colon, bracket, or quote is the usual culprit.',
      riskNote: 'Safe — this is a code-editing fix, not a system change.',
    }),
  },
  {
    id: 'node-syntax-error',
    test: (t) => /SyntaxError: Unexpected token/.test(t),
    build: () => ({
      title: 'There\'s a typo in the code',
      whatBroke: 'The program hit a line it couldn\'t read correctly — usually a missing bracket, comma, or quote.',
      why: 'JavaScript is strict about exact punctuation in code.',
      fix: 'Check the file and line number mentioned in the error for a stray or missing character.',
      riskNote: 'Safe — this is a code-editing fix.',
    }),
  },
  {
    id: 'reference-error',
    test: (t) => /ReferenceError: (\S+) is not defined/.test(t),
    build: (t) => {
      const m = t.match(/ReferenceError: (\S+) is not defined/);
      const name = m ? m[1] : 'something';
      return {
        title: `"${name}" was used before it existed`,
        whatBroke: `The code tried to use something called "${name}", but it was never created or imported.`,
        why: 'Usually a missing import/setup line, or a typo in the name.',
        fix: `Check for a typo in "${name}", and make sure it's properly imported or defined before it's used.`,
        riskNote: 'Safe — this is a code-editing fix.',
      };
    },
  },
  {
    id: 'type-error-undefined',
    test: (t) => /Cannot read propert(?:y|ies) .*?of undefined/.test(t),
    build: () => ({
      title: 'The code expected something that wasn\'t there',
      whatBroke: 'The program tried to use a piece of information that turned out to be empty/missing at that moment.',
      why: 'Often means a piece of data (like something loaded from the internet or a file) hadn\'t arrived yet, or a step earlier failed silently.',
      fix: 'Trace back to where that piece of information was supposed to come from and confirm it\'s actually being set.',
      riskNote: 'Safe to investigate — this is a logic/code fix, not a system change.',
    }),
  },
  {
    id: 'npm-lifecycle-error',
    test: (t) => /npm ERR! code ELIFECYCLE/.test(t) || /npm ERR! errno/.test(t),
    build: () => ({
      title: 'One of the project\'s setup steps failed',
      whatBroke: 'A script the project runs automatically (during install or start) exited with an error.',
      why: 'The real cause is usually printed just above this line — this message just means "a step failed," not what failed.',
      fix: 'Scroll up in the output to find the first red error message above this one — that\'s the actual cause.',
      riskNote: 'Safe to investigate.',
    }),
  },
  {
    id: 'ssl-cert',
    test: (t) => /self signed certificate/i.test(t) || /certificate has expired/i.test(t) || /SSL certificate problem/i.test(t),
    build: () => ({
      title: 'A secure connection couldn\'t be verified',
      whatBroke: 'The program tried to connect securely to a website or service, but couldn\'t confirm the connection was safe.',
      why: 'Common on office/school networks with custom security software, or when a service\'s certificate has expired.',
      fix: 'If you\'re on a work or school network, this is often expected — ask your IT team. Avoid disabling certificate checks yourself, as that removes an important safety check.',
      riskNote: 'Do not just "turn off" certificate verification to make this go away — that removes real protection.',
    }),
  },
  {
    id: 'missing-env-var',
    test: (t) => /Missing (?:required )?(?:environment variable|env var|API key)/i.test(t) || /is not set/i.test(t) && /(?:API_KEY|env)/i.test(t),
    build: () => ({
      title: 'A required setting (API key) is missing',
      whatBroke: 'The program needs a piece of configuration — often a password-like "API key" — that hasn\'t been provided.',
      why: 'These are usually kept out of the code on purpose (for security) and have to be set separately, often in a file named ".env".',
      fix: 'Check the project\'s setup instructions (often a README or .env.example file) for which key is needed and where to put it.',
      riskNote: 'Keep API keys private — never paste them into a shared chat or public repository.',
    }),
  },
];

/** Recursively collect every string value from an object into one haystack. */
function scanObjectForText(value, out = [], seen = new WeakSet(), depth = 0) {
  if (value == null || depth > 6) return out;
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) scanObjectForText(v, out, seen, depth + 1);
  } else if (typeof value === 'object') {
    if (seen.has(value)) return out;
    seen.add(value);
    for (const k of Object.keys(value)) scanObjectForText(value[k], out, seen, depth + 1);
  }
  return out;
}

/**
 * Classify raw error text against known patterns.
 * Returns an explanation object, or null if nothing matched.
 */
function classify(rawText) {
  const text = String(rawText || '');
  for (const p of PATTERNS) {
    if (p.test(text)) {
      return { id: p.id, ...p.build(text) };
    }
  }
  return null;
}

/** Loose heuristic for "this text looks like a failure" when no rule matched. */
const FAILURE_SIGNAL = /(error|exception|fatal:|traceback|permission denied|not found|cannot|can't|failed|refused|denied)/i;

function looksLikeFailure(text) {
  return FAILURE_SIGNAL.test(String(text || ''));
}

module.exports = { classify, scanObjectForText, looksLikeFailure, PATTERNS };

// Allow `node lib/classify.js` to read raw error text from stdin and print
// the classification as JSON (or `null`). This is what the error-translator
// skill shells out to, so chat-triggered and hook-triggered explanations
// use the exact same rules.
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (input += chunk));
  process.stdin.on('end', () => {
    const result = classify(input);
    process.stdout.write(JSON.stringify(result));
  });
}
