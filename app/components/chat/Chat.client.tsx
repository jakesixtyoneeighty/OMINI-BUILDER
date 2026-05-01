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
import { activeProjectIdStore } from '~/lib/stores/project';
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

  const [animationScope, animate] = useAnimate();

  const { messages, setMessages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: {
      provider: llm.provider,
      model: llm.model,
      apiKey: llm.keys[llm.provider] || '',
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
    const { webcontainer } = await import('~/lib/webcontainer');
    const wc = await webcontainer;

    await workbenchStore.clearWorkspace();

    for (const f of result.files) {
      try {
        const dir = f.path.split('/').slice(0, -1).join('/');
        if (dir) await wc.fs.mkdir(dir, { recursive: true });
        await wc.fs.writeFile(f.path, f.content);
        workbenchStore.files.setKey(f.path, { type: 'file', content: f.content, isBinary: false });
      } catch (err) {
        console.error('Failed to write', f.path, err);
      }
    }

    workbenchStore.showWorkbench.set(true);
    runAnimation();

    append({ 
      role: 'user', 
      content: `I have imported a project. Please analyze the files and provide the necessary shell commands to install dependencies and start the development server.` 
    });
    
    toast.success(`Imported ${result.files.length} files. AI is preparing the environment...`);
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