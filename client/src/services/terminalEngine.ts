import { FileItem } from '../types';
import { formatDateISO, formatDateTime } from '../utils/dateTime';

export interface TerminalState {
  currentPath: string;
  env: Record<string, string>;
  aliases: Record<string, string>;
  history: string[];
}

export interface ExecutionResult {
  output: string;
  newPath?: string;
  error?: boolean;
  clearScreen?: boolean;
  createdOrModifiedFiles?: boolean;
}

export class TerminalEngine {
  private state: TerminalState;
  private files: FileItem[];
  private setFilesCallback: (files: FileItem[]) => void;
  private openAppCallback?: (appId: any, args?: any) => void;

  constructor(
    initialPath: string,
    files: FileItem[],
    setFilesCallback: (files: FileItem[]) => void,
    openAppCallback?: (appId: any, args?: any) => void
  ) {
    this.files = files;
    this.setFilesCallback = setFilesCallback;
    this.openAppCallback = openAppCallback;

    this.state = {
      currentPath: initialPath || 'D:/Desktop',
      env: {
        USER: 'Anish Jethva',
        HOME: 'D:/Desktop',
        PATH: 'D:/Applications',
        OS: 'Windows_NT_11.0_x64',
        SHELL: 'powershell.exe / bash',
        LANG: 'en_US.UTF-8',
        TERM: 'xterm-256color',
      },
      aliases: {
        ll: 'ls -la',
        la: 'ls -a',
        cls: 'clear',
        dir: 'ls',
        del: 'rm',
        copy: 'cp',
        ren: 'mv',
        type: 'cat',
        md: 'mkdir',
        rd: 'rm -r',
      },
      history: [],
    };
  }

  public updateFiles(files: FileItem[]) {
    this.files = files;
  }

  public getState(): TerminalState {
    return this.state;
  }

  public getPrompt(): string {
    const user = this.state.env.USER.toLowerCase().replace(/\s+/g, '');
    const pathDisp = this.state.currentPath.replace(this.state.env.HOME, '~');
    return `${user}@win11:${pathDisp}$`;
  }

  /**
   * Main Execute Entry Point with Chaining (&&, ||, ;) support
   */
  public async execute(rawCommandLine: string): Promise<ExecutionResult> {
    const cmdTrimmed = rawCommandLine.trim();
    if (!cmdTrimmed) return { output: '' };

    this.state.history.push(cmdTrimmed);

    // Command chaining: handle ';' or '&&'
    if (cmdTrimmed.includes('&&')) {
      const parts = cmdTrimmed.split('&&');
      let combinedOutput = '';
      for (const part of parts) {
        const res = await this.executeSinglePipeline(part.trim());
        combinedOutput += (combinedOutput ? '\n' : '') + res.output;
        if (res.error) {
          return { output: combinedOutput, error: true };
        }
      }
      return { output: combinedOutput };
    }

    if (cmdTrimmed.includes(';')) {
      const parts = cmdTrimmed.split(';');
      let combinedOutput = '';
      for (const part of parts) {
        if (!part.trim()) continue;
        const res = await this.executeSinglePipeline(part.trim());
        combinedOutput += (combinedOutput ? '\n' : '') + res.output;
      }
      return { output: combinedOutput };
    }

    return this.executeSinglePipeline(cmdTrimmed);
  }

  /**
   * Execute Pipeline with Piping (|) and Redirections (>, >>)
   */
  private async executeSinglePipeline(pipelineStr: string): Promise<ExecutionResult> {
    // Check Redirection
    let redirectTarget: string | null = null;
    let isAppend = false;
    let actualCommand = pipelineStr;

    if (pipelineStr.includes('>>')) {
      const [cmd, target] = pipelineStr.split('>>');
      actualCommand = cmd.trim();
      redirectTarget = target.trim();
      isAppend = true;
    } else if (pipelineStr.includes('>')) {
      const [cmd, target] = pipelineStr.split('>');
      actualCommand = cmd.trim();
      redirectTarget = target.trim();
      isAppend = false;
    }

    // Check Piping (|)
    const stages = actualCommand.split('|').map((s) => s.trim());
    let stdin = '';
    let lastResult: ExecutionResult = { output: '' };

    for (let i = 0; i < stages.length; i++) {
      const stageCmd = stages[i];
      lastResult = await this.executeAtomicCommand(stageCmd, stdin);
      stdin = lastResult.output;
      if (lastResult.error) break;
    }

    // Handle redirection if specified
    if (redirectTarget && !lastResult.error) {
      const filePath = this.resolvePath(redirectTarget);
      const parentDir = filePath.substring(0, filePath.lastIndexOf('/'));
      const fileName = filePath.substring(filePath.lastIndexOf('/') + 1);

      let existingFile = this.files.find((f) => f.path.toLowerCase() === filePath.toLowerCase());
      let newFiles = [...this.files];

      if (existingFile) {
        const newContent = isAppend ? (existingFile.content || '') + '\n' + lastResult.output : lastResult.output;
        newFiles = newFiles.map((f) =>
          f.id === existingFile!.id
            ? { ...f, content: newContent, size: `${newContent.length} B`, modified: formatDateISO(new Date()) }
            : f
        );
      } else {
        const newFile: FileItem = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: fileName,
          path: filePath,
          type: 'file',
          extension: fileName.split('.').pop() || 'txt',
          parentId: parentDir,
          size: `${lastResult.output.length} B`,
          modified: formatDateISO(new Date()),
          content: lastResult.output,
        };
        newFiles.push(newFile);
      }

      this.files = newFiles;
      this.setFilesCallback(newFiles);
      return { output: '', createdOrModifiedFiles: true };
    }

    return lastResult;
  }

  /**
   * Execute single atomic command (e.g. "ls -la", "grep something", etc.)
   */
  private async executeAtomicCommand(cmdStr: string, stdin: string): Promise<ExecutionResult> {
    // Alias substitution
    const firstWord = cmdStr.split(' ')[0];
    if (this.state.aliases[firstWord]) {
      cmdStr = cmdStr.replace(firstWord, this.state.aliases[firstWord]);
    }

    // Environment variable expansion ($VAR)
    cmdStr = cmdStr.replace(/\$([A-Z0-9_]+)/gi, (_, varName) => {
      return this.state.env[varName] || this.state.env[varName.toUpperCase()] || '';
    });

    const tokens = this.tokenize(cmdStr);
    if (tokens.length === 0) return { output: '' };

    const cmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    switch (cmd) {
      case 'clear':
      case 'cls':
        return { output: '', clearScreen: true };

      case 'pwd':
        return { output: this.state.currentPath };

      case 'whoami':
        return { output: `${this.state.env.USER} (Administrator)` };

      case 'date':
        return { output: `${formatDateTime(new Date(), { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })} IST` };

      case 'uname':
        return { output: `Linux portfolio-os 6.5.0-win11-x86_64 #1 SMP PREEMPT_DYNAMIC ${new Intl.DateTimeFormat('en-IN', { year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date())} x86_64 GNU/Linux` };

      case 'echo': {
        const text = args.join(' ').replace(/^["']|["']$/g, '');
        return { output: text };
      }

      case 'cd': {
        const target = args[0] || this.state.env.HOME;
        let dest = this.resolvePath(target);
        if (target === '~') dest = this.state.env.HOME;

        const folder = this.files.find((f) => f.path.toLowerCase() === dest.toLowerCase() && f.type === 'folder');
        if (!folder && dest !== 'C:' && dest !== 'D:') {
          return { output: `cd: no such file or directory: ${target}`, error: true };
        }
        this.state.currentPath = folder ? folder.path : dest;
        return { output: '', newPath: this.state.currentPath };
      }

      case 'ls':
      case 'dir': {
        const showAll = args.includes('-a') || args.includes('-la') || args.includes('-al');
        const showLong = args.includes('-l') || args.includes('-la') || args.includes('-al');
        const targetFolder = args.find((a) => !a.startsWith('-')) || this.state.currentPath;
        const resolved = this.resolvePath(targetFolder);

        const items = this.files.filter((f) => {
          if (f.parentId === resolved) return true;
          // Parent folder matches
          const parentOfItem = f.path.substring(0, f.path.lastIndexOf('/')) || 'This PC';
          return parentOfItem.toLowerCase() === resolved.toLowerCase();
        });

        if (items.length === 0) {
          return { output: '(empty directory)' };
        }

        if (showLong) {
          const lines = items.map((f) => {
            const isDir = f.type === 'folder';
            const perms = isDir ? 'drwxr-xr-x' : '-rw-r--r--';
            const size = f.size || (isDir ? '4.0 KB' : '1.2 KB');
            const mod = f.modified || '2026-08-10';
            const name = isDir ? `\x1b[34m${f.name}/\x1b[0m` : f.name;
            return `${perms}  1 anish anish  ${size.padStart(10)}  ${mod}  ${name}`;
          });
          return { output: lines.join('\n') };
        }

        const names = items.map((f) => (f.type === 'folder' ? `${f.name}/` : f.name));
        return { output: names.join('    ') };
      }

      case 'mkdir': {
        if (args.length === 0) return { output: 'mkdir: missing operand', error: true };
        const newFolderName = args[0];
        const newPath = `${this.state.currentPath}/${newFolderName}`;

        const exists = this.files.some((f) => f.path.toLowerCase() === newPath.toLowerCase());
        if (exists) return { output: `mkdir: cannot create directory '${newFolderName}': File exists`, error: true };

        const newFolder: FileItem = {
          id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: newFolderName,
          path: newPath,
          type: 'folder',
          parentId: this.state.currentPath,
          modified: formatDateISO(new Date()),
        };

        const updated = [...this.files, newFolder];
        this.files = updated;
        this.setFilesCallback(updated);
        return { output: `Directory '${newFolderName}' created.`, createdOrModifiedFiles: true };
      }

      case 'touch': {
        if (args.length === 0) return { output: 'touch: missing file operand', error: true };
        const fileName = args[0];
        const newPath = `${this.state.currentPath}/${fileName}`;

        const exists = this.files.some((f) => f.path.toLowerCase() === newPath.toLowerCase());
        if (exists) return { output: `touch: file '${fileName}' already exists.` };

        const ext = fileName.split('.').pop() || 'txt';
        const newFile: FileItem = {
          id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: fileName,
          path: newPath,
          type: 'file',
          extension: ext,
          parentId: this.state.currentPath,
          size: '0 B',
          modified: formatDateISO(new Date()),
          content: '',
        };

        const updated = [...this.files, newFile];
        this.files = updated;
        this.setFilesCallback(updated);
        return { output: '', createdOrModifiedFiles: true };
      }

      case 'cat':
      case 'type': {
        if (args.length === 0 && stdin) {
          return { output: stdin };
        }
        if (args.length === 0) return { output: 'cat: missing file operand', error: true };
        const targetPath = this.resolvePath(args[0]);
        const file = this.files.find((f) => f.path.toLowerCase() === targetPath.toLowerCase() && f.type === 'file');
        if (!file) return { output: `cat: ${args[0]}: No such file or directory`, error: true };
        return { output: file.content || '(empty file)' };
      }

      case 'grep': {
        const pattern = args[0] || '';
        const sourceText = args[1] ? (this.files.find((f) => f.path.toLowerCase() === this.resolvePath(args[1]).toLowerCase())?.content || '') : stdin;
        if (!sourceText) return { output: '' };

        const regex = new RegExp(pattern, 'gi');
        const matched = sourceText
          .split('\n')
          .filter((line) => regex.test(line));
        return { output: matched.join('\n') };
      }

      case 'wc': {
        const source = stdin || (args[0] ? this.files.find((f) => f.path.toLowerCase() === this.resolvePath(args[0]).toLowerCase())?.content || '' : '');
        const lines = source ? source.split('\n').length : 0;
        const words = source ? source.trim().split(/\s+/).filter(Boolean).length : 0;
        const chars = source.length;
        return { output: `${lines}  ${words}  ${chars}` };
      }

      case 'sort': {
        const lines = (stdin || '').split('\n').filter(Boolean);
        lines.sort();
        return { output: lines.join('\n') };
      }

      case 'uniq': {
        const lines = (stdin || '').split('\n');
        const uniq = Array.from(new Set(lines));
        return { output: uniq.join('\n') };
      }

      case 'rm':
      case 'del': {
        if (args.length === 0) return { output: 'rm: missing operand', error: true };
        const isRecursive = args.includes('-r') || args.includes('-rf');
        const targetName = args.find((a) => !a.startsWith('-')) || '';
        const targetPath = this.resolvePath(targetName);

        const item = this.files.find((f) => f.path.toLowerCase() === targetPath.toLowerCase());
        if (!item) return { output: `rm: cannot remove '${targetName}': No such file or directory`, error: true };
        if (item.type === 'folder' && !isRecursive) {
          return { output: `rm: cannot remove '${targetName}': Is a directory (use -r)`, error: true };
        }

        const updated = this.files.filter((f) => !f.path.toLowerCase().startsWith(targetPath.toLowerCase()));
        this.files = updated;
        this.setFilesCallback(updated);
        return { output: `Removed '${targetName}'`, createdOrModifiedFiles: true };
      }

      case 'cp': {
        if (args.length < 2) return { output: 'cp: missing destination file operand', error: true };
        const src = this.resolvePath(args[0]);
        const dest = this.resolvePath(args[1]);
        const srcFile = this.files.find((f) => f.path.toLowerCase() === src.toLowerCase());
        if (!srcFile) return { output: `cp: cannot stat '${args[0]}': No such file`, error: true };

        const fileName = dest.split('/').pop() || srcFile.name;
        const parentId = dest.substring(0, dest.lastIndexOf('/'));
        const newFile: FileItem = {
          ...srcFile,
          id: `file-copy-${Date.now()}`,
          name: fileName,
          path: dest,
          parentId,
        };

        const updated = [...this.files, newFile];
        this.files = updated;
        this.setFilesCallback(updated);
        return { output: `Copied '${args[0]}' to '${args[1]}'`, createdOrModifiedFiles: true };
      }

      case 'mv': {
        if (args.length < 2) return { output: 'mv: missing destination file operand', error: true };
        const src = this.resolvePath(args[0]);
        const dest = this.resolvePath(args[1]);
        const srcFile = this.files.find((f) => f.path.toLowerCase() === src.toLowerCase());
        if (!srcFile) return { output: `mv: cannot stat '${args[0]}': No such file`, error: true };

        const fileName = dest.split('/').pop() || srcFile.name;
        const parentId = dest.substring(0, dest.lastIndexOf('/'));

        const updated = this.files.map((f) =>
          f.id === srcFile.id ? { ...f, name: fileName, path: dest, parentId } : f
        );
        this.files = updated;
        this.setFilesCallback(updated);
        return { output: `Moved '${args[0]}' to '${args[1]}'`, createdOrModifiedFiles: true };
      }

      case 'find': {
        const root = this.resolvePath(args[0] || '.');
        const matched = this.files.filter((f) => f.path.toLowerCase().startsWith(root.toLowerCase()));
        return { output: matched.map((f) => f.path).join('\n') };
      }

      case 'tree': {
        const root = this.resolvePath(args[0] || '.');
        const matched = this.files.filter((f) => f.path.toLowerCase().startsWith(root.toLowerCase()));
        const treeLines = matched.map((f) => `├── ${f.path.replace(root, '') || f.name}`);
        return { output: `${root}\n${treeLines.join('\n')}` };
      }

      case 'env': {
        const entries = Object.entries(this.state.env).map(([k, v]) => `${k}=${v}`);
        return { output: entries.join('\n') };
      }

      case 'export': {
        if (args.length === 0) return { output: Object.entries(this.state.env).map(([k, v]) => `declare -x ${k}="${v}"`).join('\n') };
        const [k, v] = args[0].split('=');
        if (k && v) {
          this.state.env[k] = v.replace(/^["']|["']$/g, '');
          return { output: '' };
        }
        return { output: 'export: invalid format, use VAR=value', error: true };
      }

      case 'alias': {
        if (args.length === 0) {
          return { output: Object.entries(this.state.aliases).map(([k, v]) => `alias ${k}='${v}'`).join('\n') };
        }
        const [k, v] = args[0].split('=');
        if (k && v) {
          this.state.aliases[k] = v.replace(/^["']|["']$/g, '');
          return { output: '' };
        }
        return { output: 'alias: usage: alias name=value', error: true };
      }

      case 'history': {
        return { output: this.state.history.map((h, i) => `  ${(i + 1).toString().padStart(3, ' ')}  ${h}`).join('\n') };
      }

      case 'open':
      case 'start': {
        if (args.length === 0) return { output: 'open: specify an app or file', error: true };
        const appOrFile = args[0].toLowerCase();
        if (this.openAppCallback) {
          if (appOrFile === 'notepad' || appOrFile === 'code') this.openAppCallback('notepad');
          else if (appOrFile === 'calc' || appOrFile === 'calculator') this.openAppCallback('calculator');
          else if (appOrFile === 'browser' || appOrFile === 'edge') this.openAppCallback('browser');
          else if (appOrFile === 'camera') this.openAppCallback('camera');
          else if (appOrFile === 'settings') this.openAppCallback('settings');
          else if (appOrFile === 'explorer') this.openAppCallback('explorer');
          else this.openAppCallback(appOrFile);
        }
        return { output: `Opening ${args[0]}...` };
      }

      case 'weather': {
        try {
          const res = await fetch('https://wttr.in/Ahmedabad?format=3');
          if (res.ok) {
            const txt = await res.text();
            return { output: `⛅ Live Weather:\n${txt}` };
          }
        } catch {}
        return { output: '⛅ Ahmedabad: +32°C ☀️ Clear Sky (Wind 12 km/h)' };
      }

      case 'curl':
      case 'fetch': {
        if (args.length === 0) return { output: 'curl: try \'curl <url>\'', error: true };
        try {
          const target = args[0];
          const proxied = `/api/browse/proxy?url=${encodeURIComponent(target)}`;
          const res = await fetch(proxied);
          if (res.ok) {
            const txt = await res.text();
            return { output: txt.slice(0, 1000) + (txt.length > 1000 ? '\n...[output truncated]' : '') };
          }
          return { output: `curl: HTTP ${res.status} returned from server.` };
        } catch (e: any) {
          return { output: `curl: connection failed: ${e.message}`, error: true };
        }
      }

      case 'help': {
        return {
          output: `
Windows 11 Portfolio Shell (Enhanced Command Suite)
--------------------------------------------------
File Operations:
  ls [-l, -a]   List directory contents
  cd <dir>      Change current directory (~ for HOME)
  pwd           Print working directory
  mkdir <dir>   Create a directory
  touch <file>  Create an empty file
  cat <file>    Concatenate & display file content
  rm [-r] <f>   Remove file or directory
  cp <src> <dst>Copy file
  mv <src> <dst>Move or rename file
  tree [dir]    Display directory tree hierarchy
  find [dir]    Search files in directory

Text & Stream Utilities:
  grep <pat>    Search text pattern in stream/file
  sort          Sort lines of text
  uniq          Filter unique lines
  wc [file]     Count lines, words, and characters
  echo <text>   Print string to stdout
  > and >>      Output redirection to file
  |             Piping output to next command
  && and ;      Command chaining

System & Utilities:
  whoami        Current user information
  date          System timestamp
  uname         OS kernel and architecture information
  env / export  Environment variables management
  alias         Manage command shortcuts (e.g. ll, cls)
  history       Command line execution history
  weather       Live weather report
  curl <url>    Fetch web content from URL
  open <app>    Launch an application (notepad, camera, etc.)
  clear / cls   Clear screen
`,
        };
      }

      default:
        return {
          output: `${cmd}: command not found. Type 'help' for available commands.`,
          error: true,
        };
    }
  }

  /**
   * Helper to resolve relative path strings into absolute Windows-style paths
   */
  public resolvePath(target: string): string {
    if (!target) return this.state.currentPath;
    if (target === '~') return this.state.env.HOME;
    if (target.startsWith('~/')) return `${this.state.env.HOME}/${target.slice(2)}`;

    // Absolute
    if (target.startsWith('C:') || target.startsWith('D:')) {
      return target.replace(/\\/g, '/');
    }

    if (target === '..') {
      const parts = this.state.currentPath.split('/');
      if (parts.length > 1) {
        parts.pop();
        return parts.join('/');
      }
      return this.state.currentPath;
    }

    if (target.startsWith('../')) {
      const parts = this.state.currentPath.split('/');
      const segments = target.split('/');
      while (segments[0] === '..' && parts.length > 1) {
        segments.shift();
        parts.pop();
      }
      return `${parts.join('/')}/${segments.join('/')}`;
    }

    if (target.startsWith('./')) {
      return `${this.state.currentPath}/${target.slice(2)}`;
    }

    return `${this.state.currentPath}/${target}`;
  }

  private tokenize(str: string): string[] {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    const tokens: string[] = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      tokens.push(match[1] || match[2] || match[0]);
    }
    return tokens;
  }
}
