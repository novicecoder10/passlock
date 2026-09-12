const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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
      { name: 'xfce4-terminal', cmd: 'xfce4-terminal', args: ['-e', 'bash -c "$CMD"'] },
      { name: 'kitty', cmd: 'kitty', args: ['--', 'bash', '-c'] },
      { name: 'alacritty', cmd: 'alacritty', args: ['-e', 'bash', '-c'] },
      { name: 'xterm', cmd: 'xterm', args: ['-e', 'bash', '-c'] }
    ];

    for (const term of commonTerminals) {
      try {
        execSync(`which ${term.cmd}`, { stdio: 'ignore' });
        this.detectedTerminal = term;
        console.log(`SSH Launcher: Detected terminal ${term.name}`);
        return term;
      } catch (e) {}
    }

    this.detectedTerminal = { name: 'xterm', cmd: 'xterm', args: ['-e', 'bash', '-c'] };
    return this.detectedTerminal;
  }

  // Generate python script for multi-hop sequential SSH jumps with password feeding
  _generateMultiHopPythonScript(login) {
    const hops = [];

    // Add jump hosts 1..N
    if (login.jumps && Array.isArray(login.jumps)) {
      login.jumps.forEach(j => {
        if (j.host && j.host.trim()) {
          hops.push({
            host: j.host.trim(),
            port: j.port ? parseInt(j.port) : 22,
            user: j.username ? j.username.trim() : '',
            pass: j.password || '',
            opts: j.extraOptions ? j.extraOptions.trim() : ''
          });
        }
      });
    }

    // Add final target
    hops.push({
      host: login.host.trim(),
      port: login.port ? parseInt(login.port) : 22,
      user: login.username ? login.username.trim() : '',
      pass: login.password || '',
      opts: login.extraOptions ? login.extraOptions.trim() : ''
    });

    const pyScript = `import pty, os, sys, select, tty, termios, time, re, json, shlex

hops = ${JSON.stringify(hops)}

def main():
    if not hops:
        return

    # First hop command
    h0 = hops[0]
    cmd = ["ssh", "-o", "StrictHostKeyChecking=no"]
    if h0.get("opts"):
        cmd.extend(shlex.split(h0["opts"]))
    if h0.get("port") and str(h0["port"]) != "22":
        cmd.extend(["-p", str(h0["port"])])
    if h0.get("user"):
        cmd.append(f"{h0['user']}@{h0['host']}")
    else:
        cmd.append(h0["host"])

    pid, fd = pty.fork()
    if pid == 0:
        os.execvp("ssh", cmd)
        sys.exit(0)

    old_settings = termios.tcgetattr(sys.stdin.fileno())
    try:
        tty.setraw(sys.stdin.fileno())
        hop_index = 0
        pass_sent = False
        last_action_time = time.time()
        buf = ""

        while True:
            r, w, e = select.select([sys.stdin, fd], [], [], 0.05)
            
            if fd in r:
                try:
                    data = os.read(fd, 1024)
                except OSError:
                    break
                if not data:
                    break
                
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()

                buf += data.decode('utf-8', errors='ignore')
                if len(buf) > 4096:
                    buf = buf[-2048:]

                cur_hop = hops[hop_index]

                # Check if password prompt for current hop
                if not pass_sent and cur_hop.get("pass"):
                    if re.search(r'(?:password|passphrase)\\s*:\\s*$', buf, re.IGNORECASE):
                        time.sleep(0.1)
                        os.write(fd, (cur_hop["pass"] + "\\n").encode('utf-8'))
                        pass_sent = True
                        buf = ""
                        last_action_time = time.time()

                # Check if shell prompt reached to initiate next hop!
                if hop_index < len(hops) - 1:
                    is_prompt = re.search(r'[\\$\\#\\>\\~]\\s*$', buf) or (time.time() - last_action_time > 2.0 and pass_sent)
                    if is_prompt:
                        hop_index += 1
                        next_hop = hops[hop_index]
                        pass_sent = False
                        time.sleep(0.3)
                        
                        next_cmd = "ssh -o StrictHostKeyChecking=no"
                        if next_hop.get("opts"):
                            next_cmd += f" {next_hop['opts']}"
                        if next_hop.get("port") and str(next_hop["port"]) != "22":
                            next_cmd += f" -p {next_hop['port']}"
                        if next_hop.get("user"):
                            next_cmd += f" {next_hop['user']}@{next_hop['host']}"
                        else:
                            next_cmd += f" {next_hop['host']}"
                        
                        os.write(fd, (next_cmd + "\\n").encode('utf-8'))
                        buf = ""
                        last_action_time = time.time()

            if sys.stdin in r:
                try:
                    user_input = os.read(sys.stdin.fileno(), 1024)
                except OSError:
                    break
                if not user_input:
                    break
                os.write(fd, user_input)

    finally:
        termios.tcsetattr(sys.stdin.fileno(), old_settings)

if __name__ == "__main__":
    main()
`;

    const tmpDir = fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir();
    const scriptPath = path.join(tmpDir, `.sp_jump_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.py`);
    fs.writeFileSync(scriptPath, pyScript, { mode: 0o600 });
    return scriptPath;
  }

  // Single-hop command builder
  buildSshCommand(login) {
    const { host, port, username, keyPath, extraOptions } = login;
    
    let sshCmd = 'ssh';
    
    if (extraOptions && extraOptions.trim()) {
      sshCmd += ` ${extraOptions.trim()}`;
    }
    
    if (keyPath && keyPath.trim()) {
      sshCmd += ` -i "${keyPath.trim()}"`;
    }

    if (port && port.toString().trim() !== '22') {
      sshCmd += ` -p ${port.toString().trim()}`;
    }

    if (username && username.trim()) {
      sshCmd += ` ${username.trim()}@${host.trim()}`;
    } else {
      sshCmd += ` ${host.trim()}`;
    }

    return sshCmd;
  }

  // Spawn terminal window with SSH command
  launch(login) {
    const platform = process.platform;
    const hasJumps = login.jumps && Array.isArray(login.jumps) && login.jumps.length > 0;

    console.log(`SSH Launcher: Launching SSH (hasJumps: ${hasJumps}) on platform ${platform}`);

    if (hasJumps) {
      // Use multi-hop python jumper script
      const pyScriptPath = this._generateMultiHopPythonScript(login);
      const executeCmd = `python3 "${pyScriptPath}"`;
      const cleanupCmd = `; rm -f "${pyScriptPath}"`;
      const wrappedCmd = `${executeCmd}${cleanupCmd}; echo; echo "SSH Multi-hop Session finished."; read -p "Press Enter to close window..."`;

      if (platform === 'linux') {
        const term = this._detectLinuxTerminal();
        let spawnArgs;
        if (term.name === 'xfce4-terminal') {
          spawnArgs = ['-e', `bash -c "${wrappedCmd.replace(/"/g, '\\"')}"`];
        } else {
          spawnArgs = [...term.args, wrappedCmd];
        }
        const child = spawn(term.cmd, spawnArgs, { detached: true, stdio: 'ignore' });
        child.unref();
        return true;
      } else if (platform === 'darwin') {
        const appleScript = `tell application "Terminal" to do script "${wrappedCmd.replace(/"/g, '\\"')}"\ntell application "Terminal" to activate`;
        const child = spawn('osascript', ['-e', appleScript], { detached: true, stdio: 'ignore' });
        child.unref();
        return true;
      } else {
        // Windows fallback
        const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/c', `python "${pyScriptPath}" & del "${pyScriptPath}" & pause`], { detached: true, stdio: 'ignore', shell: true });
        child.unref();
        return true;
      }
    } else {
      // Standard single-hop launch
      const sshCmd = this.buildSshCommand(login);

      if (platform === 'linux') {
        const term = this._detectLinuxTerminal();
        let executeCmd = sshCmd;
        let tempPassFile = null;

        if (login.password && login.password.trim()) {
          try {
            execSync('which sshpass', { stdio: 'ignore' });
            const tmpDir = fs.existsSync('/dev/shm') ? '/dev/shm' : os.tmpdir();
            tempPassFile = path.join(tmpDir, `.sp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
            fs.writeFileSync(tempPassFile, login.password, { mode: 0o600 });
            executeCmd = `sshpass -f "${tempPassFile}" ${sshCmd}`;
          } catch (e) {
            console.log("SSH Launcher: sshpass not found, falling back to manual password entry.");
          }
        }

        const cleanupCmd = tempPassFile ? `; rm -f "${tempPassFile}"` : '';
        const wrappedCmd = `${executeCmd}${cleanupCmd}; echo; echo "SSH Session finished."; read -p "Press Enter to close window..."`;
        
        let spawnArgs;
        if (term.name === 'xfce4-terminal') {
          spawnArgs = ['-e', `bash -c "${wrappedCmd.replace(/"/g, '\\"')}"`];
        } else {
          spawnArgs = [...term.args, wrappedCmd];
        }

        const child = spawn(term.cmd, spawnArgs, { detached: true, stdio: 'ignore' });
        child.unref();
        return true;

      } else if (platform === 'darwin') {
        let executeCmd = sshCmd;
        let tempPassFile = null;

        if (login.password && login.password.trim()) {
          try {
            execSync('which sshpass', { stdio: 'ignore' });
            const tmpDir = os.tmpdir();
            tempPassFile = path.join(tmpDir, `.sp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`);
            fs.writeFileSync(tempPassFile, login.password, { mode: 0o600 });
            executeCmd = `sshpass -f "${tempPassFile}" ${sshCmd}`;
          } catch (e) {}
        }

        const cleanupCmd = tempPassFile ? `; rm -f "${tempPassFile}"` : '';
        const wrappedCmd = `${executeCmd}${cleanupCmd}; echo; echo \\"SSH Session finished.\\"; read -p \\"Press Enter to close window...\\"`;
        const appleScript = `tell application "Terminal" to do script "${wrappedCmd.replace(/"/g, '\\"')}"\ntell application "Terminal" to activate`;
        
        const child = spawn('osascript', ['-e', appleScript], { detached: true, stdio: 'ignore' });
        child.unref();
        return true;

      } else if (platform === 'win32') {
        const child = spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/c', `${sshCmd} & pause`], { detached: true, stdio: 'ignore', shell: true });
        child.unref();
        return true;
      }
    }
  }
}

module.exports = new SshLauncher();
