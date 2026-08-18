'use strict';
const assert = require('assert');
const { assessRisk } = require('../lib/risk-patterns.js');

const cases = [
  { cmd: 'rm -rf node_modules', expect: 'rm-recursive' },
  { cmd: 'rm -r ./build', expect: 'rm-recursive' },
  { cmd: 'rm -rf /', expect: 'rm-recursive' },
  { cmd: 'rm -rf ~', expect: 'rm-recursive' },
  { cmd: 'git push --force origin main', expect: 'git-force-push' },
  { cmd: 'git push -f', expect: 'git-force-push' },
  { cmd: 'git push --force-with-lease origin main', expect: null },
  { cmd: 'git reset --hard HEAD~3', expect: 'git-reset-hard' },
  { cmd: 'git clean -fd', expect: 'git-clean-force' },
  { cmd: 'git clean -fdx', expect: 'git-clean-force' },
  { cmd: 'git branch -D feature/old', expect: 'git-branch-force-delete' },
  { cmd: 'git push origin --delete feature/old', expect: 'git-push-delete-remote-branch' },
  { cmd: 'git push origin :feature/old', expect: 'git-push-delete-remote-branch' },
  { cmd: 'chmod -R 777 .', expect: 'chmod-recursive' },
  { cmd: 'chmod -R 755 ./scripts', expect: 'chmod-recursive' },
  { cmd: 'chown -R www-data:www-data /var/www', expect: 'chown-recursive' },
  { cmd: 'psql -c "DROP TABLE users;"', expect: 'sql-drop-or-truncate' },
  { cmd: 'mysql -e "DROP DATABASE prod;"', expect: 'sql-drop-or-truncate' },
  { cmd: 'sqlite3 app.db "TRUNCATE TABLE sessions;"', expect: 'sql-drop-or-truncate' },
  { cmd: 'dd if=/dev/zero of=/dev/sda bs=1M', expect: 'dd-command' },
  { cmd: 'mkfs.ext4 /dev/sdb1', expect: 'mkfs-command' },
  { cmd: 'sudo rm -rf /var/log/old', expect: 'sudo-destructive' },
  { cmd: 'sudo shutdown now', expect: 'sudo-destructive' },
  { cmd: 'docker system prune -a', expect: 'docker-prune' },
  { cmd: 'docker volume rm mydata', expect: 'docker-prune' },
  { cmd: 'kubectl delete pods --all -n production', expect: 'kubectl-delete' },
  { cmd: 'kubectl delete pod my-pod', expect: 'kubectl-delete' },
  { cmd: 'terraform destroy', expect: 'terraform-destroy' },
  { cmd: 'npm publish', expect: 'npm-publish' },
  { cmd: 'npm unpublish my-package@1.0.0', expect: 'npm-publish' },
  { cmd: 'find . -name "*.log" -delete', expect: 'find-delete' },
  { cmd: 'dd if=/dev/zero > /dev/sda', expect: 'disk-device-redirect' },
  { cmd: 'npm install', expect: null },
  { cmd: 'git status', expect: null },
  { cmd: 'ls -la', expect: null },
  { cmd: 'rm oldfile.txt', expect: null },
  { cmd: 'git commit -m "fix bug"', expect: null },
  { cmd: 'npm run build', expect: null },
];

let pass = 0;
for (const c of cases) {
  const result = assessRisk(c.cmd);
  const gotId = result ? result.id : null;
  const ok = gotId === c.expect;
  if (ok) {
    pass++;
  } else {
    console.log(`FAIL: expected ${c.expect}, got ${gotId} for: ${c.cmd}`);
  }
  if (result) {
    assert.ok(
      result.title && result.whatItDoes && result.whyRisky && result.suggestion && typeof result.checkpointHelps === 'boolean',
      `incomplete risk object for ${result.id}`
    );
    assert.ok(['critical', 'high', 'medium'].includes(result.severity), `bad severity for ${result.id}`);
  }
}
console.log(`${pass}/${cases.length} pattern tests passed`);

if (pass !== cases.length) process.exit(1);
console.log('ALL TESTS PASSED');
