import React, { useState, useRef, useEffect } from 'react';
import { useOS } from '../../context/OSContext';
import { PORTFOLIO_USER, PROJECTS_DATA, EXPERIENCES, EDUCATION } from '../../data/portfolioData';
import { formatDateTime } from '../../utils/dateTime';
import { usePublishedProfile } from '../../hooks/usePublishedProfile';

interface HistoryLine {
  text: string;
  type: 'input' | 'output' | 'error' | 'success' | 'info';
}

export const TerminalApp: React.FC = () => {
  const { siteSettings } = usePublishedProfile();
  const {
    openApp,
    closeWindow,
    windows,
    files,
    createFolder,
    createFile,
    deleteFile,
    triggerBsod,
    toggleMatrixMode,
    settings,
  } = useOS();

  const [input, setInput] = useState('');
  const [currentDir, setCurrentDir] = useState('D:\\Desktop');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const [lines, setLines] = useState<HistoryLine[]>([
    { text: 'Microsoft Windows 11 Portfolio OS', type: 'output' },
    { text: '(c) Microsoft Corporation. All rights reserved.', type: 'output' },
    { text: '', type: 'output' },
    { text: 'Windows PowerShell / Portfolio CLI Environment', type: 'info' },
    { text: 'Type "help" to view all available commands & navigation shortcuts.', type: 'success' },
    { text: '', type: 'output' },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Normalize path to forward slashes for internal file system lookup
  const toUnixPath = (winPath: string) => winPath.replace(/\\/g, '/').replace(/\/$/, '');
  const toWinPath = (unixPath: string) => unixPath.replace(/\//g, '\\');

  const handleCommand = (cmdStr: string) => {
    const trimmed = cmdStr.trim();
    if (!trimmed) return;

    setCmdHistory((prev) => [...prev, trimmed]);
    setHistoryIndex(-1);

    const newLines: HistoryLine[] = [
      ...lines,
      { text: `${currentDir}> ${trimmed}`, type: 'input' },
    ];

    // Handle redirection (e.g., echo "hello" > test.txt)
    if (trimmed.includes('>')) {
      const parts = trimmed.split('>');
      const left = parts[0].trim();
      const filename = parts[1].trim();

      if (left.startsWith('echo ') && filename) {
        const content = left.slice(5).replace(/^["']|["']$/g, '');
        const parentPath = toUnixPath(currentDir);
        createFile(parentPath, filename, content, filename.split('.').pop() as any || 'txt');
        newLines.push({ text: `Created file "${filename}" in ${currentDir}`, type: 'success' });
        setLines(newLines);
        setInput('');
        return;
      }
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
      case '?':
        newLines.push({
          text: `========================================================================
                 WINDOWS 11 PORTFOLIO TERMINAL COMMANDS
========================================================================
[Navigation & File System]
  cd .              - Current directory (stay in place)
  cd ..             - Navigate to parent directory
  cd \\ / cd /       - Navigate to root directory (C:\\)
  cd ~              - Navigate to the D: desktop folder (D:\\Desktop)
  cd <folder>       - Navigate into subfolder (e.g. "cd Documents", "cd ..\\Public")
  pwd               - Print current working directory path
  dir / ls          - List files and directories in current folder
  cat / type <file> - Display content of a file in terminal
  mkdir / md <name> - Create a new directory
  touch <name>      - Create a new empty text file
  rm / del <file>   - Delete a file

[Portfolio Information]
  about             - Summary of background, role, and location
  skills            - Technical skills, languages, and frameworks
  projects          - Featured software projects and repositories
  experience        - Career timeline and work experience
  education         - Academic degrees, honors, and institutions
  contact           - Email, GitHub, LinkedIn, and social links
  resume            - View career highlights & open Resume viewer

[System Utilities & Applications]
  whoami            - Current logged-in user profile
  date / time       - Current system date and timestamp
  ver / winver      - Windows OS version
  ipconfig          - Network interface parameters
  systeminfo        - System hardware specs and portfolio environment
  calc / calculator - Launch Windows Calculator app
  notepad [file]    - Launch Notepad editor
  explorer [path]   - Open File Explorer at path
  settings [tab]    - Open Settings (home, personalization, taskbar, system, about)
  ping <host>       - Ping network host (e.g. ping google.com)
  curl / fetch <url>- Simulate network HTTP request
  history           - Display terminal command history
  cls / clear       - Clear terminal screen
  matrix            - Toggle Matrix rain visual mode
  bsod              - Simulate Blue Screen of Death
  snake             - Launch Retro Snake arcade game
  minesweeper       - Launch Minesweeper puzzle game
  exit              - Close terminal window`,
          type: 'output',
        });
        break;

      case 'cd': {
        const target = args.join(' ').trim();
        if (!target || target === '.') {
          // cd . -> Stay in place
          newLines.push({ text: `Current directory: ${currentDir}`, type: 'output' });
        } else if (target === '..') {
          // cd .. -> Go to parent
          const unix = toUnixPath(currentDir);
          const lastSlash = unix.lastIndexOf('/');
          if (lastSlash > 1) {
            const parent = unix.substring(0, lastSlash);
            setCurrentDir(toWinPath(parent));
          } else if (unix.includes('/') && lastSlash === 2) {
            // Move from a drive subfolder to its root.
            setCurrentDir(unix.substring(0, 2) + '\\');
          } else {
            newLines.push({ text: 'Already at root directory.', type: 'output' });
          }
        } else if (target === '~' || target === '%userprofile%') {
          setCurrentDir('D:\\Desktop');
        } else if (target === '/' || target === '\\' || target.toLowerCase() === 'c:' || target.toLowerCase() === 'c:\\') {
          setCurrentDir('C:\\');
        } else if (target.toLowerCase() === 'd:' || target.toLowerCase() === 'd:\\') {
          setCurrentDir('D:\\');
        } else {
          // Resolve relative or absolute target folder
          let resolvedUnix = target.startsWith('C:') || target.startsWith('D:')
            ? toUnixPath(target)
            : `${toUnixPath(currentDir)}/${target}`.replace(/\/\//g, '/');

          // Normalize .. in path
          const pathSegments = resolvedUnix.split('/');
          const stack: string[] = [];
          for (const seg of pathSegments) {
            if (seg === '..') {
              if (stack.length > 1) stack.pop();
            } else if (seg !== '.' && seg !== '') {
              stack.push(seg);
            }
          }
          const finalUnix = stack.join('/');

          // Check if directory exists in virtual filesystem
          const folderExists = files.some(
            (f) => f.type === 'folder' && (toUnixPath(f.path).toLowerCase() === finalUnix.toLowerCase() || f.path.toLowerCase() === finalUnix.toLowerCase())
          ) || finalUnix === 'C:' || finalUnix === 'D:';

          if (folderExists) {
            setCurrentDir(toWinPath(finalUnix));
          } else {
            newLines.push({
              text: `The system cannot find the path specified: "${target}"`,
              type: 'error',
            });
          }
        }
        break;
      }

      case 'pwd':
        newLines.push({ text: currentDir, type: 'output' });
        break;

      case 'dir':
      case 'ls': {
        const unixCurr = toUnixPath(currentDir);
        const dirFiles = files.filter((f) => {
          const p = toUnixPath(f.parentId);
          return p.toLowerCase() === unixCurr.toLowerCase();
        });

        newLines.push({ text: ` Directory of ${currentDir}\n`, type: 'output' });
        if (dirFiles.length === 0) {
          newLines.push({ text: '  (Directory is empty)', type: 'output' });
        } else {
          dirFiles.forEach((f) => {
            const isDir = f.type === 'folder';
            const sizeStr = isDir ? '<DIR>          ' : (f.size || '1.0 KB').padStart(14, ' ') + ' ';
            const modDate = f.modified || '2026-08-14';
            newLines.push({
              text: `  ${modDate}   ${sizeStr}  ${f.name}`,
              type: isDir ? 'info' : 'output',
            });
          });
          newLines.push({
            text: `\n              ${dirFiles.filter((f) => f.type === 'file').length} File(s)
              ${dirFiles.filter((f) => f.type === 'folder').length} Dir(s)`,
            type: 'output',
          });
        }
        break;
      }

      case 'cat':
      case 'type': {
        const filename = args.join(' ').trim();
        if (!filename) {
          newLines.push({ text: 'Usage: cat <filename> or type <filename>', type: 'error' });
          break;
        }
        const unixCurr = toUnixPath(currentDir);
        const targetFile = files.find(
          (f) =>
            toUnixPath(f.parentId).toLowerCase() === unixCurr.toLowerCase() &&
            f.name.toLowerCase() === filename.toLowerCase() &&
            f.type === 'file'
        );

        if (targetFile) {
          newLines.push({
            text: targetFile.content || `[Binary or Encrypted Document: ${targetFile.name}]`,
            type: 'output',
          });
        } else {
          newLines.push({
            text: `File not found: "${filename}" in ${currentDir}`,
            type: 'error',
          });
        }
        break;
      }

      case 'mkdir':
      case 'md': {
        const dirName = args.join(' ').trim();
        if (!dirName) {
          newLines.push({ text: 'Usage: mkdir <folder_name>', type: 'error' });
          break;
        }
        const parentPath = toUnixPath(currentDir);
        createFolder(parentPath, dirName);
        newLines.push({ text: `Directory created: ${dirName}`, type: 'success' });
        break;
      }

      case 'touch': {
        const fileName = args.join(' ').trim();
        if (!fileName) {
          newLines.push({ text: 'Usage: touch <filename>', type: 'error' });
          break;
        }
        const parentPath = toUnixPath(currentDir);
        createFile(parentPath, fileName, '', fileName.split('.').pop() as any || 'txt');
        newLines.push({ text: `File created: ${fileName}`, type: 'success' });
        break;
      }

      case 'rm':
      case 'del': {
        const fileName = args.join(' ').trim();
        if (!fileName) {
          newLines.push({ text: 'Usage: del <filename>', type: 'error' });
          break;
        }
        const unixCurr = toUnixPath(currentDir);
        const target = files.find(
          (f) =>
            toUnixPath(f.parentId).toLowerCase() === unixCurr.toLowerCase() &&
            f.name.toLowerCase() === fileName.toLowerCase()
        );
        if (target) {
          deleteFile(target.id);
          newLines.push({ text: `Deleted "${fileName}"`, type: 'success' });
        } else {
          newLines.push({ text: `File not found: "${fileName}"`, type: 'error' });
        }
        break;
      }

      case 'about':
        newLines.push({
          text: `=======================================================
DEVELOPER PROFILE: ${PORTFOLIO_USER.name.toUpperCase()}
=======================================================
Title:    ${PORTFOLIO_USER.title}
Location: ${PORTFOLIO_USER.location}
Email:    ${PORTFOLIO_USER.email}
GitHub:   ${PORTFOLIO_USER.github}

BIO:
${PORTFOLIO_USER.bio}`,
          type: 'output',
        });
        break;

      case 'skills':
        openApp('about');
        newLines.push({ text: 'Open About Me to browse the database-managed Skills & Toolkit.', type: 'info' });
        break;

      case 'projects':
        newLines.push({ text: '================ FEATURED PORTFOLIO PROJECTS ================\n', type: 'info' });
        PROJECTS_DATA.forEach((p, idx) => {
          newLines.push({
            text: `${idx + 1}. ${p.title} [${p.category}] ${p.featured ? '★ FEATURED' : ''}
   Tagline: ${p.tagline}
   Stack:   ${p.technologies.join(', ')}
   GitHub:  ${p.githubUrl || 'N/A'}\n`,
            type: 'output',
          });
        });
        break;

      case 'experience':
        newLines.push({ text: '================ WORK HISTORY & EXPERIENCE ================\n', type: 'info' });
        EXPERIENCES.forEach((exp) => {
          newLines.push({
            text: `► ${exp.role} @ ${exp.company} (${exp.period}) - ${exp.location}
   Skills: ${exp.skills.join(', ')}
   Highlights:
${exp.description.map((d) => `     - ${d}`).join('\n')}\n`,
            type: 'output',
          });
        });
        break;

      case 'education':
        newLines.push({ text: '================ EDUCATION & CREDENTIALS ================\n', type: 'info' });
        EDUCATION.forEach((edu) => {
          newLines.push({
            text: `🎓 ${edu.degree}
   ${edu.institution} (${edu.period})
   Details: ${edu.details}\n`,
            type: 'output',
          });
        });
        break;

      case 'contact':
        newLines.push({
          text: `================ GET IN TOUCH ================\nEmail:    ${PORTFOLIO_USER.email}\nGitHub:   ${PORTFOLIO_USER.github}\nLinkedIn: ${PORTFOLIO_USER.linkedin}`,
          type: 'output',
        });
        break;

      case 'resume':
        openApp('resume');
        newLines.push({ text: 'Opening Resume Application Viewer...', type: 'success' });
        break;

      case 'whoami':
        newLines.push({ text: 'ANISH-PORTFOLIO-PC\\Anish Jethva (Administrator)', type: 'success' });
        break;

      case 'date':
      case 'time':
        newLines.push({ text: `${formatDateTime(new Date(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })} IST`, type: 'output' });
        break;

      case 'ver':
      case 'winver':
        newLines.push({ text: `Windows 11 Portfolio OS v${siteSettings.portfolioVersion || '1.0.0'}`, type: 'output' });
        break;

      case 'hostname':
        newLines.push({ text: 'ANISH-PORTFOLIO-PC', type: 'output' });
        break;

      case 'ipconfig':
        newLines.push({
          text: `Windows IP Configuration

Ethernet adapter vEthernet (Default Switch):
   Connection-specific DNS Suffix  . : localdomain
   IPv4 Address. . . . . . . . . . . : 192.168.1.142
   Subnet Mask . . . . . . . . . . . : 255.255.255.0
   Default Gateway . . . . . . . . . : 192.168.1.1

Wireless LAN adapter Wi-Fi:
   Media State . . . . . . . . . . . : ${settings.wifiEnabled ? 'Media connected' : 'Media disconnected'}
   IPv4 Address. . . . . . . . . . . : ${settings.wifiEnabled ? '10.0.0.88' : 'N/A'}`,
          type: 'output',
        });
        break;

      case 'systeminfo':
        newLines.push({
          text: `Host Name:                 ANISH-PORTFOLIO-PC
OS Name:                   Microsoft Windows 11 Pro
Portfolio Release:         v${siteSettings.portfolioVersion || '1.0.0'}
System Type:               x64-based PC
Processor(s):              12 Gen Intel(R) Core(TM) i9-12900K @ 3.20GHz
Total Physical Memory:     32,674 MB
Available Physical Memory: 21,430 MB
Virtual Storage:           472 GB High-Speed NVMe SSD
UI Environment:            React 19, TypeScript, Tailwind CSS, Lucide
Current Theme:             ${settings.theme.toUpperCase()} (${settings.wallpaper.toUpperCase()})`,
          type: 'output',
        });
        break;

      case 'calc':
      case 'calculator':
        openApp('calculator');
        newLines.push({ text: 'Opening Calculator...', type: 'success' });
        break;

      case 'notepad': {
        const fileParam = args.join(' ');
        if (fileParam) {
          openApp('notepad', { filePath: `${toUnixPath(currentDir)}/${fileParam}` });
        } else {
          openApp('notepad');
        }
        newLines.push({ text: 'Opening Notepad...', type: 'success' });
        break;
      }

      case 'explorer':
        openApp('explorer', { path: toUnixPath(currentDir) });
        newLines.push({ text: `Opening File Explorer at "${currentDir}"...`, type: 'success' });
        break;

      case 'settings': {
        const tab = args[0] || 'home';
        openApp('settings', { tab });
        newLines.push({ text: `Opening Settings (${tab})...`, type: 'success' });
        break;
      }

      case 'ping': {
        const host = args[0] || 'google.com';
        newLines.push({
          text: `Pinging ${host} [142.250.190.46] with 32 bytes of data:
Reply from 142.250.190.46: bytes=32 time=14ms TTL=117
Reply from 142.250.190.46: bytes=32 time=12ms TTL=117
Reply from 142.250.190.46: bytes=32 time=15ms TTL=117
Reply from 142.250.190.46: bytes=32 time=13ms TTL=117

Ping statistics for 142.250.190.46:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 12ms, Maximum = 15ms, Average = 13ms`,
          type: 'output',
        });
        break;
      }

      case 'curl':
      case 'fetch': {
        const url = args[0] || 'https://api.github.com/users/anishjethva18';
        newLines.push({
          text: `HTTP/2 200 OK
content-type: application/json; charset=utf-8
server: GitHub.com

{
  "login": "anishjethva18",
  "name": "${PORTFOLIO_USER.name}",
  "bio": "${PORTFOLIO_USER.title}",
  "public_repos": 38,
  "followers": 1420,
  "status": "Online & Available for Opportunities"
}`,
          type: 'output',
        });
        break;
      }

      case 'history': {
        const subCmd = (args[0] || '').toLowerCase();
        if (subCmd === '-c' || subCmd === 'clear') {
          setCmdHistory([]);
          newLines.push({ text: 'Command history cleared successfully.', type: 'info' });
        } else if (cmdHistory.length === 0) {
          newLines.push({
            text: 'No command history recorded yet in this session. Run commands (e.g. "help", "dir", "whoami") to build history.',
            type: 'info',
          });
        } else {
          newLines.push({
            text: `Command history (${cmdHistory.length} entry${cmdHistory.length > 1 ? 's' : ''}):`,
            type: 'info',
          });
          cmdHistory.forEach((cmd, i) => {
            newLines.push({ text: `  ${String(i + 1).padStart(3, ' ')}  ${cmd}`, type: 'output' });
          });
        }
        break;
      }

      case 'clear':
      case 'cls':
        setLines([]);
        setInput('');
        return;

      case 'echo':
        newLines.push({ text: args.join(' '), type: 'output' });
        break;

      case 'matrix':
        toggleMatrixMode();
        newLines.push({ text: 'Matrix rain mode toggled!', type: 'success' });
        break;

      case 'bsod':
        triggerBsod();
        break;

      case 'snake':
        openApp('snake');
        newLines.push({ text: 'Launching Retro Snake...', type: 'success' });
        break;

      case 'minesweeper':
        openApp('minesweeper');
        newLines.push({ text: 'Launching Minesweeper...', type: 'success' });
        break;

      case 'exit': {
        const termWin = windows.find((w) => w.appId === 'terminal');
        if (termWin) closeWindow(termWin.id);
        return;
      }

      default:
        newLines.push({
          text: `'${command}' is not recognized as an internal or external command, operable program or batch file.
Type "help" to see the list of available commands.`,
          type: 'error',
        });
        break;
    }

    setLines(newLines);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length > 0) {
        const nextIdx = historyIndex < cmdHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(nextIdx);
        setInput(cmdHistory[cmdHistory.length - 1 - nextIdx] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInput(cmdHistory[cmdHistory.length - 1 - nextIdx] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Simple autocomplete
      const commands = [
        'help', 'about', 'skills', 'projects', 'experience', 'education', 'contact', 'resume',
        'cd', 'pwd', 'dir', 'ls', 'cat', 'type', 'mkdir', 'touch', 'del', 'clear', 'cls',
        'calc', 'notepad', 'explorer', 'settings', 'matrix', 'bsod', 'snake', 'minesweeper', 'exit'
      ];
      const match = commands.find((c) => c.startsWith(input.toLowerCase()));
      if (match) setInput(match + ' ');
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-slate-900 dark:bg-[#0c0c0c] text-slate-100 font-mono text-xs p-3.5 select-text overflow-y-auto"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="space-y-1">
        {lines.map((line, idx) => (
          <div
            key={idx}
            className={`whitespace-pre-wrap leading-relaxed ${
              line.type === 'input'
                ? 'text-white font-bold'
                : line.type === 'error'
                ? 'text-rose-400'
                : line.type === 'success'
                ? 'text-emerald-400 font-semibold'
                : line.type === 'info'
                ? 'text-cyan-400'
                : 'text-slate-300'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      {/* Input Prompt Line */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-emerald-400 font-bold shrink-0">{currentDir}&gt;</span>
        <input
          ref={inputRef}
          id="terminal-input"
          type="text"
          value={input || ''}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-white focus:outline-none caret-emerald-400 font-mono"
          autoFocus
        />
      </div>

      <div ref={bottomRef} />
    </div>
  );
};
