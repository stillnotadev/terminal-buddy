# Known error categories

These mirror the rules in `lib/classify.js`. If you can run Bash, prefer
piping the raw error through `node "${CLAUDE_PLUGIN_ROOT}/lib/classify.js"`
instead of matching these by eye — it keeps wording identical across the
skill, the CLI, and the automatic hook. This file exists so the same
reasoning is available when tool access isn't there.

| Category | Typical signal text | Root cause in plain English |
|---|---|---|
| Missing npm package | `Cannot find module 'X'` | A piece of the project hasn't been downloaded yet — run `npm install` |
| Missing Python package | `ModuleNotFoundError: No module named 'X'` | Same idea, Python side — `pip install X` |
| Port already in use | `EADDRINUSE`, `address already in use` | Something else is already using that "door" — usually a leftover running process |
| Docker port taken | `port is already allocated` | An earlier container using the same port was never stopped |
| Permission denied | `EACCES`, `PermissionError` | The OS is blocking access — often from an earlier `sudo` install; avoid forcing with `sudo` |
| Missing file | `ENOENT`, `FileNotFoundError` | Wrong folder, or the file was never created/was renamed |
| Not a git repo | `fatal: not a git repository` | This folder was never set up with Git, or `.git` got lost in a copy |
| Push rejected | `failed to push some refs`, `non-fast-forward` | Someone else's changes are online that you don't have yet — `git pull` first |
| Merge conflict | `CONFLICT (content)` | Two versions changed the same lines; a human has to pick which to keep |
| Unrelated histories | `refusing to merge unrelated histories` | Two project histories don't share a starting point — usually from re-initializing instead of cloning |
| Git identity missing | `Please tell me who you are` | One-time setup: Git needs a name/email before it will save anything |
| Repo not found | `repository not found` | Wrong URL, deleted project, or no access with the current login |
| Command not found | `command not found` | The program isn't installed, or isn't on the system's search path |
| Disk full | `No space left on device` | Free up storage |
| Segfault | `Segmentation fault` | A crash from a bug in the program itself, not user error — report it, don't work around it |
| Docker not running | `Cannot connect to the Docker daemon` | Open the Docker Desktop app first |
| Syntax/indentation error | `SyntaxError`, `IndentationError` | A typo or formatting mistake in the code at the given line |
| Reference error | `X is not defined` | Something is used before it's created/imported, or it's misspelled |
| Type error on undefined | `Cannot read properties of undefined` | Some expected data wasn't actually there yet when the code ran |
| npm lifecycle failure | `npm ERR! code ELIFECYCLE` | A generic "a setup step failed" — scroll up for the real error above it |
| SSL/certificate error | `self signed certificate`, `certificate has expired` | A secure connection couldn't be verified — common on work/school networks; don't disable cert checks to work around it |
| Missing API key / env var | `Missing environment variable`, `API key` | A required setting wasn't provided, usually belongs in a `.env` file |

# House glossary

Reuse these exact plain-English definitions so a person hears the same
explanation for the same word no matter where they encounter it (chat,
CLI, or an automatic hook explanation).

| Term | Plain-English definition |
|---|---|
| dependency | a piece of pre-written code your project needs to work, made by someone else |
| package / module | a bundle of pre-written code you can add to your project |
| stack trace / traceback | the trail of steps the program was in the middle of when it crashed |
| exit code | a number a program leaves behind saying whether it worked (0) or failed (anything else) |
| terminal | the text-only window used to type commands directly to the computer |
| repository / repo | a project's folder, tracked by Git so changes can be saved and undone |
| commit | a saved snapshot of your project at a point in time |
| branch | a separate, parallel copy of your project you can experiment in safely |
| merge conflict | when two saved versions changed the same lines and Git can't tell which one to keep |
| environment variable | a setting stored outside your code, often used for secrets like passwords or API keys |
| API key | a password-like code that lets your project talk to another company's service |
| permission | the operating system's rule about who is allowed to read, change, or run a file |
| sudo | a command that temporarily gives you admin-level power over the whole computer |
| daemon | a program that runs quietly in the background |
| port | a numbered "door" a program listens on to receive network traffic |
| compile | translating human-written code into a form the computer can run |
| syntax error | a typo or grammar mistake in the code itself |
| null / undefined | programmer-speak for "nothing" / "this was never given a value" |
| exception | the formal name for an error a program raises when something goes wrong |
| PATH | the list of folders the computer searches to find a program when you type its name |
| cache | a folder of temporarily saved files kept around to make things faster next time |
