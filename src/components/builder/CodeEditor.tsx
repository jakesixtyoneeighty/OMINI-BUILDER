// ============================================================
// Omni-Builder — CodeEditor Component (CodeMirror)
// ============================================================
'use client';

import { useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useEditorStore, useProjectStore, getLanguage } from '@/store';

// Dynamic import CodeMirror to avoid SSR issues
const CodeMirror = dynamic(
  () => import('@uiw/react-codemirror').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
        Loading editor...
      </div>
    ),
  }
);

export default function CodeEditor() {
  const activeTab = useEditorStore((s) => s.activeTab);
  const getFile = useProjectStore((s) => s.getFile);
  const setFile = useProjectStore((s) => s.setFile);
  const markDirty = useEditorStore((s) => s.markDirty);

  const file = activeTab ? getFile(activeTab) : undefined;
  const lang = file?.language ?? 'text';

  const handleChange = useCallback(
    (value: string) => {
      if (activeTab) {
        setFile(activeTab, value);
        markDirty(activeTab);
      }
    },
    [activeTab, setFile, markDirty]
  );

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center bg-zinc-950 text-zinc-500">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-30">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p className="text-sm">Select a file to edit</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* File path breadcrumb */}
      <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
        <span className="font-mono">{activeTab}</span>
        <span className="ml-auto text-zinc-600">{lang}</span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden [&_.cm-editor]:h-full [&_.cm-scroller]:!overflow-auto [&_.cm-focused]:outline-none [&_.cm-gutters]:bg-zinc-900 [&_.cm-gutters]:border-r [&_.cm-gutters]:border-zinc-800 [&_.cm-activeLineGutter]:bg-zinc-800/50">
        <CodeMirror
          value={file.content}
          height="100%"
          theme="dark"
          extensions={[]}
          onChange={handleChange}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLineGutter: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}
