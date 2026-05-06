import type { Message } from 'ai';
import React, { type RefCallback, useState, useCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { SettingsDialog } from '~/components/header/SettingsDialog.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { GitHubImport } from './GitHubImport.client';
import { Messages } from './Messages.client';
import { ModelPicker } from '../header/ModelPicker.client';
import { ErrorBanner } from './ErrorBanner';
import { FileUploadButton } from './FileUploadButton';
import { BuildPlanDropdown } from './BuildPlanDropdown';
import type { DetectedError } from '~/lib/stores/errors';

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

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind' },
  { text: 'Build a simple blog using Astro' },
  { text: 'Create a cookie consent form using Material UI' },
  { text: 'Make a space invaders game' },
  { text: 'How do I center a div?' },
];

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

    // Send button is always visible (Bolt.new style)
    const showSendButton = true;

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div ref={scrollRef} className="flex overflow-y-auto w-full h-full">
          <div className={classNames(styles.Chat, 'flex flex-col flex-grow min-w-[var(--chat-min-width)] h-full')}>

            {/* ============ LANDING PAGE VIEW (Bolt.new style) ============ */}
            {!chatStarted && (
              <div className="w-full flex flex-col h-full relative">
                {/* Subtle background gradient glow at bottom */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-blue-600/10 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

                {/* Announcement banner */}
                <div className="flex justify-center mt-4 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/15 transition-all cursor-default">
                    <div className="i-ph:sparkle-fill text-xs" />
                    Introducing Omni-Builder — AI-powered app builder
                  </span>
                </div>

                {/* Hero Section */}
                <div className="mt-[12vh] max-w-2xl mx-auto px-4 text-center relative z-10">
                  {/* Headline - Bolt style */}
                  <h1 className="text-4xl sm:text-[52px] font-bold text-bolt-elements-textPrimary mb-4 leading-[1.1] tracking-tight">
                    What will you{' '}
                    <span className="text-blue-400">build</span>
                    {' '}today?
                  </h1>

                  {/* Subtitle */}
                  <p className="text-base text-bolt-elements-textTertiary mb-10 max-w-md mx-auto leading-relaxed">
                    Create stunning apps & websites by chatting with AI.
                  </p>
                </div>

                {/* Spacer */}
                <div className="flex-1 relative z-10" />

                {/* Input Box Area */}
                <div className="px-6 pb-4 relative z-10">
                  <div className="relative w-full max-w-chat mx-auto z-prompt">
                    {/* Input box: textarea + buttons inside, buttons in separate row below */}
                    <div
                      className={classNames(
                        'border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 flex flex-col',
                        planMode ? 'border-blue-400/50 shadow-[0_0_0_2px_rgba(96,165,250,0.1)]' : 'border-bolt-elements-borderColor shadow-sm',
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

                      {/* Textarea area - top */}
                      <div className="px-4 pt-3 pb-1">
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
                          placeholder="What do you want to build?"
                          translate="no"
                          rows={2}
                          style={{ maxHeight: 180 }}
                        />
                      </div>

                      {/* Divider */}
                      <div className="mx-4 border-t border-bolt-elements-borderColor" />

                      {/* Buttons toolbar row - inside the same box */}
                      <div className="flex items-center justify-between px-3 py-2.5">
                        {/* Left group */}
                        <div className="flex items-center gap-2">
                          {/* + file upload */}
                          <ClientOnly>
                            {() => <FileUploadButton onFilesSelected={handleFileSelected} />}
                          </ClientOnly>

                          {/* Model picker */}
                          <ClientOnly>{() => <ModelPicker />}</ClientOnly>

                          {/* Build / Plan dropdown */}
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

                        {/* Right group */}
                        <div className="flex items-center gap-2">
                          {/* Send / Stop button - always visible */}
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
                    {/* End input box */}

                    {/* "or start from" links - Bolt style */}
                    {importFromGithub && (
                      <div className="mt-3 flex items-center justify-center gap-3">
                        <span className="text-xs text-bolt-elements-textTertiary">or start from</span>
                        <ClientOnly>{() => <GitHubImport onImport={importFromGithub} />}</ClientOnly>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============ CHAT VIEW ============ */}
            <div
              className={classNames('pt-6 px-6', {
                'h-full flex flex-col': chatStarted,
              })}
            >
              <ClientOnly>
                {() => {
                  return chatStarted ? (
                    <>
                      <ClientOnly>{() => <ErrorBanner onFixError={errorFixHandler} />}</ClientOnly>
                      <Messages
                        ref={messageRef}
                        className="flex flex-col w-full flex-1 max-w-chat px-4 pb-6 mx-auto z-1"
                        messages={messages}
                        isStreaming={isStreaming}
                        tokenUsage={tokenUsage}
                        userQuestions={userQuestions}
                        answeredQuestions={answeredQuestions}
                        onQuestionAnswer={onQuestionAnswer}
                      />
                    </>
                  ) : null;
                }}
              </ClientOnly>
              {chatStarted && (
                <div
                  className="relative w-full max-w-chat mx-auto z-prompt sticky bottom-0"
                >
                  {/* Attached files preview - chat view */}
                  {attachedFiles.length > 0 && (
                    <div className="mb-2 p-2 rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-prompt-background backdrop-blur-[8px]">
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

                  {/* Chat input - single row inline layout */}
                  <div
                    className={classNames(
                      'flex items-center gap-2.5 border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 px-3 py-3',
                      planMode ? 'border-blue-400/50 shadow-[0_0_0_2px_rgba(96,165,250,0.1)]' : 'border-bolt-elements-borderColor shadow-sm',
                    )}
                  >
                    {/* Left: + button */}
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
                      placeholder="What do you want to build?"
                      translate="no"
                      rows={1}
                      style={{ maxHeight: 300 }}
                    />

                    {/* Right side buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ClientOnly>{() => <ModelPicker />}</ClientOnly>

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
                          'flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-95',
                          isStreaming
                            ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                            : input || attachedFiles.length > 0
                              ? 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110'
                              : 'text-bolt-elements-textTertiary bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textSecondary',
                        )}
                      >
                        {isStreaming ? (
                          <div className="i-ph:stop-bold text-[12px]" />
                        ) : (
                          <div className="i-ph:arrow-up-bold text-[13px]" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
                </div>
              )}
            </div>
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
                    placeholder="What do you want to build?"
                    translate="no"
                    rows={1}
                    style={{ maxHeight: 300 }}
                  />

                  {/* Right side buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <ClientOnly>{() => <ModelPicker />}</ClientOnly>

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
          <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
        </div>
      </div>
    );
  },
);
