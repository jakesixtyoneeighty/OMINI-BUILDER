import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { llmStore } from '~/lib/stores/llm';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore, projectsStore, getActiveProject } from '~/lib/stores/project';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat } = useStore(chatStore);
  const llm = useStore(llmStore);
  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);

  const [animationScope, animate] = useAnimate();

  // Build database config from project settings
  const getDatabaseConfig = () => {
    const current = projects[projectId] ?? getActiveProject();
    const db = current.settings?.database;
    if (!db || db.type === 'none') return undefined;
    if (db.type === 'firebase' && db.firebase?.apiKey) {
      return { type: 'firebase' as const, firebase: { apiKey: db.firebase.apiKey, authDomain: db.firebase.authDomain, projectId: db.firebase.projectId, storageBucket: db.firebase.storageBucket, messagingSenderId: db.firebase.messagingSenderId, appId: db.firebase.appId } };
    }
    if (db.type === 'supabase' && db.supabase?.url) {
      return { type: 'supabase' as const, supabase: { url: db.supabase.url, anonKey: db.supabase.anonKey } };
    }
    return undefined;
  };

  const { messages, setMessages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.keys[llm.provider] || '',
      databaseConfig: getDatabaseConfig(),
    },
    onError: async (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
    },
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
    if (projectId && projectId !== 'default') {
      workbenchStore.loadProjectFiles(projectId);
    }

    // Restore files from localStorage cache on page load
    const hasCachedFiles = workbenchStore.filesStore.loadFilesFromCache();
    if (hasCachedFiles) {
      const currentFiles = workbenchStore.files.get();
      workbenchStore.setDocuments(currentFiles);
      if (Object.keys(currentFiles).length > 0) {
        workbenchStore.showWorkbench.set(true);
        if (!chatStarted) {
          runAnimation();
        }
      }
    }
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);
    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages]);

  const runAnimation = async () => {
    if (chatStarted) return;
    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);
    chatStore.setKey('started', true);
    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;
    if (_input.length === 0 || isLoading) return;

    await workbenchStore.saveAllFiles();
    const fileModifications = workbenchStore.getFileModifcations();
    chatStore.setKey('aborted', false);
    runAnimation();

    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      append({ role: 'user', content: `${diff}\n\n${_input}` });
      workbenchStore.resetAllFileModifications();
    } else {
      append({ role: 'user', content: _input });
    }
    setInput('');
    resetEnhancer();
  };

  const [messageRef, scrollRef] = useSnapScroll();

  const importFromGithub = async (result: any) => {
    try {
      if (!result.files || result.files.length === 0) {
        toast.error('Nenhum arquivo encontrado para importar.');
        return;
      }

      const { webcontainer } = await import('~/lib/webcontainer');
      const wc = await webcontainer;

      // Clear workspace
      try {
        await workbenchStore.clearWorkspace();
      } catch (clearErr) {
        console.warn('clearWorkspace failed, continuing anyway:', clearErr);
      }

      // Build directory tree first to create all folders
      const dirs = new Set<string>();
      for (const f of result.files) {
        const parts = f.path.split('/');
        for (let i = 1; i < parts.length; i++) {
          dirs.add(parts.slice(0, i).join('/'));
        }
      }

      for (const dir of dirs) {
        try {
          await wc.fs.mkdir(dir, { recursive: true });
        } catch {}
      }

      // Write all files to WebContainer and update file store
      let written = 0;
      let failed = 0;

      for (const f of result.files) {
        try {
          await wc.fs.writeFile(f.path, f.content);
          workbenchStore.files.setKey(f.path, { type: 'file', content: f.content, isBinary: false });
          written++;
        } catch (err) {
          console.error('Failed to write', f.path, err);
          failed++;
        }
      }

      // Set documents so the editor shows the files
      const currentFiles = workbenchStore.files.get();
      workbenchStore.setDocuments(currentFiles);
      workbenchStore.showWorkbench.set(true);
      runAnimation();

      // Save to localStorage for persistence across reloads
      workbenchStore.filesStore.saveFilesToCache();

      if (written > 0) {
        toast.success(`${written} arquivo${written > 1 ? 's' : ''} importado${written > 1 ? 's' : ''} com sucesso!${failed > 0 ? ` (${failed} falharam)` : ''}`);
      } else {
        toast.error('Nenhum arquivo pôde ser escrito. Verifique o console para detalhes.');
      }
    } catch (err) {
      console.error('Import error:', err);
      toast.error(`Erro na importação: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
    }
  };

  return (
    <BaseChat
      importFromGithub={importFromGithub}
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={stop}
      messages={messages.map((m, i) => ({ ...m, content: parsedMessages[i] || m.content }))}
      enhancePrompt={() => enhancePrompt(input, setInput)}
    />
  );
});