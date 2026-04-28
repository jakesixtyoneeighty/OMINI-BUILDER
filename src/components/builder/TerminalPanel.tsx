// ============================================================
// Omni-Builder — TerminalPanel Component
// ============================================================
'use client';

import { useState, useRef, useEffect } from 'react';
import { useDeployStore, usePreviewStore, useProjectStore } from '@/store';
import {
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';

export default function TerminalPanel() {
  const [activeTab, setActiveTab] = useState<'terminal' | 'deploy' | 'problems'>('terminal');
  const terminalRef = useRef<HTMLDivElement>(null);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-800">
        <TabButton
          active={activeTab === 'terminal'}
          onClick={() => setActiveTab('terminal')}
        >
          <Terminal size={12} /> Terminal
        </TabButton>
        <TabButton
          active={activeTab === 'deploy'}
          onClick={() => setActiveTab('deploy')}
        >
          Deploy
        </TabButton>
        <TabButton
          active={activeTab === 'problems'}
          onClick={() => setActiveTab('problems')}
        >
          Problems
        </TabButton>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-xs custom-scrollbar">
        {activeTab === 'terminal' && <TerminalOutput />}
        {activeTab === 'deploy' && <DeployOutput />}
        {activeTab === 'problems' && <ProblemsPanel />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 text-xs transition border-b-2 ${
        active
          ? 'text-zinc-200 border-violet-500'
          : 'text-zinc-500 border-transparent hover:text-zinc-300'
      }`}
    >
      {children}
    </button>
  );
}

function TerminalOutput() {
  const projectFiles = useProjectStore((s) => s.project.files);
  const status = usePreviewStore((s) => s.status);
  const fileCount = Object.keys(projectFiles).length;

  const logs = [
    { text: '$ omni-builder dev', color: 'text-violet-400' },
    { text: '', color: '' },
    { text: '  Omni-Builder v1.0.0', color: 'text-zinc-500' },
    { text: '  Powered by AI Code Generation', color: 'text-zinc-500' },
    { text: '', color: '' },
    {
      text: status === 'ready'
        ? `  ✓ ${fileCount} files loaded — Preview ready`
        : status === 'building'
          ? `  ◌ Building preview...`
          : `  ○ Waiting for files...`,
      color: status === 'ready' ? 'text-green-400' : status === 'building' ? 'text-yellow-400' : 'text-zinc-500',
    },
  ];

  // Add file list
  if (fileCount > 0) {
    logs.push({ text: '', color: '' });
    logs.push({ text: '  Project files:', color: 'text-zinc-400' });
    for (const path of Object.keys(projectFiles).sort()) {
      logs.push({ text: `    ${path}`, color: 'text-zinc-600' });
    }
  }

  return (
    <div className="space-y-0.5">
      {logs.map((log, i) => (
        <div key={i} className={log.color}>
          {log.text}
        </div>
      ))}
      {status === 'ready' && (
        <>
          <div className="mt-4 text-zinc-500">
            {'>'} Preview is running. Changes will hot-reload automatically.
          </div>
        </>
      )}
    </div>
  );
}

function DeployOutput() {
  const deployStatus = useDeployStore((s) => s.status);
  const deployUrl = useDeployStore((s) => s.url);
  const deployError = useDeployStore((s) => s.error);
  const deployLogs = useDeployStore((s) => s.logs);
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {deployStatus === 'idle' && (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center mx-auto mb-3">
            <Terminal size={20} className="text-zinc-600" />
          </div>
          <p className="text-xs text-zinc-500">
            Click &quot;Deploy&quot; to deploy your project to Cloudflare Pages
          </p>
          <div className="mt-4 text-left bg-zinc-900 rounded-lg p-3 text-zinc-600">
            <p className="text-[10px] uppercase font-semibold text-zinc-500 mb-2">
              Deployment Pipeline
            </p>
            <div className="space-y-1.5 text-xs">
              <Step label="Bundle project files" done={false} />
              <Step label="Optimize assets" done={false} />
              <Step label="Upload to Cloudflare Pages" done={false} />
              <Step label="Configure domain & SSL" done={false} />
            </div>
          </div>
        </div>
      )}

      {deployStatus === 'deploying' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-yellow-400">
            <Loader2 size={14} className="animate-spin" />
            <span>Deploying to Cloudflare Pages...</span>
          </div>
          {deployLogs.map((log, i) => (
            <div key={i} className="text-zinc-500">
              {log}
            </div>
          ))}
        </div>
      )}

      {deployStatus === 'success' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle2 size={14} />
            <span>Deployed successfully!</span>
          </div>
          {deployUrl && (
            <div className="bg-zinc-900 rounded-lg p-3">
              <p className="text-[10px] uppercase font-semibold text-zinc-500 mb-2">
                Deployment URL
              </p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-violet-400 flex-1 truncate">
                  {deployUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(deployUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-1 text-zinc-400 hover:text-white transition"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button className="p-1 text-zinc-400 hover:text-white transition">
                  <ExternalLink size={12} />
                </button>
              </div>
            </div>
          )}
          {deployLogs.map((log, i) => (
            <div key={i} className="text-zinc-600 text-xs">
              {log}
            </div>
          ))}
        </div>
      )}

      {deployStatus === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle size={14} />
            <span>Deployment failed</span>
          </div>
          {deployError && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3 text-red-300 text-xs">
              {deployError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 size={12} className="text-green-400" />
      ) : (
        <div className="w-3 h-3 rounded-full border border-zinc-700" />
      )}
      <span className={done ? 'text-green-400' : 'text-zinc-600'}>{label}</span>
    </div>
  );
}

function ProblemsPanel() {
  const projectFiles = useProjectStore((s) => s.project.files);

  // Simple linting: check for common issues
  const problems: { path: string; line: number; message: string; severity: 'warning' | 'error' }[] = [];

  for (const [path, file] of Object.entries(projectFiles)) {
    const lines = file.content.split('\n');
    lines.forEach((line, i) => {
      // Check for TODO comments
      if (line.includes('TODO') || line.includes('FIXME')) {
        problems.push({
          path,
          line: i + 1,
          message: `Unresolved ${line.includes('FIXME') ? 'FIXME' : 'TODO'} found`,
          severity: 'warning',
        });
      }
      // Check for console.log in TSX files
      if (path.endsWith('.tsx') && line.includes('console.log')) {
        problems.push({
          path,
          line: i + 1,
          message: 'Unexpected console statement',
          severity: 'warning',
        });
      }
    });
  }

  if (problems.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 size={24} className="text-green-400 mx-auto mb-2" />
        <p className="text-xs text-zinc-500">No problems detected</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {problems.map((p, i) => (
        <div key={i} className="flex items-start gap-2 py-1 px-2 hover:bg-zinc-900 rounded">
          <span className={p.severity === 'warning' ? 'text-yellow-400' : 'text-red-400'}>
            {p.severity === 'warning' ? '⚠' : '✕'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-300 truncate">{p.message}</p>
            <p className="text-[10px] text-zinc-600">
              {p.path}:{p.line}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
