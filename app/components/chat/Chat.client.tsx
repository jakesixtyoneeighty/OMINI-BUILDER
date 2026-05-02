import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { llmStore } from '~/lib/stores/llm';
import { useAnimate } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore, projectsStore, getActiveProject } from '~/lib/stores/project';
import { createAutoSnapshot } from '~/lib/stores/snapshots';
import { autosaveToDrive } from './SaveToDrive.client';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { EnvRequestModal, type EnvVarRequest } from './EnvRequestModal';
import { DbRequestModal, type DbFieldRequest } from './DbRequestModal';
import { UserQuestionCard, type UserQuestionData } from './UserQuestionCard';

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
  const parsedMessagesRef = useRef(0);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [tokenUsage, setTokenUsage] = useState<
    Record<number, { promptTokens: number; completionTokens: number; totalTokens: number }>
  >({});

  const { showChat, planMode } = useStore(chatStore);
  const llm = useStore(llmStore);
  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);

  const [animationScope, animate] = useAnimate();

  // Build database config from project settings - memoized to stabilize useChat body
  const databaseConfig = useMemo(() => {
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
  }, [projects, projectId]);

  // Stabilize the useChat body to prevent unnecessary re-renders
  const chatBody = useMemo(() => ({
    provider: llm.provider,
    model: llm.model,
    apiKey: llm.keys[llm.provider] || '',
    databaseConfig,
    planMode,
  }), [llm.provider, llm.model, llm.keys, databaseConfig, planMode]);

  const { messages, setMessages, isLoading, input, handleInputChange, setInput, stop, append, data } = useChat({
    api: '/api/chat',
    body: chatBody,
    onError: async (error) => {
      logger.error('Request failed\n\n', error);

      // Extrair detalhes completos do erro
      let errorMsg = 'Erro desconhecido';
      let errorDetails = '';

      if (error instanceof Error) {
        errorMsg = error.message;
        errorDetails = error.stack || '';
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (error && typeof error === 'object') {
        errorMsg = (error as any)?.message || (error as any)?.error || JSON.stringify(error);
        errorDetails = (error as any)?.stack || '';
      }

      // Tentar extrair causa raiz de erros de API (fetch errors, etc.)
      const cause = (error as any)?.cause;
      if (cause) {
        if (cause instanceof Error) {
          errorDetails += '\n\nCausa: ' + cause.message + (cause.stack ? '\n' + cause.stack : '');
        } else if (typeof cause === 'object') {
          errorDetails += '\n\nCausa: ' + JSON.stringify(cause, null, 2);
        }
      }

      // Mostrar toast com detalhes — clicável para ver mais
      if (errorDetails) {
        toast.error(
          <div className="max-w-[400px]">
            <div className="font-semibold text-sm mb-1">{errorMsg}</div>
            <details className="mt-1">
              <summary className="text-[10px] opacity-70 cursor-pointer hover:opacity-100">Ver detalhes técnicos</summary>
              <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded p-2 overflow-auto max-h-[200px] whitespace-pre-wrap break-all opacity-80">
                {errorDetails}
              </pre>
            </details>
          </div>,
          { autoClose: 10000, closeOnClick: false },
        );
      } else {
        toast.error(errorMsg, { autoClose: 8000 });
      }
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

  // Parse token usage from AI SDK data stream parts (code "2")
  useEffect(() => {
    if (!data || data.length === 0) return;
    for (const entry of data) {
      try {
        const parsed = JSON.parse(entry);
        if (parsed.type === 'token_usage') {
          // Find the last assistant message index
          let lastAssistantIdx = messages.length - 1;
          for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
              lastAssistantIdx = i;
              break;
            }
          }
          setTokenUsage(prev => ({ ...prev, [lastAssistantIdx]: parsed }));
        }
      } catch {}
    }
  }, [data, messages.length]);

  useEffect(() => {
    parseMessages(messages, isLoading);
    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }

    // Auto-create snapshot when AI finishes a response
    if (!isLoading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === 'assistant' && lastMsg.content) {
        const prevLength = parsedMessagesRef.current;
        if (prevLength < messages.length) {
          parsedMessagesRef.current = messages.length;
          // Only snapshot if there's actual content (artifact or code)
          if (lastMsg.content.includes('boltArtifact') || lastMsg.content.includes('boltAction')) {
            createAutoSnapshot(messages.length - 1, `Msg #${messages.length}`);
          }
        }
      }

      // Auto-save to Google Drive after AI finishes (debounced)
      if (lastMsg?.role === 'assistant') {
        if (autosaveTimeoutRef.current) {
          clearTimeout(autosaveTimeoutRef.current);
        }
        autosaveTimeoutRef.current = setTimeout(() => {
          autosaveToDrive().then((ok) => {
            if (ok) console.log('[autosave] Project saved to Google Drive');
          });
        }, 3000); // 3 second debounce
      }
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

    // Plan mode is now handled server-side via system prompt (planMode in chatBody)
    const messageContent = _input;

    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      append({ role: 'user', content: `${diff}\n\n${messageContent}` });
      workbenchStore.resetAllFileModifications();
    } else {
      append({ role: 'user', content: messageContent });
    }
    setInput('');
    resetEnhancer();
  };

  const [messageRef, scrollRef] = useSnapScroll();

  // Env request modal state
  const [envRequests, setEnvRequests] = useState<EnvVarRequest[]>([]);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const processedEnvMessages = useRef<Set<number>>(new Set());

  // DB request modal state
  const [dbFields, setDbFields] = useState<DbFieldRequest[]>([]);
  const [dbType, setDbType] = useState<'supabase' | 'firebase'>('supabase');
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const processedDbMessages = useRef<Set<number>>(new Set());

  // User question state
  const [userQuestions, setUserQuestions] = useState<Record<number, UserQuestionData>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const processedQuestionMessages = useRef<Set<number>>(new Set());

  // Detect <env_request> tags in assistant messages
  useEffect(() => {
    if (isLoading) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant' || processedEnvMessages.current.has(i)) continue;
      const content = msg.content || '';
      const envRequestMatch = content.match(/<env_request>([\s\S]*?)<\/env_request>/);
      if (envRequestMatch) {
        processedEnvMessages.current.add(i);
        const vars = envRequestMatch[1]
          .split(/<var\s/g)
          .filter(Boolean)
          .map((raw) => {
            const nameMatch = raw.match(/name=["']([^"']+)["']/);
            const descMatch = raw.match(/description=["']([^"']+)["']/);
            return {
              name: nameMatch?.[1] || '',
              description: descMatch?.[1] || '',
            };
          })
          .filter((v) => v.name);
        if (vars.length > 0) {
          setEnvRequests(vars);
          setEnvModalOpen(true);
        }
      }
    }
  }, [messages, isLoading]);

  // Detect <db_request> tags in assistant messages
  useEffect(() => {
    if (isLoading) return;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant' || processedDbMessages.current.has(i)) continue;
      const content = msg.content || '';
      const dbRequestMatch = content.match(/<db_request\s+type=["']?(supabase|firebase)["']?\s*>([\s\S]*?)<\/db_request>/);
      if (dbRequestMatch) {
        processedDbMessages.current.add(i);
        const reqType = dbRequestMatch[1] as 'supabase' | 'firebase';
        const fieldsRaw = dbRequestMatch[2]
          .split(/<field\s/g)
          .filter(Boolean)
          .map((raw) => {
            const nameMatch = raw.match(/name=["']([^"']+)["']/);
            const descMatch = raw.match(/description=["']([^"']+)["']/);
            return { name: nameMatch?.[1] || '', description: descMatch?.[1] || '' };
          })
          .filter((f) => f.name);
        if (fieldsRaw.length > 0) {
          setDbType(reqType);
          setDbFields(fieldsRaw);
          setDbModalOpen(true);
        }
      }
    }
  }, [messages, isLoading]);

  // Detect <user_question> tags in assistant messages
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant' || processedQuestionMessages.current.has(i)) continue;
      const content = msg.content || '';
      const questionMatch = content.match(/<user_question\s+question=["']([^"']+)["']\s*>([\s\S]*?)<\/user_question>/);
      if (questionMatch) {
        processedQuestionMessages.current.add(i);
        const question = questionMatch[1];
        const optionsRaw = questionMatch[2]
          .split(/<option\s/g)
          .filter(Boolean)
          .map((raw) => {
            const labelMatch = raw.match(/label=["']([^"']+)["']/);
            return labelMatch?.[1] || '';
          })
          .filter(Boolean);
        if (optionsRaw.length >= 2) {
          setUserQuestions(prev => ({ ...prev, [i]: { question, options: optionsRaw.map(l => ({ label: l })) } }));
        }
      }
    }
  }, [messages]);

  // Auto-prompt AI when database is configured in settings
  useEffect(() => {
    const handleDbConfig = (event: CustomEvent) => {
      const { type, config } = event.detail;
      if (!config || type === 'none') return;

      if (!chatStarted) {
        runAnimation();
      }

      if (type === 'supabase') {
        append({
          role: 'user',
          content: `I just configured a Supabase database for this project. Here are the connection details:\n- Project URL: ${config.url}\n- Anon Key: ${config.anonKey}\n\nPlease:\n1. Install @supabase/supabase-js if not already installed\n2. Create a lib/database.ts or lib/supabase.ts file with the Supabase client initialized\n3. Set up the database connection in the project\n4. Make sure all API routes and components that need data use this Supabase client\n5. Create any necessary types for the database tables\n\nThe database is ready to use. Please configure the project to connect to it.`,
        });
      } else if (type === 'firebase') {
        append({
          role: 'user',
          content: `I just configured a Firebase database for this project. Here are the connection details:\n- API Key: ${config.apiKey}\n- Auth Domain: ${config.authDomain}\n- Project ID: ${config.projectId}\n- Storage Bucket: ${config.storageBucket}\n- App ID: ${config.appId}\n\nPlease:\n1. Install firebase if not already installed\n2. Create a lib/firebase.ts file with Firebase initialized using these credentials\n3. Set up Firestore or Firebase Realtime Database as needed\n4. Make sure all components that need data use this Firebase instance\n5. Create any necessary types for the database collections\n\nThe database is ready to use. Please configure the project to connect to it.`,
        });
      }
    };

    window.addEventListener('database-config-changed', handleDbConfig as EventListener);
    return () => window.removeEventListener('database-config-changed', handleDbConfig as EventListener);
  }, [append, chatStarted]);

  const handleEnvSave = async (vars: { key: string; value: string }[]) => {
    setEnvModalOpen(false);

    // Get current project env vars and merge
    const current = projects[projectId] ?? getActiveProject();
    const existingVars = current.settings?.envVars || [];
    const updatedVars = [...existingVars];
    for (const v of vars) {
      const existingIndex = updatedVars.findIndex((ev) => ev.key === v.key);
      if (existingIndex >= 0) {
        updatedVars[existingIndex] = { key: v.key, value: v.value };
      } else {
        updatedVars.push({ key: v.key, value: v.value });
      }
    }

    const { updateActiveProjectSettings, writeEnvFile } = await import('~/lib/stores/project');
    updateActiveProjectSettings({ envVars: updatedVars });
    try {
      await writeEnvFile(updatedVars);
    } catch (err) {
      console.warn('Failed to write .env file:', err);
    }

    // Send confirmation to AI (without the actual values for security)
    const varNames = vars.map((v) => v.key).join(', ');
    append({
      role: 'user',
      content: `The following environment variables have been configured and are now available via process.env: ${varNames}. Please continue and make sure to use process.env.VARIABLE_NAME in your code to access them. Do NOT ask for these variables again.`,
    });
  };

  const handleEnvSkip = () => {
    setEnvModalOpen(false);
  };

  const handleDbSave = async (type: string, values: Record<string, string>) => {
    setDbModalOpen(false);

    // Update project settings with database config
    if (type === 'supabase') {
      const { updateActiveProjectSettings } = await import('~/lib/stores/project');
      updateActiveProjectSettings({
        database: {
          type: 'supabase',
          firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
          supabase: { url: values.url || '', anonKey: values.anonKey || '', serviceRoleKey: '' },
        },
      });
      append({
        role: 'user',
        content: `I just configured a Supabase database for this project. Here are the connection details:\n- Project URL: ${values.url}\n- Anon Key: ${values.anonKey}\n\nPlease:\n1. Install @supabase/supabase-js if not already installed\n2. Create a lib/supabase.ts file with the Supabase client initialized\n3. Set up the database connection in the project\n4. Create any necessary types for the database tables\n\nThe database is ready to use. Please configure the project to connect to it.`,
      });
    } else if (type === 'firebase') {
      const { updateActiveProjectSettings } = await import('~/lib/stores/project');
      updateActiveProjectSettings({
        database: {
          type: 'firebase',
          firebase: { apiKey: values.apiKey || '', authDomain: values.authDomain || '', projectId: values.projectId || '', storageBucket: values.storageBucket || '', messagingSenderId: values.messagingSenderId || '', appId: values.appId || '', measurementId: '' },
          supabase: { url: '', anonKey: '', serviceRoleKey: '' },
        },
      });
      append({
        role: 'user',
        content: `I just configured a Firebase database for this project. Here are the connection details:\n- API Key: ${values.apiKey}\n- Auth Domain: ${values.authDomain}\n- Project ID: ${values.projectId}\n- Storage Bucket: ${values.storageBucket}\n- App ID: ${values.appId}\n\nPlease:\n1. Install firebase if not already installed\n2. Create a lib/firebase.ts file with Firebase initialized\n3. Set up Firestore or Firebase Realtime Database as needed\n4. Create any necessary types for the database collections\n\nThe database is ready to use. Please configure the project to connect to it.`,
      });
    }
  };

  const handleDbSkip = () => {
    setDbModalOpen(false);
  };

  const handleQuestionAnswer = (msgIndex: number, answer: string) => {
    setAnsweredQuestions(prev => new Set(prev).add(msgIndex));
    // Send the answer back to the AI as a user message
    append({
      role: 'user',
      content: `[Question Answer] "${answer}" — Please continue based on my choice.`,
    });
  };

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

  const handleTogglePlanMode = useCallback(() => {
    chatStore.setKey('planMode', !planMode);
  }, [planMode]);

  return (
    <>
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
        planMode={planMode}
        onTogglePlanMode={handleTogglePlanMode}
        tokenUsage={tokenUsage}
        userQuestions={userQuestions}
        answeredQuestions={answeredQuestions}
        onQuestionAnswer={handleQuestionAnswer}
      />
      {envModalOpen && envRequests.length > 0 && (
        <EnvRequestModal
          variables={envRequests}
          onClose={handleEnvSkip}
          onSave={handleEnvSave}
        />
      )}
      {dbModalOpen && dbFields.length > 0 && (
        <DbRequestModal
          fields={dbFields}
          dbType={dbType}
          onClose={handleDbSkip}
          onSave={handleDbSave}
        />
      )}
    </>
  );
});