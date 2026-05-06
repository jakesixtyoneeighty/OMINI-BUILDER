import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
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
    getDb().then((database) => {
      if (!database) {
        setReady(true);

        if (persistenceEnabled) {
          toast.error(`Chat persistence is unavailable`);
        }

        return;
      }

      if (mixedId) {
        getMessages(database, mixedId)
          .then((storedMessages) => {
            if (storedMessages && storedMessages.messages.length > 0) {
              setInitialMessages(storedMessages.messages);
              setUrlId(storedMessages.urlId);
              description.set(storedMessages.description);
              chatId.set(storedMessages.id);
            } else {
              navigate(`/`, { replace: true });
            }

            setReady(true);
          })
          .catch((error) => {
            toast.error(error.message);
          });
      } else {
        setReady(true);
      }
    });
  }, []);

  return {
    ready: !mixedId || ready,
    initialMessages,
    storeMessageHistory: async (messages: Message[]) => {
      const database = await getDb();
      if (!database || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(database, firstArtifact.id);

        navigateChat(urlId);
        setUrlId(urlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(database);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      await setMessages(database, chatId.get() as string, messages, urlId, description.get());
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
