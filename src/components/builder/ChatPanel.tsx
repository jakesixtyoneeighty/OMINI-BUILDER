// ============================================================
// Omni-Builder — ChatPanel Component
// ============================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, useEditorStore, useAIProviderStore } from '@/store';
import { useCodeGeneration } from '@/hooks/use-code-generation';
import type { ChatMessage, FileArtifact } from '@/types';
import {
  Send,
  Square,
  Sparkles,
  FileCode,
  Trash2,
  Bot,
  User,
  Settings,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2 as TrashIcon,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import for ReactMarkdown to avoid SSR hydration issues
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  ssr: false,
  loading: () => <span className="text-zinc-400 text-xs">Loading...</span>,
});

const ACTION_ICONS: Record<string, any> = {
  create: Plus,
  update: Pencil,
  modify: Pencil,
  delete: TrashIcon,
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Modified',
  modify: 'Modified',
  delete: 'Deleted',
};

const ACTION_COLORS: Record<string, string> = {
  create: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  update: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  modify: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  delete: 'text-red-400 bg-red-400/10 border-red-400/20',
};

function ArtifactBadge({ artifact }: { artifact: FileArtifact }) {
  const openFile = useEditorStore((s) => s.openFile);
  const action = artifact.action === 'modify' ? 'update' : artifact.action;
  const Icon = ACTION_ICONS[action] ?? Plus;
  const label = ACTION_LABELS[action] ?? action;
  const color = ACTION_COLORS[action] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20';

  return (
    <button
      onClick={() => action !== 'delete' && openFile(artifact.path)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition hover:opacity-80 ${
        action !== 'delete' ? 'cursor-pointer' : 'cursor-default'
      } ${color}`}
    >
      <Icon size={11} />
      <span>{label}</span>
      <span className="font-mono text-[10px] opacity-70">{artifact.path}</span>
    </button>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
          isUser
            ? 'bg-violet-600 text-white'
            : 'bg-zinc-800 text-zinc-300'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div
          className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed max-w-full ${
            isUser
              ? 'bg-violet-600 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div
              className="
                [&_p]:m-0 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_p+p]:mt-2
                [&_ul]:m-1 [&_ol]:m-1 [&_li]:m-0.5 [&_li]:text-zinc-300
                [&_table]:w-full [&_table]:text-xs [&_table]:my-2 [&_table]:border-collapse
                [&_th]:bg-zinc-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-zinc-200 [&_th]:font-semibold [&_th]:border [&_th]:border-zinc-600
                [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-zinc-700 [&_td]:text-zinc-300
                [&_tr:hover]:bg-zinc-700/30
                [&_pre]:bg-zinc-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-xs
                [&_code]:text-xs [&_code]:bg-zinc-900/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                [&_strong]:text-white [&_em]:text-violet-300
                [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-3 [&_h1]:mb-1
                [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-2 [&_h2]:mb-1
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-zinc-100 [&_h3]:mt-2 [&_h3]:mb-1
                [&_a]:text-violet-400 [&_a]:underline [&_a:hover]:text-violet-300
                [&_blockquote]:border-l-2 [&_blockquote]:border-violet-500/50 [&_blockquote]:pl-3 [&_blockquote]:text-zinc-400 [&_blockquote]:italic [&_blockquote]:my-2
                [&_hr]:border-zinc-700 [&_hr]:my-3
              "
            >
              <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
            </div>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && (
            <span className="inline-block w-2 h-4 bg-violet-400 ml-0.5 animate-pulse rounded-sm" />
          )}
        </div>

        {/* File artifacts */}
        {message.artifacts && message.artifacts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.artifacts.map((a) => (
              <ArtifactBadge key={a.path} artifact={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ onOpenSettings }: { onOpenSettings?: () => void }) {
  const [input, setInput] = useState('');
  const messages = useChatStore((s) => s.messages);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const clearChat = useChatStore((s) => s.clearChat);
  const aiConfig = useAIProviderStore((s) => s.config);
  const { generate, stopGeneration } = useCodeGeneration();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;
    setInput('');
    generate(trimmed);
  }, [input, isGenerating, generate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const quickPrompts = [
    'Build a landing page',
    'Create a dashboard',
    'Make a todo app',
    'Build a calculator',
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-violet-400" />
          <span className="text-sm font-medium text-zinc-200">AI Chat</span>
          {aiConfig.apiKey && (
            <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">
              {aiConfig.model.split('/').pop()}
            </span>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="p-1.5 text-zinc-500 hover:text-red-400 transition"
            title="Clear chat"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar relative">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-violet-600/20 flex items-center justify-center mb-4">
              <Sparkles size={24} className="text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">
              What would you like to build?
            </h3>
            <p className="text-xs text-zinc-500 mb-6 max-w-[240px]">
              Describe your app idea and I&apos;ll generate a complete, working
              web application for you.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-[280px]">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt);
                    generate(prompt);
                  }}
                  className="text-xs text-left px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Provider not configured warning */}
      {!aiConfig.apiKey && (
        <div className="px-3 pb-1">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2.5 flex items-center gap-2">
            <AlertTriangle size={14} className="text-yellow-400 shrink-0" />
            <p className="text-[11px] text-yellow-300 flex-1">
              Configure your AI API key to start generating code.
            </p>
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 rounded-lg text-[10px] font-semibold transition"
            >
              <Settings size={9} />
              Setup
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-zinc-800 p-3">
        <div className="relative flex items-end bg-zinc-900 rounded-xl border border-zinc-800 focus-within:border-violet-500 focus-within:ring-1 focus-within:ring-violet-500 transition">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-zinc-200 px-4 py-3 resize-none outline-none placeholder:text-zinc-600 max-h-32 min-h-[40px]"
            style={{
              height: 'auto',
              minHeight: '40px',
              maxHeight: '128px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />

          {isGenerating ? (
            <button
              onClick={stopGeneration}
              className="p-2 m-1.5 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800"
              title="Stop generation"
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !aiConfig.apiKey}
              className="p-2 m-1.5 text-zinc-400 hover:text-white transition rounded-lg hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-zinc-600 mt-2 text-center">
          Omni-Builder generates complete web apps from your descriptions
        </p>
      </div>
    </div>
  );
}
