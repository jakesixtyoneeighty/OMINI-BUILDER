import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore, saveProjectMessages, loadProjectMessages } from '~/lib/stores/project';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';
import type { ChatHistoryItem } from './db';

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// Lazy-init the database to avoid top-level await which breaks Cloudflare Pages Functions
let _db: IDBDatabase | undefined;
let _dbPromise: Promise<IDBDatabase | undefined> | undefined;

export function getDb(): Promise<IDBDatabase | undefined> {
  if (_db !== undefined) {
    return Promise.resolve(_db);
  }
  if (!_dbPromise) {
    _dbPromise = persistenceEnabled
      ? openDatabase().then((d) => {
          _db = d;
          return d;
        })
      : Promise.resolve(undefined);
  }
  return _dbPromise;
}

// Synchronous accessor — only valid after the DB has been initialized
export function getDbSync(): IDBDatabase | undefined {
  return _db;
}

// Keep backward-compatible `db` export as a getter-like pattern
// Code that needs the DB should use getDb() for async or getDbSync() after init
export const db = undefined as IDBDatabase | undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    if (mixedId) {
      activeProjectIdStore.set(mixedId);
    }

    (async () => {
      if (mixedId) {
        try {
          const messages = await loadProjectMessages(mixedId);
          if (messages.length > 0) {
            setInitialMessages(messages);
            chatId.set(mixedId);
          } else {
            chatId.set(mixedId);
          }
        } catch (error: any) {
          toast.error(error.message);
          chatId.set(mixedId);
        }
      }
      setReady(true);
    })();
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      if (messages.length === 0) return;

      const database = await getDb();

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const urlId = database ? await getUrlId(database, firstArtifact.id) : firstArtifact.id;

        navigateChat(urlId);
        setUrlId(urlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      const currentChatId = chatId.get();
      if (!currentChatId) {
        if (database) {
          const nextId = await getNextId(database);
          chatId.set(nextId);
          if (!urlId) {
            navigateChat(nextId);
          }
        }
      }

      const id = chatId.get() as string;

      // Save to IndexedDB (local cache)
      if (database) {
        await setMessages(database, id, messages, urlId, description.get());
      }

      // Save to Supabase (cloud)
      const projectId = activeProjectIdStore.get();
      if (projectId && projectId !== 'default') {
        await saveProjectMessages(projectId, messages, description.get());
      }
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
