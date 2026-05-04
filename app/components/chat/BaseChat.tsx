import type { Message } from 'ai';
import React, { type RefCallback } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Menu } from '~/components/sidebar/Menu.client';
import { SettingsDialog } from '~/components/header/SettingsDialog.client';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { GitHubImport } from './GitHubImport.client';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
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

interface AttachedFile {
  name: string;
  content: string;
  type: string;
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

const TEXTAREA_MIN_HEIGHT = 52;

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
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 300 : 160;

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
                <div
                  className={classNames(
                    'shadow-sm border bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] rounded-xl transition-colors duration-200 overflow-hidden',
                    planMode ? 'border-blue-400/60' : 'border-bolt-elements-borderColor',
                  )}
                >
                  {/* Top toolbar: file upload + textarea + send button */}
                  <div className="flex items-end gap-1 p-2">
                    {/* Left side: file upload + voice */}
                    <div className="flex items-center gap-0.5 shrink-0 pb-1">
                      <ClientOnly>
                        {() => (
                          <FileUploadButton
                            onFilesSelected={(files) => {
                              files.forEach((file) => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const content = reader.result as string;
                                  const fileName = file.name;
                                  const isImage = file.type.startsWith('image/');
                                  const prefix = isImage
                                    ? `[Arquivo de imagem: ${fileName}]\n`
                                    : `[Arquivo: ${fileName}]\n\`\`\`\n${content}\n\`\`\`\n\n`;

                                  if (textareaRef?.current) {
                                    const textarea = textareaRef.current;
                                    const start = textarea.selectionStart;
                                    const end = textarea.selectionEnd;
                                    const currentVal = textarea.value;
                                    const newVal = currentVal.substring(0, start) + prefix + currentVal.substring(end);
                                    // Simulate onChange to update input
                                    const nativeEvent = new Event('input', { bubbles: true });
                                    const reactEvent = {
                                      target: { value: newVal },
                                    } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
                                    handleInputChange?.(reactEvent);
                                  }
                                };
                                if (isImage) {
                                  reader.readAsDataURL(file);
                                } else {
                                  reader.readAsText(file);
                                }
                              });
                            }}
                          />
                        )}
                      </ClientOnly>
                      <ClientOnly>
                        {() => (
                          <VoiceRecordButton
                            onTranscript={(text) => {
                              if (textareaRef?.current) {
                                const textarea = textareaRef.current;
                                const start = textarea.selectionStart;
                                const end = textarea.selectionEnd;
                                const currentVal = textarea.value;
                                const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
                                const reactEvent = {
                                  target: { value: newVal },
                                } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
                                handleInputChange?.(reactEvent);
                              }
                            }}
                          />
                        )}
                      </ClientOnly>
                    </div>

                    {/* Center: textarea */}
                    <textarea
                      ref={textareaRef}
                      className="flex-1 py-2.5 px-3 focus:outline-none resize-none text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed"
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          if (event.shiftKey) {
                            return;
                          }

                          event.preventDefault();
                          sendMessage?.(event);
                        }
                      }}
                      value={input}
                      onChange={(event) => {
                        handleInputChange?.(event);
                      }}
                      style={{
                        minHeight: TEXTAREA_MIN_HEIGHT,
                        maxHeight: TEXTAREA_MAX_HEIGHT,
                      }}
                      placeholder={planMode ? 'Modo Plano — descreva seu projeto...' : 'Ask Omni...'}
                      translate="no"
                      rows={1}
                    />

                    {/* Right side: send / stop */}
                    <div className="flex items-center gap-1 shrink-0 pb-1">
                      <ClientOnly>
                        {() => (
                          <SendButton
                            show={input.length > 0 || isStreaming}
                            isStreaming={isStreaming}
                            onClick={(event) => {
                              if (isStreaming) {
                                handleStop?.();
                                return;
                              }
                              sendMessage?.(event);
                            }}
                          />
                        )}
                      </ClientOnly>
                    </div>
                  </div>

                  {/* Bottom toolbar: model picker, enhance, build/plan, settings */}
                  <div className="flex items-center justify-between px-2 pb-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      {/* Model Picker */}
                      <ClientOnly>{() => <ModelPicker />}</ClientOnly>

                      {/* Enhance prompt */}
                      <button
                        type="button"
                        title="Enhance prompt"
                        disabled={input.length === 0 || enhancingPrompt}
                        className={classNames(
                          'flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all disabled:opacity-40',
                          enhancingPrompt
                            ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
                            : promptEnhanced
                              ? 'text-bolt-elements-item-contentAccent hover:bg-bolt-elements-item-backgroundAccent'
                              : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive',
                        )}
                        onClick={() => enhancePrompt?.()}
                      >
                        {enhancingPrompt ? (
                          <div className="i-svg-spinners:90-ring-with-bg text-xs" />
                        ) : (
                          <div className="i-bolt:stars text-xs" />
                        )}
                        {!enhancingPrompt && <span>{promptEnhanced ? 'Enhanced' : 'Enhance'}</span>}
                      </button>

                      {/* Shift+Return hint */}
                      {input.length > 3 && (
                        <div className="text-[10px] text-bolt-elements-textTertiary hidden sm:block">
                          <kbd className="px-1 py-0.5 rounded bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-[9px]">Shift+Enter</kbd>
                          <span className="ml-1">nova linha</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Build / Plan dropdown */}
                      <ClientOnly>
                        {() => (
                          <BuildPlanDropdown
                            planMode={planMode}
                            isStreaming={isStreaming}
                            onBuild={() => {
                              if (planMode) onTogglePlanMode?.();
                            }}
                            onPlan={() => {
                              if (!planMode) onTogglePlanMode?.();
                            }}
                          />
                        )}
                      </ClientOnly>

                      {/* Settings */}
                      <ClientOnly>{() => <SettingsDialog />}</ClientOnly>
                    </div>
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
