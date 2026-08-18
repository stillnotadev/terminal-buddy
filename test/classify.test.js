'use strict';
const assert = require('assert');
const { classify, looksLikeFailure } = require('../lib/classify.js');

const cases = [
  { text: `Error: Cannot find module 'express'\n    at Function.Module._resolveFilename`, expect: 'npm-module-not-found' },
  { text: `Traceback (most recent call last):\n  File "app.py", line 3\nModuleNotFoundError: No module named 'flask'`, expect: 'python-module-not-found' },
  { text: `Error: listen EADDRINUSE: address already in use :::3000`, expect: 'addr-in-use' },
  { text: `docker: Error response from daemon: driver failed programming external connectivity: port is already allocated`, expect: 'docker-port-allocated' },
  { text: `Error: EACCES: permission denied, access '/usr/local/lib/node_modules'`, expect: 'eacces' },
  { text: `PermissionError: [Errno 13] Permission denied: 'data.csv'`, expect: 'python-permission-error' },
  { text: `Error: ENOENT: no such file or directory, open 'config.json'`, expect: 'enoent' },
  { text: `FileNotFoundError: [Errno 2] No such file or directory: 'data.csv'`, expect: 'python-file-not-found' },
  { text: `fatal: not a git repository (or any of the parent directories): .git`, expect: 'git-not-a-repo' },
  { text: `! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs to 'origin'`, expect: 'git-push-rejected' },
  { text: `Auto-merging file.txt\nCONFLICT (content): Merge conflict in file.txt\nAutomatic merge failed; fix conflicts and then commit the result.`, expect: 'git-merge-conflict' },
  { text: `fatal: refusing to merge unrelated histories`, expect: 'git-unrelated-histories' },
  { text: `*** Please tell me who you are.\nRun\n  git config --global user.email "you@example.com"`, expect: 'git-identity-missing' },
  { text: `remote: Repository not found.\nfatal: repository 'https://github.com/x/y.git/' not found`, expect: 'git-repo-not-found' },
  { text: `bash: fofo: command not found`, expect: 'command-not-found' },
  { text: `OSError: [Errno 28] No space left on device`, expect: 'no-space' },
  { text: `Segmentation fault (core dumped)`, expect: 'segfault' },
  { text: `Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?`, expect: 'docker-daemon' },
  { text: `  File "app.py", line 5\n    if True\n           ^\nSyntaxError: expected ':'`, expect: 'python-syntax-error' },
  { text: `SyntaxError: Unexpected token '}'`, expect: 'node-syntax-error' },
  { text: `ReferenceError: foo is not defined`, expect: 'reference-error' },
  { text: `TypeError: Cannot read properties of undefined (reading 'map')`, expect: 'type-error-undefined' },
  { text: `npm ERR! code ELIFECYCLE\nnpm ERR! errno 1`, expect: 'npm-lifecycle-error' },
  { text: `curl: (60) SSL certificate problem: self signed certificate in certificate chain`, expect: 'ssl-cert' },
  { text: `Error: Missing required environment variable: OPENAI_API_KEY`, expect: 'missing-env-var' },
  { text: `just some normal log output, nothing wrong here`, expect: null },
];

let pass = 0;
for (const c of cases) {
  const result = classify(c.text);
  const gotId = result ? result.id : null;
  const ok = gotId === c.expect;
  if (ok) {
    pass++;
  } else {
    console.log(`FAIL: expected ${c.expect}, got ${gotId} for: ${c.text.slice(0, 60)}...`);
  }
  if (result) {
    assert.ok(result.title && result.whatBroke && result.why && result.fix, `incomplete explanation object for ${result.id}`);
  }
}
console.log(`${pass}/${cases.length} pattern tests passed`);

assert.strictEqual(looksLikeFailure('Error: something broke'), true);
assert.strictEqual(looksLikeFailure('all tests passed, 12 ok'), false);
console.log('looksLikeFailure heuristic OK');

if (pass !== cases.length) process.exit(1);
console.log('ALL TESTS PASSED');
