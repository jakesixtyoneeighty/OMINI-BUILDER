// ============================================================
// Omni-Builder — Functional Terminal Component
// ============================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Terminal as TerminalIcon,
  ChevronRight,
  X,
} from 'lucide-react';

interface TerminalLine {
  id: number;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
}

const WORKING_DIR = '/home/omni-builder/project';

// Simulated command implementations
function executeCommand(cmd: string, files: Record<string, string>): string[] {
  const parts = cmd.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1);

  switch (command) {
    case 'help':
      return [
        'Available commands:',
        '  ls [path]         List files in directory',
        '  cat <file>        Show file contents',
        '  tree              Show file tree',
        '  touch <file>      Create empty file',
        '  rm <file>         Delete file',
        '  echo <text>       Print text',
        '  pwd               Print working directory',
        '  clear             Clear terminal',
        '  node -v           Show Node.js version',
        '  npm -v            Show npm version',
        '  git status        Show git status',
        '  whoami            Show current user',
        '  date              Show current date',
        '  uname -a          Show system info',
        '  env               Show environment variables',
        '  wc <file>         Count lines in file',
        '  head <file>       Show first lines of file',
        '  grep <pattern>    Search in files',
      ];

    case 'ls': {
      const dir = args[0] || '.';
      const entries = new Set<string>();

      for (const path of Object.keys(files)) {
        const normalized = path.startsWith('/') ? path.slice(1) : path;
        if (dir === '.' || dir === WORKING_DIR) {
          const firstPart = normalized.split('/')[0];
          if (firstPart) entries.add(firstPart);
        } else {
          const prefix = dir.startsWith('/') ? dir.slice(1) : dir;
          if (normalized.startsWith(prefix + '/')) {
            const rest = normalized.slice(prefix.length + 1);
            const firstPart = rest.split('/')[0];
            if (firstPart) entries.add(firstPart);
          }
        }
      }

      if (entries.size === 0) return [`(empty directory)`];
      return [Array.from(entries).sort().join('  ')];
    }

    case 'cat': {
      if (!args[0]) return ['cat: missing file operand'];
      const filePath = args[0].startsWith('/') ? args[0].slice(1) : args[0];
      const content = files[filePath];
      if (!content) return [`cat: ${args[0]}: No such file or directory`];
      return [content];
    }

    case 'tree': {
      const tree: string[] = [];
      tree.push(WORKING_DIR);

      const dirs = new Set<string>();
      const allFiles = new Set<string>();

      for (const path of Object.keys(files)) {
        const parts = path.split('/');
        for (let i = 1; i < parts.length; i++) {
          const prefix = parts.slice(0, i).join('/');
          if (i < parts.length) dirs.add(prefix);
        }
        allFiles.add(path);
      }

      const sortedDirs = Array.from(dirs).sort();
      const sortedFiles = Array.from(allFiles).sort();

      let dirCount = 0;
      let fileCount = 0;

      for (const dir of sortedDirs) {
        const parts = dir.split('/');
        const indent = '  '.repeat(parts.length);
        tree.push(`${indent}├── ${parts[parts.length - 1]}/`);
        dirCount++;
      }

      for (const file of sortedFiles) {
        const parts = file.split('/');
        const indent = '  '.repeat(parts.length - 1);
        const isLast = sortedFiles.indexOf(file) === sortedFiles.length - 1;
        tree.push(`${indent}${isLast ? '└' : '├'}── ${parts[parts.length - 1]}`);
        fileCount++;
      }

      tree.push('');
      tree.push(`${dirCount} directories, ${fileCount} files`);
      return tree;
    }

    case 'pwd':
      return [WORKING_DIR];

    case 'echo':
      return [args.join(' ')];

    case 'clear':
      return ['__CLEAR__'];

    case 'whoami':
      return ['omni-builder'];

    case 'date':
      return [new Date().toString()];

    case 'uname':
      return ['Omni-Builder v1.0.0 (WebAssembly/Linux x86_64)'];

    case 'env':
      return [
        'NODE_ENV=development',
        'HOME=/home/omni-builder',
        'PATH=/usr/local/bin:/usr/bin:/bin',
        'SHELL=/bin/bash',
        'LANG=en_US.UTF-8',
      ];

    case 'node':
      if (args[0] === '-v' || args[0] === '--version') return ['v20.11.0'];
      return ['node: command executed successfully'];

    case 'npm':
      if (args[0] === '-v' || args[0] === '--version') return ['10.2.4'];
      return ['npm: command executed successfully'];

    case 'npx':
      return ['npx: command executed successfully'];

    case 'pnpm':
      if (args[0] === '-v' || args[0] === '--version') return ['8.14.1'];
      return ['pnpm: command executed successfully'];

    case 'git':
      if (args[0] === 'status') {
        return [
          'On branch main',
          'Changes not staged for commit:',
          Object.keys(files).map(f => `  modified:   ${f}`).join('\n'),
          '',
          'no changes added to commit',
        ];
      }
      return [`git ${args.join(' ')}: executed`];

    case 'touch':
      if (!args[0]) return ['touch: missing file operand'];
      return [`Created ${args[0]}`];

    case 'rm':
      if (!args[0]) return ['rm: missing operand'];
      return [`Removed ${args[0]}`];

    case 'wc': {
      if (!args[0]) return ['wc: missing file operand'];
      const filePath = args[0].startsWith('/') ? args[0].slice(1) : args[0];
      const content = files[filePath];
      if (!content) return [`wc: ${args[0]}: No such file or directory`];
      const lines = content.split('\n').length;
      const words = content.split(/\s+/).filter(Boolean).length;
      const chars = content.length;
      return [`  ${lines}  ${words} ${chars} ${args[0]}`];
    }

    case 'head': {
      if (!args[0]) return ['head: missing file operand'];
      const filePath = args[0].startsWith('/') ? args[0].slice(1) : args[0];
      const content = files[filePath];
      if (!content) return [`head: ${args[0]}: No such file or directory`];
      const n = 10;
      return content.split('\n').slice(0, n);
    }

    case 'grep': {
      if (!args[0] || !args[1]) return ['Usage: grep <pattern> <file>'];
      const pattern = args[0];
      const filePath = args[1].startsWith('/') ? args[1].slice(1) : args[1];
      const content = files[filePath];
      if (!content) return [`grep: ${args[1]}: No such file or directory`];
      const lines = content.split('\n').filter((l) => l.includes(pattern));
      if (lines.length === 0) return [`(no matches found for "${pattern}")`];
      return lines.map((l) => `${args[1]}: ${l}`);
    }

    case 'mkdir':
      if (!args[0]) return ['mkdir: missing operand'];
      return [`Created directory ${args[0]}`];

    case 'cd':
      return [`cd: ${args[0] || '~'}`];

    case 'vite':
    case 'npm run dev':
    case 'pnpm dev':
      return [
        '  VITE v5.2.0  ready in 234ms',
        '',
        '  ➜  Local:   http://localhost:5173/',
        '  ➜  Network: http://192.168.1.100:5173/',
        '',
        '  ready in 234ms.',
      ];

    case 'npm run build':
    case 'pnpm build':
      return [
        'vite v5.2.0 building for production...',
        '✓ 42 modules transformed.',
        'dist/index.html                  0.46 kB │ gzip:  0.30 kB',
        'dist/assets/index-DiwrgTda.css   1.39 kB │ gzip:  0.72 kB',
        'dist/assets/index-CZJKI2gV.js   143.36 kB │ gzip: 46.09 kB',
        '✓ built in 1.23s',
      ];

    default:
      return [`bash: ${command}: command not found`];
  }
}

import { useProjectStore } from '@/store';

export default function TerminalPanel() {
  const [lines, setLines] = useState<TerminalLine[]>([
    { id: 0, type: 'system', content: 'Omni-Builder Terminal v1.0.0' },
    { id: 1, type: 'system', content: `Working directory: ${WORKING_DIR}` },
    { id: 2, type: 'system', content: 'Type "help" for available commands.' },
    { id: 3, type: 'system', content: '' },
  ]);
  const [input, setInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(4);

  const projectFiles = useProjectStore((s) => s.project.files);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const addLines = useCallback((type: TerminalLine['type'], content: string | string[]) => {
    const contentArr = Array.isArray(content) ? content : [content];
    const newLines: TerminalLine[] = contentArr.map((text, i) => ({
      id: lineIdRef.current++,
      type,
      content: text,
    }));
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const handleCommand = useCallback(
    (cmd: string) => {
      // Add the input line
      addLines('input', `${WORKING_DIR} $ ${cmd}`);

      // Add to history
      setCommandHistory((prev) => [...prev, cmd]);
      setHistoryIndex(-1);

      if (!cmd.trim()) {
        addLines('output', '');
        return;
      }

      // Build file map for commands
      const fileMap: Record<string, string> = {};
      for (const [path, file] of Object.entries(projectFiles)) {
        fileMap[path] = file.content;
      }

      const output = executeCommand(cmd, fileMap);

      if (output.length === 1 && output[0] === '__CLEAR__') {
        setLines([]);
        return;
      }

      // Determine if there are errors
      const hasError = output.some((l) => l.includes('No such file') || l.includes('not found') || l.includes('Error'));

      for (const line of output) {
        addLines(hasError ? 'error' : 'output', line);
      }

      addLines('output', '');
    },
    [addLines, projectFiles]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleCommand(input);
        setInput('');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (commandHistory.length === 0) return;
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(commandHistory[newIndex]);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex === -1) return;
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      } else if (e.key === 'l' && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      }
    },
    [input, handleCommand, commandHistory, historyIndex]
  );

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'input': return 'text-green-400';
      case 'output': return 'text-zinc-300';
      case 'error': return 'text-red-400';
      case 'system': return 'text-zinc-500';
      default: return 'text-zinc-300';
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 font-mono text-xs">
      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 custom-scrollbar"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line) => (
          <div key={line.id} className={`${getLineColor(line.type)} whitespace-pre-wrap break-all leading-5`}>
            {line.type === 'input' ? (
              <span>
                <span className="text-violet-400">omni</span>
                <span className="text-zinc-500">@</span>
                <span className="text-blue-400">builder</span>
                <span className="text-zinc-500">:</span>
                <span className="text-cyan-400">~</span>
                <span className="text-zinc-500">$ </span>
                <span className="text-zinc-200">{line.content.split('$ ').pop()}</span>
              </span>
            ) : (
              line.content
            )}
          </div>
        ))}

        {/* Current input line */}
        <div className="flex items-center text-zinc-200">
          <span className="text-violet-400">omni</span>
          <span className="text-zinc-500">@</span>
          <span className="text-blue-400">builder</span>
          <span className="text-zinc-500">:</span>
          <span className="text-cyan-400">~</span>
          <span className="text-zinc-500">$ </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none text-zinc-200 caret-violet-400"
            autoFocus
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
