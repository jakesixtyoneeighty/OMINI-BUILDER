import type { Message } from 'ai';
import React, { type RefCallback, useState, useCallback, useRef, useEffect } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useStore } from '@nanostores/react';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { ErrorBanner } from './ErrorBanner';
import { FileUploadButton } from './FileUploadButton';
import { BuildPlanDropdown } from './BuildPlanDropdown';
import { GitHubImport } from './GitHubImport.client';
import { RecentlyViewed } from './RecentlyViewed';
import type { DetectedError } from '~/lib/stores/errors';
import { chatWidthStore } from '~/lib/stores/layout';
import { chatStore } from '~/lib/stores/chat';

import styles from './BaseChat.module.scss';

interface ImportedFile {
  path: string;
  content: string;
}

interface ImportResult {
  files: ImportedFile[];
  stats: { totalBlobs: number; imported: number; skipped: number; truncated: boolean };
  owner?: string;
  repo?: string;
  ref?: string;
}

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importFromGithub?: (result: ImportResult) => void | Promise<void>;
  planMode?: boolean;
  onTogglePlanMode?: () => void;
  tokenUsage?: Record<number, { promptTokens: number; completionTokens: number; totalTokens: number }>;
  userQuestions?: Record<number, any>;
  answeredQuestions?: Set<number>;
  onQuestionAnswer?: (msgIndex: number, answer: string) => void;
  errorFixHandler?: (error: DetectedError) => void;
}

type BuildMode = 'standard' | 'design-system' | 'plan';

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      importFromGithub,
      planMode = false,
      onTogglePlanMode,
      tokenUsage,
      userQuestions,
      answeredQuestions,
      onQuestionAnswer,
      errorFixHandler,
    },
    ref,
  ) => {
    const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; type: string; size: number; preview: string; content: string }[]>([]);
    const [buildMode, setBuildMode] = useState<BuildMode>('standard');

    // Resizable layout state
    const chatWidthPct = useStore(chatWidthStore);
    const showWorkbench = useStore(chatStore).started;
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Resize handle logic
    const handleResizeStart = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = chatWidthPct;
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const containerWidth = containerEl.offsetWidth;

      const handleMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const deltaPct = (delta / containerWidth) * 100;
        const newPct = Math.min(80, Math.max(20, startWidth + deltaPct));
        chatWidthStore.set(newPct);
      };

      const handleUp = () => {
        setIsResizing(false);
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    }, [chatWidthPct]);

    const handleFileSelected = useCallback((files: File[]) => {
      files.forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          setAttachedFiles((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: file.name,
              type: file.type,
              size: file.size,
              preview: isImage ? result : '',
              content: result,
            },
          ]);
        };
        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }, []);

    const removeAttachedFile = useCallback((id: string) => {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const getFileIcon = (type: string, name: string) => {
      if (type.startsWith('image/')) return 'i-ph:image';
      if (type.includes('pdf')) return 'i-ph:file-pdf';
      if (type.includes('json')) return 'i-ph:brackets-curly';
      if (name.endsWith('.zip')) return 'i-ph:archive';
      if (name.endsWith('.html') || name.endsWith('.css')) return 'i-ph:code';
      if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.jsx')) return 'i-ph:file-js';
      if (name.endsWith('.py')) return 'i-ph:file-py';
      return 'i-ph:file';
    };

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    // Build attachment text to prepend when sending
    const buildAttachmentPrefix = useCallback(() => {
      return attachedFiles.map((f) => {
        const isImage = f.type.startsWith('image/');
        if (isImage) {
          return `[Image: ${f.name}]\n${f.preview}\n\n`;
        }
        return `[File: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\`\n\n`;
      }).join('');
    }, [attachedFiles]);

    const handleSendWithAttachments = useCallback((event: React.UIEvent) => {
      if (isStreaming) {
        handleStop?.();
        return;
      }
      // Prepend attachment content to message
      const prefix = buildAttachmentPrefix();
      if (prefix && textareaRef?.current) {
        const textarea = textareaRef.current;
        const currentVal = textarea.value;
        const newVal = prefix + currentVal;
        const syntheticEvent = {
          target: { value: newVal },
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
        handleInputChange?.(syntheticEvent);
        // Clear attachments after sending
        setAttachedFiles([]);
      }
      sendMessage?.(event);
    }, [isStreaming, handleStop, sendMessage, buildAttachmentPrefix, handleInputChange, textareaRef]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSendWithAttachments(event);
      }
    }, [sendMessage]);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <div ref={containerRef} className={classNames('flex w-full h-full', { 'overflow-y-auto': !chatStarted })}>
          {/* Chat panel - resizable */}
          <div
            className={classNames(styles.Chat, 'flex flex-col h-full shrink-0')}
            style={chatStarted ? { width: `${chatWidthPct}%`, minWidth: '280px' } : undefined}
          >

            {/* ============ LANDING PAGE VIEW (Bolt.new style) ============ */}
            {!chatStarted && (
              <div className="w-full flex flex-col h-full relative overflow-y-auto">
                {/* Background gradient with arc decoration - theme-aware */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {/* Main gradient */}
                  <div className="absolute top-0 left-0 right-0 h-[70%]" style={{ background: `linear-gradient(to bottom, var(--bolt-elements-homepage-gradient-from), var(--bolt-elements-homepage-gradient-to))` }} />
                  {/* Decorative arcs */}
                  <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[120%] h-[500px] border-[1px] rounded-[50%]" style={{ borderColor: 'var(--bolt-elements-homepage-arc)' }} />
                  <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[90%] h-[400px] border-[1px] rounded-[50%]" style={{ borderColor: 'var(--bolt-elements-homepage-arc)', opacity: 0.5 }} />
                  {/* Gradient glow at bottom center */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl" style={{ background: `linear-gradient(to top, var(--bolt-elements-homepage-glow), transparent)` }} />
                  {/* Subtle accent dot */}
                  <div className="absolute top-[35%] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--bolt-elements-homepage-arc)' }} />
                </div>

                {/* Hero Section */}
                <div className="mt-[12vh] max-w-2xl mx-auto px-4 text-center relative z-10">
                  {/* Headline */}
                  <h1 className="text-4xl sm:text-[52px] font-bold text-bolt-elements-textPrimary mb-4 leading-[1.1] tracking-tight">
                    What will you{' '}
                    <span className="text-bolt-elements-item-contentAccent">build</span>
                    {' '}today?
                  </h1>

                  {/* Subtitle */}
                  <p className="text-base text-bolt-elements-textTertiary mb-10 max-w-md mx-auto leading-relaxed">
                    Create stunning apps & websites by chatting with AI.
                  </p>
                </div>

                {/* "Let's build" Input Card */}
                <div className="px-4 pb-4 relative z-10">
                  <div className="relative w-full max-w-chat mx-auto z-prompt">
                    {/* Input card */}
                    <div
                      className={classNames(
                        'border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 flex flex-col overflow-hidden',
                        planMode || buildMode === 'plan' ? 'border-bolt-elements-item-contentAccent/50 shadow-[0_0_0_2px_rgba(129,140,248,0.1)]' : 'border-bolt-elements-borderColor shadow-sm',
                      )}
                    >
                      {/* Card header */}
                      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                        <span className="text-sm font-semibold text-bolt-elements-textPrimary">Let&apos;s build</span>
                      </div>

                      {/* Attached files preview */}
                      {attachedFiles.length > 0 && (
                        <div className="px-3 pt-1 pb-1">
                          <div className="flex flex-wrap gap-2">
                            {attachedFiles.map((file) => (
                              <div
                                key={file.id}
                                className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary/30 transition-all"
                              >
                                {file.type.startsWith('image/') ? (
                                  <img
                                    src={file.preview}
                                    alt={file.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-bolt-elements-borderColor"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                                    <div className={`${getFileIcon(file.type, file.name)} text-base text-bolt-elements-textTertiary`} />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-medium text-bolt-elements-textPrimary truncate max-w-[100px]">{file.name}</span>
                                  <span className="text-[9px] text-bolt-elements-textTertiary">{formatFileSize(file.size)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAttachedFile(file.id)}
                                  className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textTertiary hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                                >
                                  <div className="i-ph:x-bold text-[8px]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Textarea area */}
                      <div className="px-4 pt-1 pb-1">
                        <textarea
                          ref={textareaRef}
                          className="w-full py-2 px-1 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[48px]"
                          onKeyDown={handleKeyDown}
                          value={input}
                          onChange={(event) => {
                            handleInputChange?.(event);
                            const el = event.target;
                            el.style.height = 'auto';
                            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                          }}
                          placeholder="How can Omni-Builder help you today?"
                          translate="no"
                          rows={2}
                          style={{ maxHeight: 180 }}
                        />
                      </div>

                      {/* Divider */}
                      <div className="mx-4 border-t border-bolt-elements-borderColor" />

                      {/* Toolbar row with build modes + Build now button */}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        {/* Left group: + button + mode options */}
                        <div className="flex items-center gap-1.5">
                          {/* + file upload */}
                          <ClientOnly>
                            {() => <FileUploadButton onFilesSelected={handleFileSelected} />}
                          </ClientOnly>

                          {/* Separator */}
                          <div className="w-px h-5 bg-bolt-elements-borderColor mx-0.5" />

                          {/* Standard mode */}
                          <button
                            type="button"
                            onClick={() => setBuildMode('standard')}
                            className={classNames(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                              buildMode === 'standard'
                                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
                            )}
                          >
                            <div className="i-ph:code text-sm" />
                            Standard
                          </button>

                          {/* Design System mode */}
                          <button
                            type="button"
                            onClick={() => setBuildMode('design-system')}
                            className={classNames(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                              buildMode === 'design-system'
                                ? 'bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary'
                                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
                            )}
                          >
                            <div className="i-ph:palette text-sm" />
                            Design System
                          </button>

                          {/* Plan mode */}
                          <button
                            type="button"
                            onClick={() => {
                              setBuildMode('plan');
                              if (!planMode) onTogglePlanMode?.();
                            }}
                            className={classNames(
                              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                              buildMode === 'plan'
                                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                                : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary hover:bg-bolt-elements-item-backgroundActive',
                            )}
                          >
                            <div className="i-ph:list-checks text-sm" />
                            Plan
                          </button>
                        </div>

                        {/* Right group: Build now button */}
                        <button
                          type="button"
                          onClick={handleSendWithAttachments}
                          disabled={!input && !isStreaming && attachedFiles.length === 0}
                          className={classNames(
                            'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]',
                            isStreaming
                              ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent'
                              : input || attachedFiles.length > 0
                                ? 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110 shadow-sm'
                                : 'text-white bg-bolt-elements-item-contentAccent/60 cursor-not-allowed',
                          )}
                        >
                          Build now
                          <div className="i-ph:arrow-right text-sm" />
                        </button>
                      </div>
                    </div>
                    {/* End input card */}

                    {/* "or start from" row */}
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="text-xs text-bolt-elements-textTertiary">or start from</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                        >
                          <div className="i-ph:figma-logo text-sm" />
                          Figma
                        </button>

                        {importFromGithub && (
                          <ClientOnly>{() => <GitHubImport onImport={importFromGithub} />}</ClientOnly>
                        )}

                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                        >
                          <div className="i-ph:files text-sm" />
                          Team template
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recently viewed section */}
                <div className="pb-8 pt-6 relative z-10">
                  <RecentlyViewed />
                </div>
              </div>
            )}

            {/* ============ CHAT VIEW ============ */}
            {chatStarted && (
              <div className="flex flex-col h-full w-full">
                {/* Messages area - scrollable */}
                <div className="flex-1 overflow-y-auto px-4 pt-4">
                  <ClientOnly>
                    {() => (
                      <>
                        <ClientOnly>{() => <ErrorBanner onFixError={errorFixHandler} />}</ClientOnly>
                        <Messages
                          ref={messageRef}
                          className="flex flex-col w-full max-w-chat mx-auto z-1"
                          messages={messages}
                          isStreaming={isStreaming}
                          tokenUsage={tokenUsage}
                          userQuestions={userQuestions}
                          answeredQuestions={answeredQuestions}
                          onQuestionAnswer={onQuestionAnswer}
                        />
                      </>
                    )}
                  </ClientOnly>
                </div>

                {/* Sticky input at bottom - card style matching landing page */}
                <div className="shrink-0 px-4 pb-4 pt-2">
                  <div className="relative w-full max-w-chat mx-auto z-prompt">
                    <div
                      className={classNames(
                        'border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 flex flex-col',
                        planMode ? 'border-bolt-elements-item-contentAccent/50 shadow-[0_0_0_2px_rgba(129,140,248,0.1)]' : 'border-bolt-elements-borderColor shadow-sm',
                      )}
                    >
                      {/* Attached files preview */}
                      {attachedFiles.length > 0 && (
                        <div className="px-3 pt-3 pb-1">
                          <div className="flex flex-wrap gap-2">
                            {attachedFiles.map((file) => (
                              <div
                                key={file.id}
                                className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor hover:border-bolt-elements-textTertiary/30 transition-all"
                              >
                                {file.type.startsWith('image/') ? (
                                  <img
                                    src={file.preview}
                                    alt={file.name}
                                    className="w-8 h-8 rounded-lg object-cover border border-bolt-elements-borderColor"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                                    <div className={`${getFileIcon(file.type, file.name)} text-base text-bolt-elements-textTertiary`} />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-medium text-bolt-elements-textPrimary truncate max-w-[100px]">{file.name}</span>
                                  <span className="text-[9px] text-bolt-elements-textTertiary">{formatFileSize(file.size)}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeAttachedFile(file.id)}
                                  className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textTertiary hover:text-red-400 hover:border-red-400/50 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                                >
                                  <div className="i-ph:x-bold text-[8px]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Textarea area */}
                      <div className="px-4 pt-3 pb-1">
                        <textarea
                          ref={textareaRef}
                          className="w-full py-1 px-1 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[32px]"
                          onKeyDown={handleKeyDown}
                          value={input}
                          onChange={(event) => {
                            handleInputChange?.(event);
                            const el = event.target;
                            el.style.height = 'auto';
                            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                          }}
                          placeholder="How can Omni-Builder help you today? (or /command)"
                          translate="no"
                          rows={1}
                          style={{ maxHeight: 180 }}
                        />
                      </div>

                      {/* Divider */}
                      <div className="mx-4 border-t border-bolt-elements-borderColor" />

                      {/* Toolbar row */}
                      <div className="flex items-center justify-between px-3 py-2">
                        {/* Left group */}
                        <div className="flex items-center gap-2">
                          <ClientOnly>
                            {() => <FileUploadButton onFilesSelected={handleFileSelected} />}
                          </ClientOnly>
                          <ClientOnly>
                            {() => (
                              <BuildPlanDropdown
                                planMode={planMode}
                                isStreaming={isStreaming}
                                onBuild={() => { if (planMode) onTogglePlanMode?.(); }}
                                onPlan={() => { if (!planMode) onTogglePlanMode?.(); }}
                              />
                            )}
                          </ClientOnly>
                        </div>

                        {/* Right: Send button */}
                        <button
                          type="button"
                          onClick={handleSendWithAttachments}
                          disabled={!input && !isStreaming && attachedFiles.length === 0}
                          className={classNames(
                            'flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95',
                            isStreaming
                              ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                              : input || attachedFiles.length > 0
                                ? 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110'
                                : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textSecondary',
                          )}
                        >
                          {isStreaming ? (
                            <div className="i-ph:stop-bold text-[13px]" />
                          ) : (
                            <div className="i-ph:arrow-up-bold text-[14px]" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ============ FLOATING AI INPUT (visible when chat panel is hidden) ============ */}
            {chatStarted && !showChat && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[700px] px-4">
                <div
                  className={classNames(
                    'flex items-center gap-2 border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 px-3 py-3 shadow-lg',
                    'border-bolt-elements-borderColor',
                  )}
                >
                  {/* Left: file upload */}
                  <ClientOnly>
                    {() => <FileUploadButton onFilesSelected={handleFileSelected} />}
                  </ClientOnly>

                  {/* Center: textarea */}
                  <textarea
                    ref={textareaRef}
                    className="flex-1 py-2 px-2 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[32px]"
                    onKeyDown={handleKeyDown}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                      const el = event.target;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                    }}
                    placeholder="How can Omni-Builder help you today? (or /command)"
                    translate="no"
                    rows={1}
                    style={{ maxHeight: 300 }}
                  />

                  {/* Right side buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ClientOnly>
                      {() => (
                        <BuildPlanDropdown
                          planMode={planMode}
                          isStreaming={isStreaming}
                          onBuild={() => { if (planMode) onTogglePlanMode?.(); }}
                          onPlan={() => { if (!planMode) onTogglePlanMode?.(); }}
                        />
                      )}
                    </ClientOnly>

                    {/* Send button - always visible */}
                    <button
                      type="button"
                      onClick={handleSendWithAttachments}
                      disabled={!input && !isStreaming && attachedFiles.length === 0}
                      className={classNames(
                        'flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95',
                        isStreaming
                          ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                          : input || attachedFiles.length > 0
                            ? 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110'
                            : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textSecondary',
                      )}
                    >
                      {isStreaming ? (
                        <div className="i-ph:stop-bold text-[13px]" />
                      ) : (
                        <div className="i-ph:arrow-up-bold text-[14px]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Resize handle - only visible when chat is started */}
          {chatStarted && (
            <div
              onMouseDown={handleResizeStart}
              className={classNames(
                'relative w-[5px] shrink-0 cursor-col-resize group z-10',
                isResizing ? 'bg-bolt-elements-item-contentAccent' : 'hover:bg-bolt-elements-borderColorActive',
                'transition-colors duration-100',
              )}
              title="Drag to resize"
            >
              {/* Visible handle indicator */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full bg-bolt-elements-borderColor group-hover:bg-bolt-elements-item-contentAccent transition-colors" />
            </div>
          )}

          {/* Workbench panel - takes remaining space */}
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
