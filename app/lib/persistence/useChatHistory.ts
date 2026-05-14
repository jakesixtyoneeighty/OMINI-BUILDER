import { useLoaderData, useNavigate } from '@remix-run/react';
import { useState, useEffect } from 'react';
import { atom } from 'nanostores';
import type { Message } from 'ai';
import { toast } from 'react-toastify';
import { workbenchStore } from '~/lib/stores/workbench';
import { activeProjectIdStore, saveProjectMessages, loadProjectMessages, updateActiveProjectSettings } from '~/lib/stores/project';
import { getMessages, getNextId, getUrlId, openDatabase, setMessages } from './db';
import type { ChatHistoryItem } from './db';

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string | undefined | null): id is string {
  return !!id && UUID_REGEX.test(id);
}

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

// Track whether we're in the process of creating a project in Supabase
let _creatingProject = false;

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  useEffect(() => {
    // If the URL contains a valid UUID, use it as the active project ID.
    // If it's a slug (non-UUID), we still load messages from it (IndexedDB key)
    // but we do NOT set it as activeProjectIdStore — that should only hold UUIDs or "default".
    if (mixedId) {
      if (isValidUUID(mixedId)) {
        activeProjectIdStore.set(mixedId);
      }
      // For slugs, we'll resolve to the real UUID after loading from Supabase/IndexedDB
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

          // If mixedId is a slug (not a UUID), try to resolve the real project UUID
          // by looking up the project in IndexedDB or Supabase
          if (!isValidUUID(mixedId)) {
            // Try to find the real project UUID in the projects store
            const { projectsStore } = await import('~/lib/stores/project');
            const projects = projectsStore.get();
            // Look for a project that matches this slug in its URL ID mapping
            // If not found, the slug stays as the chatId (for IndexedDB) but
            // activeProjectIdStore remains "default" until a Supabase project is created
            const matchingProject = Object.values(projects).find(
              p => p.id !== 'default' && isValidUUID(p.id)
            );
            if (matchingProject) {
              activeProjectIdStore.set(matchingProject.id);
            }
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

      // If the project is still "default", create it in Supabase first
      let projectId = activeProjectIdStore.get();
      if (projectId === 'default' || !projectId) {
        if (!_creatingProject) {
          _creatingProject = true;
          try {
            // Extract a project name from the first user message or artifact title
            const projectName = firstArtifact?.title || description.get() || 'Untitled Project';
            await updateActiveProjectSettings({ name: projectName });
            // After updateActiveProjectSettings, the activeProjectIdStore should now have a UUID
            projectId = activeProjectIdStore.get();
            console.log('[useChatHistory] Project created in Supabase:', projectId);
          } catch (err) {
            console.error('[useChatHistory] Failed to create project in Supabase:', err);
          } finally {
            _creatingProject = false;
          }
        }
      }

      // Save to Supabase (cloud) — only if projectId is a valid UUID
      if (isValidUUID(projectId)) {
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
