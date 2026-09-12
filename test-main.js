const dbManager = require('./db-manager');
const sshLauncher = require('./ssh-launcher');
const apiServer = require('./server');

console.log("Loading components check...");
console.log("- DB Manager exists:", typeof dbManager === 'object');
console.log("- SSH Launcher exists:", typeof sshLauncher === 'object');
console.log("- API Server exists:", typeof apiServer === 'object');

console.log("Verifying Multi-Hop SSH launcher script generator...");
const testLogin = {
  host: 'target-server.com',
  port: 2222,
  username: 'root',
  password: 'target_password',
  keyPath: '/home/user/.ssh/id_ed25519',
  extraOptions: '-v -A',
  jumps: [
    { host: 'jump1.com', username: 'bastion1', port: 22, password: 'jump1_password' },
    { host: 'jump2.com', username: 'bastion2', port: 2222, password: 'jump2_password' }
  ]
};

const scriptPath = sshLauncher._generateMultiHopPythonScript(testLogin);
console.log("Generated Multi-Hop Python script at:", scriptPath);

const fs = require('fs');
const content = fs.readFileSync(scriptPath, 'utf8');
if (content.includes('jump1_password') && content.includes('jump2_password') && content.includes('target_password')) {
  console.log("SUCCESS: Multi-Hop python jumper created with passwords for all jump hosts!");
} else {
  console.error("FAIL: Passwords missing in multi-hop script!");
  process.exit(1);
}

fs.unlinkSync(scriptPath);

console.log("All imports and syntax checks passed!");
process.exit(0);
