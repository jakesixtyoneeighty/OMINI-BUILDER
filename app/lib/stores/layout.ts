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

// Mobile view: 'chat' | 'workbench'
export type MobileView = 'chat' | 'workbench';
export const mobileViewStore = atom<MobileView>('chat');

// Settings panel - opens in the right sidebar area
export type SettingsTab =
  | 'deploy'
  | 'versions'
  | 'database'
  | 'integrations'
  | 'env'
  | 'general'
  | 'rules'
  | 'security'
  | 'preview';

interface SettingsPanelState {
  open: boolean;
  tab: SettingsTab;
}

export const settingsPanelStore = atom<SettingsPanelState>({ open: false, tab: 'general' });

export function openSettingsPanel(tab?: SettingsTab) {
  settingsPanelStore.set({ open: true, tab: tab || 'general' });
}

export function closeSettingsPanel() {
  settingsPanelStore.set({ open: false, tab: 'general' });
}

export function setSettingsTab(tab: SettingsTab) {
  const current = settingsPanelStore.get();
  settingsPanelStore.set({ ...current, tab });
}
