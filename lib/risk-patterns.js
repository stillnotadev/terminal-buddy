'use strict';

/**
 * Rule-based risk classifier for commands ABOUT TO run, not ones that already
 * failed. Shared by the PreToolUse hook (hooks/scripts/command-safety-net.js)
 * and the command-safety-net skill, so the explanation is identical whether
 * it shows up automatically or gets asked about directly ("is this command
 * safe?").
 *
 * This is a heuristic, not a shell parser — regexes over the raw command
 * string. It will miss cleverly obfuscated commands and will occasionally
 * flag something harmless. That's an acceptable trade for a safety net: a
 * few extra confirmations beat one silent catastrophe.
 *
 * Every pattern returns:
 *   title          - short label
 *   severity       - 'critical' | 'high' | 'medium'
 *   whatItDoes     - one plain-English sentence, no jargon
 *   whyRisky       - what could go wrong, in plain terms
 *   checkpointHelps- true if a local git snapshot (taken before the command
 *                    runs) would actually let the person recover, false if
 *                    the risk is somewhere a git checkpoint can't reach
 *                    (a remote registry, a database, a disk, a cloud
 *                    resource)
 *   suggestion     - one concrete, plain-English recommendation
 */

const PATTERNS = [
  {
    id: 'rm-recursive',
    // Excludes `sudo rm ...`, which the sudo-destructive pattern below
    // covers instead (that one's warning is about the elevated privileges,
    // which matters more than the recursive-delete detail here).
    test: (t) => !/\bsudo\s+rm\b/.test(t) && /\brm\s+(-\w*[rR]\w*\b|--recursive\b)/.test(t),
    build: (t) => {
      const hasForce = /(-\w*f\w*\b|--force\b)/i.test(t);
      const looksLikeEverything = /\brm\s+.*(\s|^)(\/|~|\$HOME|\*|\.)(\s|$)/.test(t) || /\brm\s+-\S*\s+(\/|~)\s*$/.test(t);
      return {
        title: hasForce ? 'Delete a folder and everything in it, with no confirmation' : 'Delete a folder and everything in it',
        severity: looksLikeEverything ? 'critical' : hasForce ? 'high' : 'medium',
        whatItDoes: 'This deletes a folder and every file and subfolder inside it, permanently — not to the Trash/Recycle Bin.',
        whyRisky: hasForce
          ? 'The force flag skips every "are you sure?" prompt, so it deletes everything in one shot with no chance to back out partway through.'
          : 'It deletes recursively without asking about most files, so it can remove far more than intended if the path is even slightly wrong.',
        checkpointHelps: true,
        suggestion: looksLikeEverything
          ? 'Double-check the exact path being deleted before approving this — it looks like it could target your whole home folder or drive.'
          : 'Make sure that path is exactly what you mean to delete, especially if it was typed by hand.',
      };
    },
  },
  {
    id: 'git-force-push',
    test: (t) => /\bgit\s+push\b/.test(t) && ((/--force\b/.test(t) && !/--force-with-lease\b/.test(t)) || /(^|\s)-f(\s|$)/.test(t)),
    build: () => ({
      title: 'Force-push, overwriting remote history',
      severity: 'high',
      whatItDoes: 'This pushes your local branch to the shared remote and overwrites whatever history is there, instead of adding on top of it.',
      whyRisky: 'If someone else pushed commits you don\'t have locally, or you\'re on the wrong branch, this can permanently erase their work on the remote.',
      checkpointHelps: true,
      suggestion: 'Confirm you\'re on the branch you think you\'re on, and consider `--force-with-lease` instead, which refuses to overwrite if the remote has commits you haven\'t seen.',
    }),
  },
  {
    id: 'git-reset-hard',
    test: (t) => /\bgit\s+reset\s+--hard\b/.test(t),
    build: () => ({
      title: 'Throw away uncommitted changes',
      severity: 'high',
      whatItDoes: 'This resets your files back to a previous commit and discards any uncommitted changes in the working folder.',
      whyRisky: 'Any edits you haven\'t committed yet are gone after this — there\'s no undo once it runs.',
      checkpointHelps: true,
      suggestion: 'If there\'s anything uncommitted you might still want, commit or stash it first.',
    }),
  },
  {
    id: 'git-clean-force',
    test: (t) => /\bgit\s+clean\s+.*-\w*f\w*/.test(t),
    build: (t) => {
      const alsoIgnored = /-\w*x\w*/.test(t);
      return {
        title: 'Delete untracked files from the project',
        severity: alsoIgnored ? 'high' : 'medium',
        whatItDoes: alsoIgnored
          ? 'This deletes every file git isn\'t tracking, including ones normally ignored (like build folders, .env files, or downloaded dependencies).'
          : 'This deletes every file git isn\'t tracking yet — anything that\'s never been committed.',
        whyRisky: 'It\'s permanent and non-interactive by default; new files you meant to keep but hadn\'t committed yet will be gone.',
        checkpointHelps: true,
        suggestion: 'Run `git clean -fd --dry-run` (or drop the matching flag here) first to see exactly what would be deleted.',
      };
    },
  },
  {
    id: 'git-branch-force-delete',
    test: (t) => /\bgit\s+branch\s+(-D\b|--delete\s+--force\b|-\w*D\w*\b)/.test(t),
    build: () => ({
      title: 'Force-delete a git branch',
      severity: 'medium',
      whatItDoes: 'This deletes a local branch even if it has commits that were never merged anywhere else.',
      whyRisky: 'Any work that only exists on that branch and was never merged or pushed is gone once it\'s deleted.',
      checkpointHelps: true,
      suggestion: 'Check `git log <branch>` first if you\'re not certain everything on it is merged elsewhere.',
    }),
  },
  {
    id: 'git-push-delete-remote-branch',
    test: (t) => /\bgit\s+push\b/.test(t) && (/--delete\b/.test(t) || /\bgit\s+push\s+\S+\s+:\S+/.test(t)),
    build: () => ({
      title: 'Delete a branch on the remote',
      severity: 'medium',
      whatItDoes: 'This removes a branch from the shared remote (like GitHub), not just locally.',
      whyRisky: 'If anyone else is using that branch, or has commits on it you don\'t have locally, that work becomes hard to recover.',
      checkpointHelps: false,
      suggestion: 'Confirm nobody else is actively working off that branch before removing it.',
    }),
  },
  {
    id: 'chmod-recursive',
    test: (t) => /\bchmod\s+(-R\b|--recursive\b)/.test(t),
    build: (t) => {
      const wideOpen = /\b(777|666|a\+rwx|a\+w)\b/.test(t);
      return {
        title: 'Change permissions on every file in a folder',
        severity: wideOpen ? 'high' : 'medium',
        whatItDoes: 'This changes who can read, write, or run every file inside a folder, all at once.',
        whyRisky: wideOpen
          ? 'Making everything readable/writable by anyone (777) is a common security mistake, especially outside a throwaway local project.'
          : 'A typo in the target path applies the change to files you didn\'t mean to touch, which can break things that rely on their current permissions.',
        checkpointHelps: false,
        suggestion: 'Double-check the folder path, and prefer the narrowest permission that actually works.',
      };
    },
  },
  {
    id: 'chown-recursive',
    test: (t) => /\bchown\s+(-R\b|--recursive\b)/.test(t),
    build: () => ({
      title: 'Change file ownership for every file in a folder',
      severity: 'medium',
      whatItDoes: 'This changes who owns every file inside a folder, all at once.',
      whyRisky: 'A wrong path or wrong user/group can leave files owned by an account that can no longer access or run them.',
      checkpointHelps: false,
      suggestion: 'Double-check the target path and the user/group before approving.',
    }),
  },
  {
    id: 'sql-drop-or-truncate',
    test: (t) => /\b(DROP\s+(TABLE|DATABASE|SCHEMA)|TRUNCATE\s+TABLE|TRUNCATE\b)\b/i.test(t),
    build: (t) => {
      const isDatabase = /DROP\s+DATABASE/i.test(t);
      return {
        title: isDatabase ? 'Delete an entire database' : 'Delete a database table (and all its rows)',
        severity: isDatabase ? 'critical' : 'high',
        whatItDoes: isDatabase
          ? 'This permanently deletes an entire database, including every table and row inside it.'
          : 'This permanently deletes a table and every row of data in it, or empties it entirely.',
        whyRisky: 'Database changes like this aren\'t covered by git — there\'s usually no undo unless you have a separate backup.',
        checkpointHelps: false,
        suggestion: 'Make sure there\'s a recent backup or export of this data before running it, especially if this touches anything other than a local dev database.',
      };
    },
  },
  {
    id: 'dd-command',
    test: (t) => /\bdd\s+.*\bof=/.test(t),
    build: () => ({
      title: 'Write raw data directly to a disk or file',
      severity: 'critical',
      whatItDoes: 'This copies raw bytes straight onto whatever target is listed after `of=`, overwriting everything already there, byte for byte.',
      whyRisky: 'If the target is the wrong disk (e.g. your main drive instead of a USB stick), this can destroy the entire operating system with no warning and no undo.',
      checkpointHelps: false,
      suggestion: 'Triple-check the `of=` target is the intended device, not your main disk, before approving.',
    }),
  },
  {
    id: 'mkfs-command',
    test: (t) => /\bmkfs(\.\w+)?\s+/.test(t),
    build: () => ({
      title: 'Format a drive or partition',
      severity: 'critical',
      whatItDoes: 'This erases a drive or partition and writes a fresh, empty filesystem onto it.',
      whyRisky: 'Everything currently on that drive or partition is destroyed, and there\'s no undo.',
      checkpointHelps: false,
      suggestion: 'Confirm the exact device path before approving — formatting the wrong one is unrecoverable.',
    }),
  },
  {
    id: 'sudo-destructive',
    test: (t) => /\bsudo\s+(rm\s|dd\s|mkfs|shutdown\b|reboot\b|kill\s+-9\s+1\b)/.test(t),
    build: () => ({
      title: 'Run a destructive command with admin privileges',
      severity: 'high',
      whatItDoes: 'This runs a command that deletes files, writes raw disk data, or restarts the system, with full admin permissions that can touch anything, not just this project.',
      whyRisky: 'The admin privileges remove the normal safety limits that would otherwise stop it from touching system files outside this project.',
      checkpointHelps: false,
      suggestion: 'Make sure the command and its target are exactly what you intend — admin privileges mean no permission error will stop a mistake.',
    }),
  },
  {
    id: 'docker-prune',
    test: (t) => /\bdocker\s+(system\s+prune|volume\s+(rm|prune)|image\s+prune)\b/.test(t),
    build: (t) => {
      const isVolume = /volume/.test(t);
      return {
        title: isVolume ? 'Delete Docker volumes' : 'Delete unused Docker data',
        severity: isVolume ? 'high' : 'medium',
        whatItDoes: isVolume
          ? 'This deletes Docker volumes, which is where containers usually store persistent data (like a database\'s actual files).'
          : 'This deletes Docker images, containers, or build cache that aren\'t currently in use.',
        whyRisky: isVolume
          ? 'If any volume holds data you care about (like a local database), that data is gone once the volume is removed.'
          : 'Anything not actively running is treated as safe to remove, which occasionally includes things you meant to keep around.',
        checkpointHelps: false,
        suggestion: isVolume ? 'Check which volumes exist first with `docker volume ls` before removing any.' : 'Run with `--dry-run` if your Docker version supports it, or review `docker system df` first.',
      };
    },
  },
  {
    id: 'kubectl-delete',
    test: (t) => /\bkubectl\s+delete\b/.test(t),
    build: (t) => {
      const broad = /--all\b/.test(t) || /-A\b/.test(t) || /--all-namespaces\b/.test(t);
      return {
        title: broad ? 'Delete resources across a whole cluster or namespace' : 'Delete a Kubernetes resource',
        severity: broad ? 'critical' : 'medium',
        whatItDoes: 'This removes a resource (like a deployment, pod, or service) from a live Kubernetes cluster.',
        whyRisky: broad
          ? 'This targets everything matching, potentially across an entire namespace or cluster, not a single resource — that can take down a running service.'
          : 'If this is a production cluster, removing the wrong resource can cause a real outage.',
        checkpointHelps: false,
        suggestion: 'Confirm which cluster and namespace your current context points to (`kubectl config current-context`) before approving.',
      };
    },
  },
  {
    id: 'terraform-destroy',
    test: (t) => /\bterraform\s+destroy\b/.test(t),
    build: () => ({
      title: 'Tear down real infrastructure',
      severity: 'critical',
      whatItDoes: 'This deletes every cloud resource Terraform is currently managing for this project (servers, databases, storage, etc.).',
      whyRisky: 'If this points at a production environment, it can delete live infrastructure and data with no local undo.',
      checkpointHelps: false,
      suggestion: 'Run `terraform plan -destroy` first and confirm which environment/workspace this is targeting.',
    }),
  },
  {
    id: 'npm-publish',
    test: (t) => /\b(npm|yarn|pnpm)\s+(publish|unpublish)\b/.test(t),
    build: (t) => {
      const isUnpublish = /unpublish/.test(t);
      return {
        title: isUnpublish ? 'Remove a package version from the public registry' : 'Publish a package to the public registry',
        severity: 'medium',
        whatItDoes: isUnpublish
          ? 'This removes a package (or version) from the public package registry for anyone who depends on it.'
          : 'This uploads the current package publicly, where anyone can install it — this can\'t be quietly taken back.',
        whyRisky: isUnpublish
          ? 'Projects that depend on that exact version can break immediately once it\'s removed.'
          : 'Once published, the package name and version are public; even removing it later usually still reserves the name and can break dependents.',
        checkpointHelps: false,
        suggestion: 'Double-check the package name, version, and registry (public vs. private) before approving.',
      };
    },
  },
  {
    id: 'find-delete',
    test: (t) => /\bfind\s+.*-delete\b/.test(t),
    build: () => ({
      title: 'Bulk-delete files matched by a search',
      severity: 'high',
      whatItDoes: 'This searches for files matching some pattern and deletes every match, all at once.',
      whyRisky: 'If the search pattern is broader than intended, it silently deletes anything that happens to match, with no per-file confirmation.',
      checkpointHelps: true,
      suggestion: 'Drop `-delete` and run the same `find` first to see exactly what it would match.',
    }),
  },
  {
    id: 'disk-device-redirect',
    test: (t) => />\s*\/dev\/(sd|nvme|hd|disk)/.test(t),
    build: () => ({
      title: 'Write directly to a raw disk device',
      severity: 'critical',
      whatItDoes: 'This sends output straight to a raw disk device instead of a normal file.',
      whyRisky: 'Writing to the wrong device can destroy a filesystem or the operating system itself, with no undo.',
      checkpointHelps: false,
      suggestion: 'Confirm this device path is really the intended target, not your main disk.',
    }),
  },
];

/**
 * Returns the first matching risk pattern's full detail object (with `id`
 * merged in), or `null` if the command doesn't match anything known.
 */
function assessRisk(command) {
  if (typeof command !== 'string' || !command.trim()) return null;
  for (const pattern of PATTERNS) {
    if (pattern.test(command)) {
      return Object.assign({ id: pattern.id }, pattern.build(command));
    }
  }
  return null;
}

module.exports = { assessRisk, PATTERNS };

// Allow `echo "<command>" | node lib/risk-patterns.js` for manual/skill use,
// mirroring lib/classify.js.
if (require.main === module) {
  let data = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => {
    const result = assessRisk(data);
    process.stdout.write(JSON.stringify(result));
  });
}
