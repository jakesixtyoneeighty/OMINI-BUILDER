import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';
import type { PreviewMode } from '~/lib/stores/project';

const PISTON_API = 'https://emkc.org/api/v2/piston';

// Map file extensions to Piston language names
const EXT_TO_LANG: Record<string, { language: string; version: string }> = {
  '.py': { language: 'python', version: '3.12.6' },
  '.js': { language: 'javascript', version: '18.15.0' },
  '.ts': { language: 'typescript', version: '5.0.3' },
  '.java': { language: 'java', version: '15.0.2' },
  '.c': { language: 'c', version: '10.2.0' },
  '.cpp': { language: 'c++', version: '10.2.0' },
  '.cc': { language: 'c++', version: '10.2.0' },
  '.cs': { language: 'c#', version: '6.12.0' },
  '.go': { language: 'go', version: '1.21.5' },
  '.rs': { language: 'rust', version: '1.68.2' },
  '.rb': { language: 'ruby', version: '3.2.2' },
  '.php': { language: 'php', version: '8.2.3' },
  '.swift': { language: 'swift', version: '5.7.3' },
  '.kt': { language: 'kotlin', version: '1.8.20' },
  '.sh': { language: 'bash', version: '5.2.0' },
  '.lua': { language: 'lua', version: '5.4.4' },
  '.r': { language: 'r', version: '4.3.0' },
  '.dart': { language: 'dart', version: '3.1.2' },
  '.hs': { language: 'haskell', version: '9.4.5' },
  '.pl': { language: 'perl', version: '5.38.0' },
  '.ex': { language: 'elixir', version: '1.14.4' },
  '.exs': { language: 'elixir', version: '1.14.4' },
  '.scala': { language: 'scala', version: '3.3.0' },
  '.pas': { language: 'pascal', version: '3.2.2' },
  '.sql': { language: 'sqlite3', version: '3.41.1' },
};

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'system';
  text: string;
  timestamp?: string;
}

export const PistonTerminal = memo(function PistonTerminal({ previewMode }: { previewMode: PreviewMode }) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'system', text: '🚀 Piston Terminal — Type a filename to run (e.g. "main.py") or "help" for commands' },
    { type: 'system', text: 'Supported: Python, JS/TS, C/C++, Java, Go, Rust, Ruby, PHP, C#, Swift, Kotlin, Bash, and more' },
  ]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type: TerminalLine['type'], text: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLines((prev) => [...prev, { type, text, timestamp }]);
  }, []);

  const executeCode = useCallback(async (filePath: string, stdin: string = '') => {
    const files = workbenchStore.files.get();
    const entry = Object.entries(files).find(([p]) => p === filePath || p.endsWith('/' + filePath));

    if (!entry) {
      // Try to find by partial name
      const allEntries = Object.entries(files).filter(([, f]): f is [string, WFile] => f?.type === 'file' && !f.isBinary);
      const match = allEntries.find(([p]) => p.toLowerCase().includes(filePath.toLowerCase()));
      if (!match) {
        addLine('error', `File not found: ${filePath}`);
        addLine('info', 'Available files:');
        allEntries.forEach(([p]) => addLine('info', `  ${p}`));
        return;
      }
      return executeCode(match[0], stdin);
    }

    const file = entry[1] as WFile;
    if (file?.type !== 'file') return;

    const ext = '.' + entry[0].split('.').pop()!.toLowerCase();
    const langInfo = EXT_TO_LANG[ext];
    if (!langInfo) {
      addLine('error', `Unsupported file type: ${ext}`);
      return;
    }

    addLine('info', `Running ${entry[0]} (${langInfo.language} ${langInfo.version})...`);
    setIsRunning(true);

    try {
      // Also include other files of the same language
      const sameLangFiles = Object.entries(files)
        .filter(([p, f]): f is [string, WFile] => {
          if (f?.type !== 'file' || f.isBinary) return false;
          if (p === entry[0]) return false;
          if (p.includes('node_modules') || p.endsWith('.lock') || p.endsWith('.json')) return false;
          const fExt = '.' + p.split('.').pop()!.toLowerCase();
          const fLang = EXT_TO_LANG[fExt];
          return fLang?.language === langInfo.language;
        })
        .map(([p, f]) => ({ content: f.content, name: p.split('/').pop()! }));

      const body = {
        language: langInfo.language,
        version: langInfo.version,
        files: [
          { content: file.content, name: entry[0].split('/').pop()! },
          ...sameLangFiles,
        ],
        stdin: stdin,
        args: [],
        compile_timeout: 10000,
        run_timeout: 30000,
      };

      const response = await fetch(`${PISTON_API}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (result.stdout) {
        addLine('output', result.stdout);
      }
      if (result.stderr) {
        addLine('error', result.stderr);
      }
      if (!result.stdout && !result.stderr && result.output) {
        addLine('output', result.output);
      }
      if (!result.stdout && !result.stderr && !result.output) {
        addLine('info', '(no output)');
      }

      if (result.exit_code !== 0 && result.exit_code != null) {
        addLine('error', `Process exited with code ${result.exit_code}${result.signal ? ` (signal: ${result.signal})` : ''}`);
      } else {
        addLine('info', `Process exited with code 0`);
      }
    } catch (err) {
      addLine('error', `Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsRunning(false);
    }
  }, [addLine]);

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLine('input', `$ ${trimmed}`);

    // Parse command
    const lowerCmd = trimmed.toLowerCase();

    if (lowerCmd === 'help') {
      addLine('info', 'Piston Terminal Commands:');
      addLine('info', '  <filename>          — Run a file (e.g. "main.py", "app.js")');
      addLine('info', '  run <filename>      — Same as above');
      addLine('info', '  ls                  — List runnable files');
      addLine('info', '  clear               — Clear terminal');
      addLine('info', '  langs               — List supported languages');
      addLine('info', '  help                — Show this help');
      return;
    }

    if (lowerCmd === 'clear') {
      setLines([{ type: 'system', text: 'Terminal cleared' }]);
      return;
    }

    if (lowerCmd === 'ls') {
      const files = workbenchStore.files.get();
      const entries = Object.entries(files).filter(([, f]): f is [string, WFile] => f?.type === 'file' && !f.isBinary);
      const runnable = entries.filter(([p]) => {
        const ext = '.' + p.split('.').pop()!.toLowerCase();
        return !!EXT_TO_LANG[ext];
      });
      if (runnable.length === 0) {
        addLine('info', 'No runnable files found');
      } else {
        addLine('info', `Runnable files (${runnable.length}):`);
        runnable.forEach(([p, f]) => {
          const ext = '.' + p.split('.').pop()!.toLowerCase();
          const lang = EXT_TO_LANG[ext]?.language || 'unknown';
          addLine('info', `  ${p} [${lang}] (${(f.content.length / 1024).toFixed(1)}KB)`);
        });
      }
      return;
    }

    if (lowerCmd === 'langs') {
      addLine('info', 'Supported languages:');
      Object.entries(EXT_TO_LANG).forEach(([ext, info]) => {
        addLine('info', `  ${ext} → ${info.language} (${info.version})`);
      });
      return;
    }

    // Run command
    const runMatch = trimmed.match(/^run\s+(.+)$/i);
    const filename = runMatch ? runMatch[1] : trimmed;

    // Check if stdin is provided via pipe syntax: "main.py <<< input"
    const pipeMatch = filename.match(/^(.+?)\s*<<<\s*(.+)$/);
    if (pipeMatch) {
      executeCode(pipeMatch[1].trim(), pipeMatch[2]);
    } else {
      executeCode(filename.trim());
    }
  }, [addLine, executeCode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommand(input);
      setInput('');
    }
  }, [input, handleCommand]);

  return (
    <div className="h-full flex flex-col bg-bolt-elements-bg-depth-2">
      {/* Terminal header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bolt-elements-bg-depth-3 border-b border-purple-500/20 shrink-0">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-400 text-[10px] font-medium">
          <div className="i-ph:rocket-duotone text-xs" />
          Piston
        </div>
        <span className="text-[10px] text-purple-300/50">Remote Execution Engine</span>
        {isRunning && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-400 ml-auto">
            <div className="i-ph:spinner-gap animate-spin text-xs" />
            Running...
          </span>
        )}
      </div>

      {/* Terminal output */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${
            line.type === 'input' ? 'text-cyan-400' :
            line.type === 'output' ? 'text-green-400' :
            line.type === 'error' ? 'text-red-400' :
            line.type === 'system' ? 'text-purple-400' :
            'text-gray-400'
          }`}>
            {line.type === 'input' && <span className="text-purple-400 select-none">$ </span>}
            {line.text}
          </div>
        ))}
      </div>

      {/* Input line */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-purple-500/20 bg-bolt-elements-bg-depth-3 shrink-0">
        <span className="text-purple-400 font-mono text-sm select-none">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          placeholder={isRunning ? 'Waiting...' : 'Type filename or command (help for list)'}
          className="flex-1 bg-transparent text-green-400 text-xs font-mono focus:outline-none placeholder:text-purple-300/30 disabled:opacity-50"
        />
      </div>
    </div>
  );
});
