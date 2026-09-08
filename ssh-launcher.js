const { spawn, execSync } = require('child_process');
const fs = require('fs');

class SshLauncher {
  constructor() {
    this.detectedTerminal = null;
  }

  // Detect available terminal emulator on Linux
  _detectLinuxTerminal() {
    if (this.detectedTerminal) return this.detectedTerminal;

    const commonTerminals = [
      { name: 'gnome-terminal', cmd: 'gnome-terminal', args: ['--', 'bash', '-c'] },
      { name: 'konsole', cmd: 'konsole', args: ['-e', 'bash', '-c'] },
      { name: 'xfce4-terminal', cmd: 'xfce4-terminal', args: ['-e', 'bash -c "$CMD"'] }, // custom handling
      { name: 'kitty', cmd: 'kitty', args: ['--', 'bash', '-c'] },
      { name: 'alacritty', cmd: 'alacritty', args: ['-e', 'bash', '-c'] },
      { name: 'xterm', cmd: 'xterm', args: ['-e', 'bash', '-c'] }
    ];

    for (const term of commonTerminals) {
      try {
        // Use which to check if it exists on path
        execSync(`which ${term.cmd}`, { stdio: 'ignore' });
        this.detectedTerminal = term;
        console.log(`SSH Launcher: Detected terminal ${term.name}`);
        return term;
      } catch (e) {
        // Continue searching
      }
    }

    // Default fallback to xterm
    this.detectedTerminal = { name: 'xterm', cmd: 'xterm', args: ['-e', 'bash', '-c'] };
    return this.detectedTerminal;
  }

  // Build the SSH command string
  buildSshCommand(login) {
    const { host, port, username, keyPath, extraOptions, jumps } = login;
    
    let sshCmd = 'ssh';
    
    // Add extra custom options if provided
    if (extraOptions && extraOptions.trim()) {
      sshCmd += ` ${extraOptions.trim()}`;
    }
    
    // Add private key if provided
    if (keyPath && keyPath.trim()) {
      // Escape spaces in path
      sshCmd += ` -i "${keyPath.trim()}"`;
    }

    // Add jumps (-J option) if there are any
    if (jumps && Array.isArray(jumps) && jumps.length > 0) {
      const jumpStrings = jumps.map(jump => {
        let jStr = '';
        if (jump.username && jump.username.trim()) {
          jStr += `${jump.username.trim()}@`;
        }
        jStr += jump.host.trim();
        if (jump.port && jump.port.toString().trim() !== '22') {
          jStr += `:${jump.port.toString().trim()}`;
        }
        return jStr;
      });
      sshCmd += ` -J ${jumpStrings.join(',')}`;
    }

    // Add target port if not default 22
    if (port && port.toString().trim() !== '22') {
      sshCmd += ` -p ${port.toString().trim()}`;
    }

    // Add username and destination host
    if (username && username.trim()) {
      sshCmd += ` ${username.trim()}@${host.trim()}`;
    } else {
      sshCmd += ` ${host.trim()}`;
    }

    return sshCmd;
  }

  // Spawn terminal window with SSH command
  launch(login) {
    const sshCmd = this.buildSshCommand(login);
    const platform = process.platform;

    console.log(`SSH Launcher: Launching SSH on platform ${platform}: ${sshCmd}`);

    if (platform === 'linux') {
      const term = this._detectLinuxTerminal();
      
      let executeCmd = sshCmd;
      if (login.password && login.password.trim()) {
        try {
          execSync('which sshpass', { stdio: 'ignore' });
          const escapedPassword = login.password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          executeCmd = `export SSHPASS="${escapedPassword}"; sshpass -e ${sshCmd}`;
        } catch (e) {
          console.log("SSH Launcher: sshpass not found, falling back to manual password entry.");
        }
      }

      // Wraps SSH command so that terminal stays open on disconnect/error
      const wrappedCmd = `${executeCmd}; echo; echo "SSH Session finished."; read -p "Press Enter to close window..."`;
      
      let spawnArgs;
      if (term.name === 'xfce4-terminal') {
        spawnArgs = ['-e', `bash -c "${wrappedCmd.replace(/"/g, '\\"')}"`];
      } else {
        spawnArgs = [...term.args, wrappedCmd];
      }

      console.log(`SSH Launcher: Spawning ${term.cmd} with args`, spawnArgs);
      const child = spawn(term.cmd, spawnArgs, {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return true;

    } else if (platform === 'darwin') {
      let executeCmd = sshCmd;
      if (login.password && login.password.trim()) {
        try {
          execSync('which sshpass', { stdio: 'ignore' });
          const escapedPassword = login.password.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          executeCmd = `export SSHPASS="${escapedPassword}"; sshpass -e ${sshCmd}`;
        } catch (e) {
          // fallback
        }
      }

      // macOS AppleScript to open a Terminal window
      const wrappedCmd = `${executeCmd}; echo; echo \\"SSH Session finished.\\"; read -p \\"Press Enter to close window...\\"`;
      const appleScript = `tell application "Terminal" to do script "${wrappedCmd.replace(/"/g, '\\"')}"\ntell application "Terminal" to activate`;
      
      const child = spawn('osascript', ['-e', appleScript], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      return true;

    } else if (platform === 'win32') {
      // Windows cmd start command
      // cmd.exe /c start cmd.exe /c "ssh ... & pause"
      const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/c', `${sshCmd} & pause`], {
        detached: true,
        stdio: 'ignore',
        shell: true
      });
      child.unref();
      return true;
    } else {
      throw new Error(`Unsupported operating system platform: ${platform}`);
    }
  }
}

module.exports = new SshLauncher();
