// ============================================================
// Omni-Builder — ChatPanel Component
// ============================================================
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, useProjectStore, useEditorStore } from '@/store';
import { useCodeGeneration } from '@/hooks/use-code-generation';
import type { ChatMessage, FileArtifact } from '@/types';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Square,
  Sparkles,
  FileCode,
  Trash2,
  Bot,
  User,
  ChevronDown,
} from 'lucide-react';

function ArtifactBadge({ artifact }: { artifact: FileArtifact }) {
  const openFile = useEditorStore((s) => s.openFile);
  const actionLabel =
    artifact.action === 'create'
      ? 'Created'
      : artifact.action === 'update'
        ? 'Updated'
        : 'Deleted';

  const actionColor =
    artifact.action === 'create'
      ? 'text-green-400 bg-green-400/10'
      : artifact.action === 'update'
        ? 'text-blue-400 bg-blue-400/10'
        : 'text-red-400 bg-red-400/10';

  return (
    <button
      onClick={() => artifact.action !== 'delete' && openFile(artifact.path)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${actionColor} hover:opacity-80 ${
        artifact.action !== 'delete' ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <FileCode size={12} />
      <span>{actionLabel}</span>
      <span className="font-mono">{artifact.path}</span>
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
      <div
        className={`flex-1 min-w-0 ${
          isUser ? 'text-right' : ''
        }`}
      >
        <div
          className={`inline-block text-left rounded-xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-violet-600 text-white rounded-tr-sm'
              : 'bg-zinc-800 text-zinc-200 rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-zinc-900 [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs [&_code_block]:text-xs [&_p]:m-0">
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
          <div className="mt-2 flex flex-wrap gap-2">
            {message.artifacts.map((a) => (
              <ArtifactBadge key={a.path} artifact={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const messages = useChatStore((s) => s.messages);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const clearChat = useChatStore((s) => s.clearChat);
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

  // Quick action prompts
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
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
              disabled={!input.trim()}
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
