const dbManager = require('./db-manager');
const sshLauncher = require('./ssh-launcher');
const apiServer = require('./server');

console.log("Loading components check...");
console.log("- DB Manager exists:", typeof dbManager === 'object');
console.log("- SSH Launcher exists:", typeof sshLauncher === 'object');
console.log("- API Server exists:", typeof apiServer === 'object');

console.log("Verifying SSH command builder syntax...");
const testLogin = {
  host: 'target-server.com',
  port: 2222,
  username: 'root',
  keyPath: '/home/user/.ssh/id_ed25519',
  extraOptions: '-v -A',
  jumps: [
    { host: 'jump1.com', username: 'bastion1', port: 22 },
    { host: 'jump2.com', username: 'bastion2', port: 2222 }
  ]
};

const cmd = sshLauncher.buildSshCommand(testLogin);
console.log("Built Command:", cmd);

const expectedCmd = 'ssh -v -A -i "/home/user/.ssh/id_ed25519" -J bastion1@jump1.com,bastion2@jump2.com:2222 -p 2222 root@target-server.com';

if (cmd === expectedCmd) {
  console.log("SUCCESS: SSH ProxyJump command built perfectly!");
} else {
  console.error("FAIL: SSH ProxyJump command mismatch!");
  console.error("Expected:", expectedCmd);
  console.error("Actual:", cmd);
  process.exit(1);
}

console.log("All imports and syntax checks passed!");
process.exit(0);
