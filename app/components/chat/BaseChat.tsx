import type { Message } from 'ai';
import React, { type RefCallback, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useStore } from '@nanostores/react';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { ErrorBanner } from './ErrorBanner';
import { FileUploadButton } from './FileUploadButton';
import { BuildPlanDropdown } from './BuildPlanDropdown';
import { GitHubImport } from './GitHubImport.client';
import { CloneSite } from './CloneSite.client';
import { Messages } from './Messages.client';
import { RecentlyViewed } from './RecentlyViewed';
import { FileMentionDropdown } from './FileMentionDropdown.client';
import { AuthDialog } from '~/components/header/AuthDialog.client';
import { authStore } from '~/lib/stores/auth';
import type { DetectedError } from '~/lib/stores/errors';
import { chatWidthStore, mobileViewStore, settingsPanelStore } from '~/lib/stores/layout';
import { chatStore } from '~/lib/stores/chat';
import { ModelPicker } from '~/components/header/ModelPicker.client';
import { SettingsDialog } from '~/components/header/SettingsDialog.client';
import { AppSettingsDialog } from '~/components/header/AppSettingsDialog.client';
import { workbenchStore } from '~/lib/stores/workbench';
import {
  inspectorStore,
  clearInspectorElements,
  removeInspectorElement,
  type InspectorElement,
} from '~/lib/stores/inspector';
import { useT } from '~/lib/i18n/useT';
import { useIsMobile } from '~/utils/mobile';

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

export interface ChatAttachment {
  name?: string;
  contentType?: string;
  url: string;
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
  sendMessage?: (event: React.UIEvent, messageInput?: string, attachments?: ChatAttachment[]) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  importFromGithub?: (result: ImportResult) => void | Promise<void>;
  onCloneSite?: (url: string) => void | Promise<void>;
  planMode?: boolean;
  onTogglePlanMode?: () => void;
  onProceed?: () => void;
  tokenUsage?: Record<number, { promptTokens: number; completionTokens: number; totalTokens: number }>;
  userQuestions?: Record<number, any>;
  answeredQuestions?: Set<number>;
  onQuestionAnswer?: (msgIndex: number, answer: string) => void;
  errorFixHandler?: (error: DetectedError) => void;
}

type BuildMode = 'standard' | 'design-system' | 'plan';

const landingInputGlowKeyframes = `
@keyframes landing-input-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

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
      onCloneSite,
      planMode = false,
      onTogglePlanMode,
      onProceed,
      tokenUsage,
      userQuestions,
      answeredQuestions,
      onQuestionAnswer,
      errorFixHandler,
    },
    ref,
  ) => {
    const [attachedFiles, setAttachedFiles] = useState<
      { id: string; name: string; type: string; size: number; preview: string; content: string }[]
    >([]);
    const [buildMode, setBuildMode] = useState<BuildMode>('standard');
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const { user } = useStore(authStore);
    const inspectorElements = useStore(inspectorStore).selectedElements;
    const t = useT();

    // @ file mention state
    const [mentionState, setMentionState] = useState<{
      active: boolean;
      search: string;
      position: { top: number; left: number };
      mentionStart: number; // index of @ in the input
    } | null>(null);
    const [mentionedFiles, setMentionedFiles] = useState<{ path: string; content: string }[]>([]);

    // / slash command state
    const [slashState, setSlashState] = useState<{
      active: boolean;
      search: string;
      position: { top: number; left: number };
      slashStart: number;
    } | null>(null);
    const thinkMode = useStore(chatStore).thinkMode;

    // Resizable layout state
    const chatWidthPct = useStore(chatWidthStore);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isResizing, setIsResizing] = useState(false);

    // Mobile responsive state
    const _mobile = useIsMobile();
    const mobileView = useStore(mobileViewStore);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const settingsPanel = useStore(settingsPanelStore);

    // Resize handle logic
    const handleResizeStart = useCallback(
      (e: React.MouseEvent) => {
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
      },
      [chatWidthPct],
    );

    const handleFileSelected = useCallback((files: File[]) => {
      files.forEach((file) => {
        const isImage = file.type.startsWith('image/');
        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
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
              preview: isImage ? result : isVideo ? 'video' : isAudio ? 'audio' : '',
              content: result,
            },
          ]);
        };
        // Always read as DataURL so attachments work with the AI SDK Attachment type
        reader.readAsDataURL(file);
      });
    }, []);

    const removeAttachedFile = useCallback((id: string) => {
      setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
    }, []);

    const getFileIcon = (type: string, name: string) => {
      if (type.startsWith('image/')) return 'i-ph:image';
      if (type.startsWith('video/')) return 'i-ph:video-camera';
      if (type.startsWith('audio/')) return 'i-ph:music-note';
      if (type.includes('pdf')) return 'i-ph:file-pdf';
      if (type.includes('json')) return 'i-ph:brackets-curly';
      if (name.endsWith('.zip')) return 'i-ph:archive';
      if (name.endsWith('.html') || name.endsWith('.css')) return 'i-ph:code';
      if (name.endsWith('.js') || name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.jsx'))
        return 'i-ph:file-js';
      if (name.endsWith('.py')) return 'i-ph:file-py';
      return 'i-ph:file';
    };

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    // Build structured attachments for sending (not text prefix)
    const buildAttachments = useCallback((): ChatAttachment[] => {
      const attachments: ChatAttachment[] = [];

      // File attachments
      for (const f of attachedFiles) {
        attachments.push({
          name: f.name,
          contentType: f.type,
          url: f.content, // Already a data URL since we always readAsDataURL
        });
      }

      // Inspector element attachments - as JSON data URLs
      for (const el of inspectorElements) {
        const elData = {
          type: 'inspector-element',
          tagName: el.tagName,
          selector: el.selector,
          className: el.className,
          textContent: el.textContent,
          attributes: el.attributes,
          dimensions: el.dimensions,
          styles: el.styles,
          isInShadowDom: el.isInShadowDom,
        };
        const jsonStr = JSON.stringify(elData, null, 2);
        const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonStr)}`;
        attachments.push({
          name: formatInspectorChipLabel(el),
          contentType: 'application/json',
          url: dataUrl,
        });
      }

      return attachments;
    }, [attachedFiles, inspectorElements]);

    /** Tag icon map for inspector element types */
    const getElementIcon = (tagName: string): string => {
      const map: Record<string, string> = {
        button: 'i-ph:cursor-click',
        input: 'i-ph:text-cursor',
        textarea: 'i-ph:text-aa',
        a: 'i-ph:link',
        img: 'i-ph:image',
        video: 'i-ph:video-camera',
        h1: 'i-ph:text-h',
        h2: 'i-ph:text-h',
        h3: 'i-ph:text-h',
        h4: 'i-ph:text-h',
        h5: 'i-ph:text-h',
        h6: 'i-ph:text-h',
        p: 'i-ph:text-paragraph',
        span: 'i-ph:text-aa',
        div: 'i-ph:square-dashed',
        section: 'i-ph:squares-four',
        nav: 'i-ph:navigation-arrow',
        header: 'i-ph:caret-line-up',
        footer: 'i-ph:caret-line-down',
        form: 'i-ph:note-pencil',
        select: 'i-ph:list',
        table: 'i-ph:table',
        ul: 'i-ph:list-bullets',
        ol: 'i-ph:list-numbers',
        li: 'i-ph:minus',
        svg: 'i-ph:path',
        iframe: 'i-ph:browser',
        label: 'i-ph:tag',
      };
      return map[tagName] || 'i-ph:code';
    };

    const formatInspectorChipLabel = (el: InspectorElement) => {
      const tag = el.tagName;
      const mainClass = el.className
        ? el.className
            .split(' ')
            .filter((c: string) => c && !c.startsWith('__') && !c.startsWith('css-'))
            .slice(0, 1)[0]
        : '';
      const id = el.attributes?.id ? '#' + el.attributes.id : '';
      if (mainClass) return `${tag}.${mainClass}`;
      if (id) return `${tag}${id}`;
      return tag;
    };

    const handleSendWithAttachments = useCallback(
      async (event: React.UIEvent) => {
        if (isStreaming) {
          handleStop?.();
          return;
        }
        // Login is required to use the chat
        if (!user) {
          setAuthModalOpen(true);
          return;
        }

        // Build structured attachments (sent alongside the message, NOT as text)
        const attachments = buildAttachments();

        // Clear all attachment states before sending
        setAttachedFiles([]);
        setMentionedFiles([]);
        clearInspectorElements();
        setMentionState(null);

        // Send message with structured attachments - NO text prefix added
        try {
          await sendMessage?.(event, undefined, attachments.length > 0 ? attachments : undefined);
        } catch (err) {
          console.error('[BaseChat] Erro ao enviar mensagem:', err);
        }
      },
      [
        isStreaming,
        handleStop,
        sendMessage,
        buildAttachments,
        handleInputChange,
        textareaRef,
        user,
        attachedFiles,
        inspectorElements.length,
        mentionedFiles,
      ],
    );

    // Handle @ file mention selection
    const handleMentionSelect = useCallback(
      (filePath: string) => {
        if (!mentionState || !textareaRef?.current) return;

        const textarea = textareaRef.current;
        const currentVal = textarea.value;

        // Get file content and add to mentioned files
        const files = workbenchStore.files.get();
        const file = files[filePath];
        const displayPath = filePath.replace(/^\/home\/project\//, '');

        if (file && file.type === 'file' && !file.isBinary) {
          setMentionedFiles((prev) => {
            if (prev.some((f) => f.path === filePath)) return prev;
            return [...prev, { path: displayPath, content: file.content }];
          });
        }

        // Replace @search with @displayPath in the input
        const before = currentVal.slice(0, mentionState.mentionStart);
        const after = currentVal.slice(textarea.selectionStart);
        const newVal = `${before}@${displayPath} ${after}`;

        const syntheticEvent = {
          target: { value: newVal },
        } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
        handleInputChange?.(syntheticEvent);

        setMentionState(null);

        // Focus back on textarea
        setTimeout(() => {
          textarea.focus();
          const cursorPos = before.length + displayPath.length + 2; // +2 for @ and space
          textarea.setSelectionRange(cursorPos, cursorPos);
        }, 0);
      },
      [mentionState, handleInputChange],
    );

    // Detect @ in textarea input
    const handleInputChangeWithMention = useCallback(
      (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        handleInputChange?.(event);

        const textarea = event.target;
        const value = textarea.value;
        const cursorPos = textarea.selectionStart;

        // Find if cursor is after an @ that starts a mention
        const textBeforeCursor = value.slice(0, cursorPos);
        const atMatch = textBeforeCursor.match(/@([\w./_-]*)$/);

        if (atMatch) {
          const mentionStart = cursorPos - atMatch[0].length;
          const search = atMatch[1];

          // Get textarea position for dropdown — position ABOVE the input
          const rect = textarea.getBoundingClientRect();
          // Find the input card parent to position relative to it
          const inputCard = textarea.closest('[data-input-card]') || textarea.parentElement;
          const cardRect = inputCard?.getBoundingClientRect() || rect;

          setMentionState({
            active: true,
            search,
            position: {
              // Position above the textarea
              top: rect.top - 4,
              left: Math.min(rect.left + 16, window.innerWidth - 304),
            },
            mentionStart,
          });
          setSlashState(null); // close slash menu if open
        } else {
          setMentionState(null);
        }

        // Detect / slash commands
        const slashMatch = textBeforeCursor.match(/\/([\w-]*)$/);
        if (slashMatch && !atMatch) {
          const slashStart = cursorPos - slashMatch[0].length;
          const search = slashMatch[1];
          const rect = textarea.getBoundingClientRect();
          setSlashState({
            active: true,
            search,
            position: {
              top: rect.top - 4,
              left: Math.min(rect.left + 16, window.innerWidth - 280),
            },
            slashStart,
          });
        } else if (!atMatch) {
          setSlashState(null);
        }
      },
      [handleInputChange],
    );

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        // If mention dropdown is open, let it handle navigation keys
        if (mentionState?.active && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab')) {
          event.preventDefault();
          return;
        }
        if (event.key === 'Escape' && mentionState?.active) {
          setMentionState(null);
          event.preventDefault();
          return;
        }
        // If slash command dropdown is open
        if (slashState?.active && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Tab')) {
          event.preventDefault();
          return;
        }
        if (event.key === 'Escape' && slashState?.active) {
          setSlashState(null);
          event.preventDefault();
          return;
        }
        if (event.key === 'Enter' && !event.shiftKey) {
          if (mentionState?.active) {
            // Let the dropdown handle Enter
            return;
          }
          event.preventDefault();
          handleSendWithAttachments(event);
        }
      },
      [handleSendWithAttachments, mentionState],
    );

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-bolt-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <div
          ref={containerRef}
          className={classNames(
            'flex w-full h-full',
            { 'overflow-y-auto': !chatStarted },
            _mobile && chatStarted ? 'flex-col' : '',
          )}
        >
          {/* Chat panel - resizable */}
          <div
            className={classNames(
              styles.Chat,
              'flex flex-col h-full transition-[width] duration-200 ease-in-out',
              _mobile && chatStarted
                ? mobileView === 'chat'
                  ? 'flex-1 w-full min-h-0'
                  : 'hidden'
                : chatStarted && (showWorkbench || settingsPanel.open)
                  ? 'shrink-0'
                  : 'flex-1',
            )}
            style={
              chatStarted && !_mobile
                ? { width: (showWorkbench || settingsPanel.open) ? `${chatWidthPct}%` : '100%', minWidth: '280px' }
                : undefined
            }
          >
            {/* ============ LANDING PAGE VIEW (Bolt.new style) ============ */}
            {!chatStarted && (
              <div className="w-full flex flex-col h-full relative overflow-y-auto">
                {/* Background gradient with arc decoration - theme-aware */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  {/* Main gradient */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[70%]"
                    style={{
                      background: `linear-gradient(to bottom, var(--bolt-elements-homepage-gradient-from), var(--bolt-elements-homepage-gradient-to))`,
                    }}
                  />
                  {/* Decorative arcs */}
                  <div
                    className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[120%] h-[500px] border-[1px] rounded-[50%]"
                    style={{ borderColor: 'var(--bolt-elements-homepage-arc)' }}
                  />
                  <div
                    className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[90%] h-[400px] border-[1px] rounded-[50%]"
                    style={{ borderColor: 'var(--bolt-elements-homepage-arc)', opacity: 0.5 }}
                  />
                  {/* Gradient glow at bottom center */}
                  <div
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-3xl"
                    style={{ background: `linear-gradient(to top, var(--bolt-elements-homepage-glow), transparent)` }}
                  />
                  {/* Subtle accent dot */}
                  <div
                    className="absolute top-[35%] left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--bolt-elements-homepage-arc)' }}
                  />
                </div>

                {/* Hero Section */}
                <div className="mt-[12vh] max-w-2xl mx-auto px-4 text-center relative z-10">
                  {/* Headline */}
                  <h1 className="text-4xl sm:text-[52px] font-bold text-bolt-elements-textPrimary mb-4 leading-[1.1] tracking-tight">
                    {t('landing.headline')}{' '}
                    <span className="text-bolt-elements-item-contentAccent">{t('landing.headlineAccent')}</span>{' '}
                    {t('landing.headlineEnd')}
                  </h1>

                  {/* Subtitle */}
                  <p className="text-base text-bolt-elements-textTertiary mb-6 max-w-md mx-auto leading-relaxed">
                    {t('landing.subtitle')}
                  </p>

                  {/* Model picker + API Settings */}
                  <div className="flex justify-center items-center gap-2 mb-8">
                    <ClientOnly>{() => <ModelPicker />}</ClientOnly>
                    <ClientOnly>{() => <SettingsDialog />}</ClientOnly>
                  </div>
                </div>

                {/* "Let's build" Input Card */}
                <div className="px-4 pb-4 relative z-10">
                  <div className="relative w-full max-w-chat mx-auto z-prompt">
                    <style>{landingInputGlowKeyframes}</style>
                    <div
                      className="relative rounded-[18px] p-[1px] overflow-hidden"
                      style={{
                        background: 'rgba(124,58,237,0.15)',
                      }}
                    >
                      {/* Rotating shine line */}
                      <div
                        className="absolute inset-0 rounded-[18px]"
                        style={{
                          background: 'conic-gradient(from 0deg, transparent 0deg, transparent 300deg, rgba(139,92,246,0.9) 350deg, rgba(96,165,250,0.9) 358deg, transparent 360deg)',
                          animation: 'landing-input-spin 4s linear infinite',
                          filter: 'blur(1px)',
                        }}
                      />
                      {/* Input card */}
                      <div
                        className={classNames(
                          'relative border border-transparent rounded-2xl bg-bolt-elements-prompt-background backdrop-filter backdrop-blur-[8px] transition-all duration-200 flex flex-col overflow-hidden',
                          planMode || buildMode === 'plan' ? 'shadow-[0_0_0_2px_rgba(129,140,248,0.12)]' : 'shadow-sm',
                        )}
                      >
                        {/* Card header */}
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                          <span className="text-sm font-semibold text-bolt-elements-textPrimary">
                            {t('landing.letsBuild')}
                          </span>
                        </div>

                        {/* Mentioned files chips */}
                        {mentionedFiles.length > 0 && (
                          <div className="px-3 pt-1 pb-1">
                            <div className="flex flex-wrap gap-1.5">
                              {mentionedFiles.map((f, i) => (
                                <div
                                  key={`mention-${i}`}
                                  className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                                >
                                  <div className="i-ph:file-js text-xs text-blue-400" />
                                  <span className="text-[11px] font-medium text-blue-400 truncate max-w-[140px]">
                                    {f.path}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setMentionedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                    className="text-blue-400/50 hover:text-red-400 transition-colors"
                                  >
                                    <div className="i-ph:x-bold text-[8px]" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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
                                  ) : file.type.startsWith('video/') ? (
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                      <div className="i-ph:video-camera text-base text-purple-400" />
                                    </div>
                                  ) : file.type.startsWith('audio/') ? (
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                      <div className="i-ph:music-note text-base text-pink-400" />
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                                      <div
                                        className={`${getFileIcon(file.type, file.name)} text-base text-bolt-elements-textTertiary`}
                                      />
                                    </div>
                                  )}
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[11px] font-medium text-bolt-elements-textPrimary truncate max-w-[100px]">
                                      {file.name}
                                    </span>
                                    <span className="text-[9px] text-bolt-elements-textTertiary">
                                      {formatFileSize(file.size)}
                                    </span>
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

                        {/* Inspector elements (like attached files from the preview inspector) */}
                        {inspectorElements.length > 0 && (
                          <div className="px-3 pt-1 pb-1">
                            <div className="flex flex-wrap gap-1.5">
                              {inspectorElements.map((el) => (
                                <div
                                  key={el.id}
                                  className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                                >
                                  <div
                                    className={classNames(
                                      getElementIcon(el.tagName),
                                      'text-xs text-orange-400 shrink-0',
                                    )}
                                  />
                                  <code className="text-[11px] text-orange-400 font-mono truncate max-w-[120px]">
                                    {formatInspectorChipLabel(el)}
                                  </code>
                                  {el.textContent && (
                                    <span className="text-[9px] text-bolt-elements-textTertiary truncate max-w-[60px]">
                                      {el.textContent.substring(0, 20)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeInspectorElement(el.id)}
                                    className="text-orange-400/50 hover:text-red-400 transition-colors"
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
                          {/* Think mode blue chip */}
                          {thinkMode && (
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[13px] font-semibold mb-1.5 select-none"
                              style={{
                                color: '#60a5fa',
                                background: 'rgba(59, 130, 246, 0.12)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                              }}
                            >
                              <div className="i-ph:brain text-sm" />
                              /think
                              <button
                                type="button"
                                onClick={() => chatStore.setKey('thinkMode', false)}
                                className="ml-0.5 hover:text-red-400 transition-colors"
                                style={{ lineHeight: 1 }}
                              >
                                <div className="i-ph:x-bold text-[8px]" />
                              </button>
                            </span>
                          )}
                          <textarea
                            ref={textareaRef}
                            className="w-full py-2 px-1 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[48px]"
                            onKeyDown={handleKeyDown}
                            value={input}
                            onChange={(event) => {
                              handleInputChangeWithMention(event);
                              const el = event.target;
                              el.style.height = 'auto';
                              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                            }}
                            placeholder={t('landing.placeholder')}
                            translate="no"
                            rows={2}
                            style={{ maxHeight: 180 }}
                          />
                        </div>

                        {/* Divider */}
                        <div className="mx-4 border-t border-bolt-elements-borderColor" />

                        {/* Toolbar row with build modes + Build now button */}
                        <div className="flex items-center justify-between px-2 sm:px-3 py-2.5 gap-1 flex-wrap sm:flex-nowrap">
                          {/* Left group: + button + mode options */}
                          <div className="flex items-center gap-1.5">
                            {/* + file upload */}
                            <ClientOnly>{() => <FileUploadButton onFilesSelected={handleFileSelected} />}</ClientOnly>

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
                              <span className="hidden sm:inline">{t('landing.standard')}</span>
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
                              <span className="hidden sm:inline">{t('landing.designSystem')}</span>
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
                              <span className="hidden sm:inline">{t('landing.plan')}</span>
                            </button>
                          </div>

                          {/* Right group: Build now button */}
                          <button
                            type="button"
                            onClick={handleSendWithAttachments}
                            disabled={
                              !input && !isStreaming && attachedFiles.length === 0 && inspectorElements.length === 0
                            }
                            className={classNames(
                              'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.97]',
                              isStreaming
                                ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent'
                                : input || attachedFiles.length > 0 || inspectorElements.length > 0
                                  ? 'text-white bg-bolt-elements-item-contentAccent hover:brightness-110 shadow-sm'
                                  : 'text-white bg-bolt-elements-item-contentAccent/60 cursor-not-allowed',
                            )}
                          >
                            {t('landing.buildNow')}
                            <div className="i-ph:arrow-right text-sm" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* End input card */}

                    {/* "or start from" row - GitHub/ZIP/Folder + Clone Site */}
                    <div className="mt-3 flex items-center justify-center gap-3">
                      <span className="text-xs text-bolt-elements-textTertiary">{t('landing.orStartFrom')}</span>
                      <div className="flex items-center gap-2">
                        {importFromGithub && (
                          <ClientOnly>{() => <GitHubImport onImport={importFromGithub} />}</ClientOnly>
                        )}
                        {onCloneSite && <ClientOnly>{() => <CloneSite onClone={onCloneSite} />}</ClientOnly>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recently viewed section */}
                <div className="pb-8 pt-6 relative z-10">
                  <ClientOnly>{() => <RecentlyViewed />}</ClientOnly>
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
                          planMode={planMode}
                          onProceed={onProceed}
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
                        planMode
                          ? 'border-bolt-elements-item-contentAccent/50 shadow-[0_0_0_2px_rgba(129,140,248,0.1)]'
                          : 'border-bolt-elements-borderColor shadow-sm',
                      )}
                    >
                      {/* Mentioned files chips */}
                      {mentionedFiles.length > 0 && (
                        <div className="px-3 pt-3 pb-1">
                          <div className="flex flex-wrap gap-1.5">
                            {mentionedFiles.map((f, i) => (
                              <div
                                key={`mention-${i}`}
                                className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all"
                              >
                                <div className="i-ph:file-js text-xs text-blue-400" />
                                <span className="text-[11px] font-medium text-blue-400 truncate max-w-[140px]">
                                  {f.path}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setMentionedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="text-blue-400/50 hover:text-red-400 transition-colors"
                                >
                                  <div className="i-ph:x-bold text-[8px]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

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
                                ) : file.type.startsWith('video/') ? (
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <div className="i-ph:video-camera text-base text-purple-400" />
                                  </div>
                                ) : file.type.startsWith('audio/') ? (
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20">
                                    <div className="i-ph:music-note text-base text-pink-400" />
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                                    <div
                                      className={`${getFileIcon(file.type, file.name)} text-base text-bolt-elements-textTertiary`}
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-medium text-bolt-elements-textPrimary truncate max-w-[100px]">
                                    {file.name}
                                  </span>
                                  <span className="text-[9px] text-bolt-elements-textTertiary">
                                    {formatFileSize(file.size)}
                                  </span>
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

                      {/* Inspector elements (like attached files from the preview inspector) */}
                      {inspectorElements.length > 0 && (
                        <div className="px-3 pt-3 pb-1">
                          <div className="flex flex-wrap gap-1.5">
                            {inspectorElements.map((el) => (
                              <div
                                key={el.id}
                                className="group relative flex items-center gap-1.5 px-2 py-1 rounded-lg bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                              >
                                <div
                                  className={classNames(getElementIcon(el.tagName), 'text-xs text-orange-400 shrink-0')}
                                />
                                <code className="text-[11px] text-orange-400 font-mono truncate max-w-[120px]">
                                  {formatInspectorChipLabel(el)}
                                </code>
                                {el.textContent && (
                                  <span className="text-[9px] text-bolt-elements-textTertiary truncate max-w-[60px]">
                                    {el.textContent.substring(0, 20)}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeInspectorElement(el.id)}
                                  className="text-orange-400/50 hover:text-red-400 transition-colors"
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
                        {/* Think mode blue chip */}
                        {thinkMode && (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[13px] font-semibold mb-1.5 select-none"
                            style={{
                              color: '#60a5fa',
                              background: 'rgba(59, 130, 246, 0.12)',
                              border: '1px solid rgba(59, 130, 246, 0.25)',
                            }}
                          >
                            <div className="i-ph:brain text-sm" />
                            /think
                            <button
                              type="button"
                              onClick={() => chatStore.setKey('thinkMode', false)}
                              className="ml-0.5 hover:text-red-400 transition-colors"
                              style={{ lineHeight: 1 }}
                            >
                              <div className="i-ph:x-bold text-[8px]" />
                            </button>
                          </span>
                        )}
                        <textarea
                          ref={textareaRef}
                          className="w-full py-1 px-1 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[32px]"
                          onKeyDown={handleKeyDown}
                          value={input}
                          onChange={(event) => {
                            handleInputChangeWithMention(event);
                            const el = event.target;
                            el.style.height = 'auto';
                            el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                          }}
                          placeholder={t('landing.placeholder')}
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
                          <ClientOnly>{() => <FileUploadButton onFilesSelected={handleFileSelected} />}</ClientOnly>
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
                        </div>

                        {/* Right: Send button */}
                        <button
                          type="button"
                          onClick={handleSendWithAttachments}
                          disabled={
                            !input && !isStreaming && attachedFiles.length === 0 && inspectorElements.length === 0
                          }
                          className={classNames(
                            'flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95',
                            isStreaming
                              ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                              : input || attachedFiles.length > 0 || inspectorElements.length > 0
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
                  <ClientOnly>{() => <FileUploadButton onFilesSelected={handleFileSelected} />}</ClientOnly>

                  {/* Center: textarea with think chip */}
                  <div className="flex-1 flex flex-col min-w-0">
                    {thinkMode && (
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[13px] font-semibold mb-1 select-none self-start"
                        style={{
                          color: '#60a5fa',
                          background: 'rgba(59, 130, 246, 0.12)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                        }}
                      >
                        <div className="i-ph:brain text-sm" />
                        /think
                        <button
                          type="button"
                          onClick={() => chatStore.setKey('thinkMode', false)}
                          className="ml-0.5 hover:text-red-400 transition-colors"
                          style={{ lineHeight: 1 }}
                        >
                          <div className="i-ph:x-bold text-[8px]" />
                        </button>
                      </span>
                    )}
                    <textarea
                      ref={textareaRef}
                      className="w-full py-1 px-1 focus:outline-none resize-none text-[15px] text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary bg-transparent leading-relaxed min-h-[32px]"
                      onKeyDown={handleKeyDown}
                      value={input}
                      onChange={(event) => {
                        handleInputChangeWithMention(event);
                        const el = event.target;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 200) + 'px';
                      }}
                      placeholder={t('landing.placeholder')}
                      translate="no"
                      rows={1}
                      style={{ maxHeight: 300 }}
                    />
                  </div>

                  {/* Right side buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
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

                    {/* Send button - always visible */}
                    <button
                      type="button"
                      onClick={handleSendWithAttachments}
                      disabled={!input && !isStreaming && attachedFiles.length === 0 && inspectorElements.length === 0}
                      className={classNames(
                        'flex items-center justify-center w-8 h-8 rounded-full transition-all active:scale-95',
                        isStreaming
                          ? 'text-bolt-elements-textSecondary bg-bolt-elements-item-backgroundActive hover:bg-bolt-elements-item-backgroundAccent hover:text-bolt-elements-item-contentAccent'
                          : input || attachedFiles.length > 0 || inspectorElements.length > 0
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

          {/* Resize handle - only visible when chat is started, a right panel is open, and not mobile */}
          {chatStarted && !_mobile && (showWorkbench || settingsPanel.open) && (
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

          {/* Right panel: Settings Panel (priority) or Workbench */}
          {/* Settings Panel - replaces workbench when open */}
          {settingsPanel.open && chatStarted && (
            <div
              className={classNames(
                _mobile ? 'flex-1 w-full min-h-0' : 'flex-1 min-w-0',
                'transition-[width,flex] duration-200 ease-in-out',
              )}
            >
              <ClientOnly>{() => <AppSettingsDialog />}</ClientOnly>
            </div>
          )}

          {/* Workbench panel - hidden when settings is open, or on landing page. On mobile show full width when active */}
          {!settingsPanel.open && (
            <div
              className={classNames(
                !chatStarted
                  ? 'hidden'
                  : _mobile
                    ? mobileView === 'workbench'
                      ? 'flex-1 w-full min-h-0'
                      : 'hidden'
                    : showWorkbench
                      ? 'flex-1 min-w-0'
                      : 'w-0 min-w-0 overflow-hidden',
                'transition-[width,flex] duration-200 ease-in-out',
              )}
            >
              <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
            </div>
          )}

          {/* Mobile bottom tab bar - only when chat started */}
          {_mobile && chatStarted && (
            <div className="flex items-center shrink-0 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 h-12">
              <button
                type="button"
                onClick={() => mobileViewStore.set('chat')}
                className={classNames(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all',
                  mobileView === 'chat' ? 'text-bolt-elements-item-contentAccent' : 'text-bolt-elements-textTertiary',
                )}
              >
                <div className="i-ph:chat-circle-dots text-base" />
                Chat
              </button>
              <button
                type="button"
                onClick={() => {
                  mobileViewStore.set('workbench');
                  workbenchStore.showWorkbench.set(true);
                }}
                className={classNames(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-all',
                  mobileView === 'workbench'
                    ? 'text-bolt-elements-item-contentAccent'
                    : 'text-bolt-elements-textTertiary',
                )}
              >
                <div className="i-ph:eye text-base" />
                Preview
              </button>
            </div>
          )}
        </div>
        {/* @ File Mention Dropdown */}
        {mentionState?.active && (
          <ClientOnly>
            {() => (
              <FileMentionDropdown
                search={mentionState.search}
                position={mentionState.position}
                onSelect={handleMentionSelect}
                onClose={() => setMentionState(null)}
              />
            )}
          </ClientOnly>
        )}

        {/* / Slash Command Dropdown */}
        {slashState?.active && (
          <div
            className="fixed z-[9999] w-[260px] rounded-xl border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 shadow-2xl overflow-hidden"
            style={{ bottom: window.innerHeight - slashState.position.top + 8, left: slashState.position.left }}
          >
            <div className="px-3 py-2 text-[9px] uppercase tracking-wider text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1">
              Comandos
            </div>
            <button
              className={classNames(
                'w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-bolt-elements-item-backgroundActive transition-colors',
                thinkMode ? 'bg-blue-500/10' : '',
              )}
              onClick={() => {
                // Toggle think mode
                chatStore.setKey('thinkMode', !thinkMode);
                // Remove /think or / from input
                if (textareaRef?.current) {
                  const val = textareaRef.current.value;
                  const newVal = val.replace(/\/think\s*$/, '').replace(/\/\s*$/, '');
                  const syntheticEvent = {
                    target: { value: newVal },
                  } as unknown as React.ChangeEvent<HTMLTextAreaElement>;
                  handleInputChange?.(syntheticEvent);
                }
                setSlashState(null);
                setTimeout(() => textareaRef?.current?.focus(), 0);
              }}
            >
              <div
                className={classNames(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  thinkMode
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary',
                )}
              >
                <div className="i-ph:brain text-base" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={classNames(
                    'text-xs font-medium',
                    thinkMode ? 'text-blue-400' : 'text-bolt-elements-textPrimary',
                  )}
                >
                  /think
                </div>
                <div className="text-[10px] text-bolt-elements-textTertiary">
                  Pense melhor — raciocinio mais profundo e visivel
                </div>
              </div>
              {thinkMode && <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />}
            </button>
          </div>
        )}

        {/* Mentioned files indicators — removed, now shown inside input card */}

        <ClientOnly>{() => <AuthDialog open={authModalOpen} onClose={() => setAuthModalOpen(false)} />}</ClientOnly>
      </div>
    );
  },
);
