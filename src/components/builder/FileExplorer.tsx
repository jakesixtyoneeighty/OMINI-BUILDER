// ============================================================
// Omni-Builder — FileExplorer Component
// ============================================================
'use client';

import { useState, useCallback } from 'react';
import { useEditorStore, useProjectStore } from '@/store';
import type { FileTreeNode } from '@/types';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  File,
  Search,
  Plus,
} from 'lucide-react';

function renderFileIcon(language: string | undefined, size: number, className: string) {
  const color = getFileColor(language);
  const props = { size, className };
  switch (language) {
    case 'typescriptreact':
    case 'javascriptreact':
    case 'typescript':
    case 'javascript':
      return <FileCode {...props} />;
    case 'css':
    case 'html':
      return <File {...props} />;
    case 'json':
      return <FileJson {...props} />;
    default:
      return <FileText {...props} />;
  }
}

function getFileColor(language?: string): string {
  switch (language) {
    case 'typescript':
    case 'typescriptreact':
      return 'text-blue-400';
    case 'javascript':
    case 'javascriptreact':
      return 'text-yellow-400';
    case 'css':
      return 'text-pink-400';
    case 'html':
      return 'text-orange-400';
    case 'json':
      return 'text-green-400';
    default:
      return 'text-zinc-400';
  }
}

function TreeNode({
  node,
  depth = 0,
}: {
  node: FileTreeNode;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const openFile = useEditorStore((s) => s.openFile);
  const activeTab = useEditorStore((s) => s.activeTab);

  const handleClick = useCallback(() => {
    if (node.type === 'folder') {
      setIsOpen(!isOpen);
    } else {
      openFile(node.path);
    }
  }, [node, isOpen, openFile]);

  const isActive = node.type === 'file' && activeTab === node.path;
  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full flex items-center gap-1.5 py-1 px-2 text-xs hover:bg-zinc-800 transition-colors ${
          isActive ? 'bg-zinc-800 text-white' : 'text-zinc-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'folder' && (
          <span className="text-zinc-500 w-3">
            {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {node.type === 'folder' ? (
          isOpen ? (
            <FolderOpen size={14} className="text-zinc-400" />
          ) : (
            <Folder size={14} className="text-zinc-400" />
          )
        ) : (
          renderFileIcon(node.language, 14, getFileColor(node.language))
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === 'folder' && isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer() {
  const getFileTree = useProjectStore((s) => s.getFileTree);
  const [search, setSearch] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const tree = getFileTree();
  const setFile = useProjectStore((s) => s.setFile);

  const handleCreateFile = useCallback(() => {
    if (newFileName.trim()) {
      setFile(newFileName.trim(), '');
      setNewFileName('');
      setShowNewFile(false);
    }
  }, [newFileName, setFile]);

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Explorer
          </span>
          <button
            onClick={() => setShowNewFile(!showNewFile)}
            className="p-1 text-zinc-500 hover:text-white transition"
            title="New file"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full bg-zinc-900 text-zinc-300 text-xs px-7 py-1.5 rounded-md border border-zinc-800 focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 outline-none placeholder:text-zinc-600"
          />
        </div>

        {/* New file input */}
        {showNewFile && (
          <div className="mt-2">
            <input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              onBlur={() => setShowNewFile(false)}
              placeholder="src/components/NewFile.tsx"
              className="w-full bg-zinc-900 text-zinc-300 text-xs px-2 py-1.5 rounded border border-zinc-700 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none placeholder:text-zinc-600"
              autoFocus
            />
          </div>
        )}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1 custom-scrollbar">
        {tree.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-zinc-600">
            No files yet.
            <br />
            Use the chat to generate code!
          </div>
        ) : (
          tree.map((node) => <TreeNode key={node.path} node={node} />)
        )}
      </div>

      {/* File count */}
      <div className="px-4 py-2 border-t border-zinc-800 text-xs text-zinc-600">
        {Object.keys(tree).length} items
      </div>
    </div>
  );
}
