import { useStore } from '@nanostores/react';
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { workbenchStore } from '~/lib/stores/workbench';
import type { FileMap, File as WFile } from '~/lib/stores/files';

// Piston API endpoint (public instance)
const PISTON_API = 'https://emkc.org/api/v2/piston';

interface PistonRuntime {
  language: string;
  version: string;
  aliases: string[];
}

interface ExecutionResult {
  language: string;
  version: string;
  stdout: string;
  stderr: string;
  output: string;
  exit_code: number | null;
  signal: string | null;
  ran: boolean;
}

// Map file extensions to Piston language names
const EXT_TO_LANG: Record<string, { language: string; version: string }> = {
  '.py': { language: 'python', version: '3.12.6' },
  '.js': { language: 'javascript', version: '18.15.0' },
  '.ts': { language: 'typescript', version: '5.0.3' },
  '.java': { language: 'java', version: '15.0.2' },
  '.c': { language: 'c', version: '10.2.0' },
  '.cpp': { language: 'c++', version: '10.2.0' },
  '.cc': { language: 'c++', version: '10.2.0' },
  '.cxx': { language: 'c++', version: '10.2.0' },
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
  '.scala': { language: 'scala', version: '3.3.0' },
  '.pl': { language: 'perl', version: '5.38.0' },
  '.ex': { language: 'elixir', version: '1.14.4' },
  '.exs': { language: 'elixir', version: '1.14.4' },
  '.hs': { language: 'haskell', version: '9.4.5' },
  '.m': { language: 'objc', version: '5.8.1' },
  '.pas': { language: 'pascal', version: '3.2.2' },
  '.sql': { language: 'sqlite3', version: '3.41.1' },
};

function detectMainFile(files: FileMap): { path: string; content: string; ext: string } | null {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);

  // Priority: main.* > index.* > any supported file
  const priorities = ['main.py', 'main.js', 'main.ts', 'main.java', 'main.c', 'main.cpp',
    'index.py', 'index.js', 'index.ts', 'index.java',
    'app.py', 'app.js', 'app.ts'];

  for (const prio of priorities) {
    const entry = entries.find(([p]) => p.endsWith('/' + prio) || p === prio);
    if (entry) {
      const ext = '.' + prio.split('.').pop()!;
      return { path: entry[0], content: entry[1].content, ext };
    }
  }

  // Fallback: find first supported file
  for (const [path, file] of entries) {
    const ext = '.' + path.split('.').pop()!.toLowerCase();
    if (EXT_TO_LANG[ext]) {
      return { path, content: file.content, ext };
    }
  }

  return null;
}

function getAllRunnableFiles(files: FileMap): { path: string; content: string; ext: string; lang: string }[] {
  const entries = Object.entries(files).filter(([, f]): f is WFile => f?.type === 'file' && !f.isBinary);
  const runnable: { path: string; content: string; ext: string; lang: string }[] = [];

  for (const [path, file] of entries) {
    if (path.includes('node_modules') || path.endsWith('.lock') || path.endsWith('.json')) continue;
    const ext = '.' + path.split('.').pop()!.toLowerCase();
    const langInfo = EXT_TO_LANG[ext];
    if (langInfo) {
      runnable.push({ path, content: file.content, ext, lang: langInfo.language });
    }
  }

  return runnable;
}

export const PistonPreview = memo(function PistonPreview() {
  const files = useStore(workbenchStore.files);
  const [output, setOutput] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<PistonRuntime[]>([]);
  const [stdin, setStdin] = useState('');
  const [args, setArgs] = useState('');
  const [runHistory, setRunHistory] = useState<{ file: string; time: string; exitCode: number | null }[]>([]);
  const outputRef = useRef<HTMLPreElement>(null);

  const runnableFiles = useMemo(() => getAllRunnableFiles(files), [files]);
  const mainFile = useMemo(() => detectMainFile(files), [files]);

  // Auto-select main file
  useEffect(() => {
    if (!selectedFile && mainFile) {
      setSelectedFile(mainFile.path);
    }
  }, [mainFile, selectedFile]);

  // Fetch available runtimes
  useEffect(() => {
    fetch(`${PISTON_API}/runtimes`)
      .then((r) => r.json())
      .then((data: PistonRuntime[]) => setRuntimes(data))
      .catch(() => {});
  }, []);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const runCode = useCallback(async () => {
    const targetPath = selectedFile || mainFile?.path;
    if (!targetPath) return;

    const entry = Object.entries(files).find(([p]) => p === targetPath);
    if (!entry) return;

    const file = entry[1] as WFile;
    if (file?.type !== 'file') return;

    const ext = '.' + targetPath.split('.').pop()!.toLowerCase();
    const langInfo = EXT_TO_LANG[ext];
    if (!langInfo) {
      setOutput({
        language: ext,
        version: '',
        stdout: '',
        stderr: `Unsupported file type: ${ext}\nSupported types: ${Object.keys(EXT_TO_LANG).join(', ')}`,
        output: `Unsupported file type: ${ext}`,
        exit_code: 1,
        signal: null,
        ran: false,
      });
      return;
    }

    setIsRunning(true);

    // Collect additional files of the same language to include
    const sameLangFiles = runnableFiles
      .filter((f) => f.lang === langInfo.language && f.path !== targetPath)
      .map((f) => ({ content: f.content, name: f.path.split('/').pop()! }));

    try {
      const body = {
        language: langInfo.language,
        version: langInfo.version,
        files: [
          { content: file.content, name: targetPath.split('/').pop()! },
          ...sameLangFiles,
        ],
        stdin: stdin || '',
        args: args ? args.split(' ').filter(Boolean) : [],
        compile_timeout: 10000,
        run_timeout: 30000,
      };

      const response = await fetch(`${PISTON_API}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result: ExecutionResult = await response.json();

      setOutput(result);
      setRunHistory((prev) => [
        { file: targetPath.split('/').pop()!, time: new Date().toLocaleTimeString(), exitCode: result.exit_code },
        ...prev.slice(0, 9),
      ]);
    } catch (err) {
      setOutput({
        language: langInfo.language,
        version: langInfo.version,
        stdout: '',
        stderr: `Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}\n\nMake sure the Piston API is accessible at ${PISTON_API}`,
        output: `Failed to execute: ${err instanceof Error ? err.message : 'Unknown error'}`,
        exit_code: 1,
        signal: null,
        ran: false,
      });
    } finally {
      setIsRunning(false);
    }
  }, [selectedFile, mainFile, files, runnableFiles, stdin, args]);

  const currentExt = selectedFile ? '.' + selectedFile.split('.').pop()!.toLowerCase() : mainFile?.ext;
  const currentLang = currentExt ? EXT_TO_LANG[currentExt]?.language : null;
  const supportedLangs = useMemo(() => {
    const langs = new Set(runnableFiles.map((f) => f.lang));
    return Array.from(langs);
  }, [runnableFiles]);

  return (
    <div className="w-full h-full flex flex-col bg-bolt-elements-background-depth-1">
      {/* Toolbar */}
      <div className="bg-bolt-elements-background-depth-2 px-3 py-2 flex items-center gap-2 border-b border-bolt-elements-borderColor shrink-0">
        {/* File selector */}
        <select
          value={selectedFile || ''}
          onChange={(e) => setSelectedFile(e.target.value)}
          className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-2 py-1 text-xs text-bolt-elements-textPrimary focus:outline-none focus:border-bolt-elements-item-contentAccent max-w-[200px]"
        >
          {runnableFiles.length === 0 && (
            <option value="">No runnable files</option>
          )}
          {runnableFiles.map((f) => (
            <option key={f.path} value={f.path}>
              {f.path.split('/').pop()} ({f.lang})
            </option>
          ))}
        </select>

        {/* Language badge */}
        {currentLang && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/10 text-purple-400 text-xs font-medium">
            <div className="i-ph:rocket-duotone text-sm" />
            {currentLang}
          </div>
        )}

        {/* Run button */}
        <button
          onClick={runCode}
          disabled={isRunning || runnableFiles.length === 0}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isRunning
              ? 'bg-yellow-500/15 text-yellow-400 cursor-wait'
              : runnableFiles.length === 0
                ? 'bg-purple-500/15 text-purple-400/50 cursor-not-allowed'
                : 'bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 active:scale-95'
          }`}
        >
          {isRunning ? (
            <>
              <div className="i-ph:spinner-gap animate-spin text-sm" />
              Running...
            </>
          ) : (
            <>
              <div className="i-ph:play-fill text-sm" />
              Run
            </>
          )}
        </button>

        <div className="flex-1" />

        {/* History dropdown */}
        {runHistory.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-bolt-elements-textTertiary">
            <div className="i-ph:clock-counter-clockwise text-sm" />
            {runHistory[0].exitCode === 0 ? (
              <span className="text-green-400">Exit 0</span>
            ) : (
              <span className="text-red-400">Exit {runHistory[0].exitCode}</span>
            )}
          </div>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {runnableFiles.length === 0 ? (
          /* No runnable files */
          <div className="flex-1 flex items-center justify-center text-bolt-elements-textTertiary">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto">
                <div className="i-ph:rocket-duotone text-3xl text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-bolt-elements-textPrimary">Piston Code Execution</p>
                <p className="text-xs text-bolt-elements-textTertiary mt-1 max-w-xs mx-auto">
                  Run Python, C++, Java, Go, Rust, and 25+ languages directly in the browser using the Piston API.
                  No WebContainer needed!
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-sm mx-auto">
                {['Python', 'JavaScript', 'TypeScript', 'C++', 'Java', 'Go', 'Rust', 'Ruby', 'PHP', 'C#', 'Swift', 'Kotlin', 'Bash'].map((lang) => (
                  <span key={lang} className="px-2 py-0.5 rounded-md bg-bolt-elements-background-depth-2 text-[10px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
                    {lang}
                  </span>
                ))}
                <span className="px-2 py-0.5 rounded-md bg-bolt-elements-background-depth-2 text-[10px] text-bolt-elements-textTertiary border border-bolt-elements-borderColor">
                  +15 more
                </span>
              </div>
              <p className="text-[11px] text-bolt-elements-textTertiary mt-2">
                Create a file with a supported extension (e.g. <code className="text-purple-400">main.py</code>) to get started
              </p>
            </div>
          </div>
        ) : (
          /* Output area */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Input section (stdin + args) */}
            <div className="border-b border-bolt-elements-borderColor shrink-0">
              <details className="group">
                <summary className="flex items-center gap-2 px-3 py-1.5 text-xs text-bolt-elements-textTertiary cursor-pointer hover:text-bolt-elements-textSecondary">
                  <div className="i-ph:terminal-window text-sm" />
                  Input (stdin & args)
                  <div className="i-ph:caret-right text-xs transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-3 pb-2 space-y-2">
                  <div>
                    <label className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider">Arguments</label>
                    <input
                      type="text"
                      value={args}
                      onChange={(e) => setArgs(e.target.value)}
                      placeholder="--arg1 value1 --arg2 value2"
                      className="w-full mt-0.5 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-2 py-1 text-xs text-bolt-elements-textPrimary focus:outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider">Stdin</label>
                    <textarea
                      value={stdin}
                      onChange={(e) => setStdin(e.target.value)}
                      placeholder="Input data for your program..."
                      rows={2}
                      className="w-full mt-0.5 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-md px-2 py-1 text-xs text-bolt-elements-textPrimary focus:outline-none focus:border-purple-500/50 resize-none font-mono"
                    />
                  </div>
                </div>
              </details>
            </div>

            {/* Output display */}
            <div className="flex-1 overflow-auto p-3">
              {output ? (
                <div className="space-y-2">
                  {/* Exit code badge */}
                  <div className="flex items-center gap-2">
                    {output.exit_code === 0 ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/15 text-green-400 text-xs">
                        <div className="i-ph:check-bold text-xs" />
                        Exit code: {output.exit_code}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-xs">
                        <div className="i-ph:x-bold text-xs" />
                        Exit code: {output.exit_code ?? 'N/A'}
                      </span>
                    )}
                    <span className="text-[10px] text-bolt-elements-textTertiary">
                      {output.language} {output.version}
                    </span>
                    {output.signal && (
                      <span className="text-[10px] text-red-400">Signal: {output.signal}</span>
                    )}
                  </div>

                  {/* Stdout */}
                  {output.stdout && (
                    <div>
                      <div className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider mb-1">Output</div>
                      <pre
                        ref={outputRef}
                        className="bg-black/30 rounded-lg p-3 text-xs font-mono text-green-400 whitespace-pre-wrap break-all overflow-auto max-h-[50vh] border border-green-500/10"
                      >
                        {output.stdout}
                      </pre>
                    </div>
                  )}

                  {/* Stderr */}
                  {output.stderr && (
                    <div>
                      <div className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider mb-1">Errors</div>
                      <pre className="bg-black/30 rounded-lg p-3 text-xs font-mono text-red-400 whitespace-pre-wrap break-all overflow-auto max-h-[30vh] border border-red-500/10">
                        {output.stderr}
                      </pre>
                    </div>
                  )}

                  {/* Combined output fallback */}
                  {!output.stdout && !output.stderr && output.output && (
                    <div>
                      <div className="text-[10px] text-bolt-elements-textTertiary uppercase tracking-wider mb-1">Output</div>
                      <pre className="bg-black/30 rounded-lg p-3 text-xs font-mono text-bolt-elements-textSecondary whitespace-pre-wrap break-all overflow-auto max-h-[50vh]">
                        {output.output}
                      </pre>
                    </div>
                  )}

                  {/* No output at all */}
                  {!output.stdout && !output.stderr && !output.output && (
                    <div className="text-xs text-bolt-elements-textTertiary text-center py-4">
                      Program finished with no output
                    </div>
                  )}
                </div>
              ) : (
                /* Empty state */
                <div className="flex items-center justify-center h-full text-bolt-elements-textTertiary">
                  <div className="text-center">
                    <div className="i-ph:terminal-window-duotone text-3xl mb-2 mx-auto opacity-50" />
                    <p className="text-xs">Press <strong>Run</strong> to execute your code</p>
                    <p className="text-[10px] text-bolt-elements-textTertiary mt-1">
                      Code is executed via the Piston API (emkc.org)
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Run history */}
            {runHistory.length > 1 && (
              <div className="border-t border-bolt-elements-borderColor px-3 py-2 shrink-0 max-h-[80px] overflow-y-auto">
                <div className="text-[10px] text-bolt-elements-textTertiary mb-1">History</div>
                <div className="flex flex-wrap gap-1.5">
                  {runHistory.map((h, i) => (
                    <span
                      key={i}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                        h.exitCode === 0
                          ? 'bg-green-500/10 text-green-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      <div className={h.exitCode === 0 ? 'i-ph:check-bold' : 'i-ph:x-bold'} style={{ fontSize: '8px' }} />
                      {h.file} ({h.time})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
