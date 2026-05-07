import { atom } from 'nanostores';

const CHAT_WIDTH_KEY = 'omni-builder.chat.width';
const DEFAULT_CHAT_WIDTH = 50; // percentage

function loadChatWidth(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_CHAT_WIDTH;
  try {
    const val = localStorage.getItem(CHAT_WIDTH_KEY);
    return val ? parseFloat(val) : DEFAULT_CHAT_WIDTH;
  } catch {
    return DEFAULT_CHAT_WIDTH;
  }
}

export const chatWidthStore = atom<number>(loadChatWidth());

if (typeof window !== 'undefined') {
  chatWidthStore.subscribe((val) => {
    try {
      localStorage.setItem(CHAT_WIDTH_KEY, String(val));
    } catch {}
  });
}
