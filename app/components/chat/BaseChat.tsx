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
import { VoiceRecordButton } from './VoiceRecordButton';
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
    const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string }[]>([]);

    const handleFileSelected = useCallback((files: File[]) => {
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const content = reader.result as string;
          const isImage = file.type.startsWith('image/');
          const prefix = isImage
            ? `[Image: ${file.name}]\n`
            : `[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\`\n\n`;

          if (textareaRef?.current) {
            const textarea = textareaRef.current;
            const currentVal = textarea.value;
            const newVal = currentVal + prefix;
            const syntheticEvent = {
              target: { value: newVal },
            } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
            handleInputChange?.(syntheticEvent);
            // Focus and scroll to end
            textarea.focus();
            requestAnimationFrame(() => {
              textarea.scrollTop = textarea.scrollHeight;
            });
          }
        };
        if (isImage) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }, [textareaRef, handleInputChange]);

    const handleSend = useCallback((event: React.UIEvent) => {
      if (isStreaming) {
        handleStop?.();
        return;
      }
      sendMessage?.(event);
    }, [isStreaming, handleStop, sendMessage]);

    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage?.(event);
      }
    }, [sendMessage]);

    const showSendButton = input.length > 0 || isStreaming;

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
            {!chatStarted && (
              <div id="intro" className="mt-[26vh] max-w-chat mx-auto">
                <h1 className="text-5xl text-center font-bold text-bolt-elements-textPrimary mb-2">
                  Where ideas begin
                </h1>
                <p className="mb-4 text-center text-bolt-elements-textSecondary">
                  Bring ideas to life in seconds or get help on existing projects.
                </p>
                {importFromGithub && (
                  <div className="flex justify-center mt-4">
                    <ClientOnly>{() => <GitHubImport onImport={importFromGithub} />}</ClientOnly>
                  </div>
                )}
              </div>
            )}
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
              <div
                className={classNames('relative w-full max-w-chat mx-auto z-prompt', {
                  'sticky bottom-0': chatStarted,
                })}
              >
                {/* Single-row input container - matches Lovable style */}
                <div
                  className={classNames(
                    'flex items-center gap-2 border rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 px-2 py-1.5',
                    planMode ? 'border-blue-400/50 shadow-[0_0_0_2px_rgba(96,165,250,0.1)]' : 'border-bolt-elements-borderColor shadow-sm',
                  )}
                >
                  {/* Left: + button */}
                  <ClientOnly>
                    {() => <FileUploadButton onFilesSelected={handleFileSelected} />}
                  </ClientOnly>

                  {/* Enhance button */}
                  <button
                    type="button"
                    title="Enhance prompt"
                    disabled={input.length === 0 || enhancingPrompt}
                    onClick={() => enhancePrompt?.()}
                    className={classNames(
                      'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 disabled:opacity-30',
                      enhancingPrompt
                        ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                        : promptEnhanced
                          ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                          : 'text-bolt-elements-textSecondary border border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textPrimary/40',
                    )}
                  >
                    {enhancingPrompt ? (
                      <div className="i-svg-spinners:90-ring-with-bg text-[11px]" />
                    ) : (
                      <div className="i-bolt:stars text-[11px]" />
                    )}
                    {!enhancingPrompt && <span>Enhance</span>}
                  </button>

                  {/* Center: textarea */}
                  <textarea
                    ref={textareaRef}
                    className="flex-1 py-1.5 px-2 focus:outline-none resize-none text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[24px]"
                    onKeyDown={handleKeyDown}
                    value={input}
                    onChange={(event) => {
                      handleInputChange?.(event);
                      // Auto-resize
                      const el = event.target;
                      el.style.height = 'auto';
                      el.style.height = Math.min(el.scrollHeight, chatStarted ? 200 : 120) + 'px';
                    }}
                    placeholder="Ask Omni..."
                    translate="no"
                    rows={1}
                    style={{ maxHeight: chatStarted ? 200 : 120 }}
                  />

                  {/* Right side buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Model picker - compact */}
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

                    {/* Microphone */}
                    <ClientOnly>
                      {() => <VoiceRecordButton onTranscript={(text) => {
                        if (textareaRef?.current) {
                          const textarea = textareaRef.current;
                          const newVal = textarea.value + (textarea.value ? ' ' : '') + text;
                          const syntheticEvent = {
                            target: { value: newVal },
                          } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
                          handleInputChange?.(syntheticEvent);
                          textarea.focus();
                        }
                      }} />}
                    </ClientOnly>

                    {/* Send / Stop button */}
                    {showSendButton && (
                      <button
                        type="button"
                        onClick={handleSend}
                        className={classNames(
                          'flex items-center justify-center w-7 h-7 rounded-full transition-all active:scale-95',
                          isStreaming
                            ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                            : 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110',
                        )}
                      >
                        {isStreaming ? (
                          <div className="i-ph:stop-bold text-[12px]" />
                        ) : (
                          <div className="i-ph:arrow-up-bold text-[13px]" />
                        )}
                      </button>
                    )}

                    {/* Settings */}
                    <ClientOnly>{() => <SettingsDialog />}</ClientOnly>
                  </div>
                </div>
                <div className="bg-bolt-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
              </div>
            </div>
            {!chatStarted && (
              <div id="examples" className="relative w-full max-w-xl mx-auto mt-8 flex justify-center">
                <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                  {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                    return (
                      <button
                        key={index}
                        onClick={(event) => {
                          sendMessage?.(event, examplePrompt.text);
                        }}
                        className="group flex items-center w-full gap-2 justify-center bg-transparent text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-theme"
                      >
                        {examplePrompt.text}
                        <div className="i-ph:arrow-bend-down-left" />
                      </button>
                    );
                  })}
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
