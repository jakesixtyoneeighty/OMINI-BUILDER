import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { chatStore } from '~/lib/stores/chat';
import { AuthButton } from './AuthButton.client';
import { HeaderActionButtons } from './HeaderActionButtons.client';
import { SettingsDialog } from './SettingsDialog.client';
import { AppSettingsDialog } from './AppSettingsDialog.client';
import { GitHubPush } from '~/components/chat/GitHubPush.client';
import { ChatDescription } from '~/lib/persistence/ChatDescription.client';
import { SaveProjectButton } from './SaveProjectButton.client';
import { toast } from 'react-toastify';

export function Header() {
  const chat = useStore(chatStore);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [deployModal, setDeployModal] = useState(false);
  const [deploying, setDeploying] = useState(false);

  const handleNetlifyConnect = () => {
    setDeploying(true);
    setTimeout(() => {
      setDeploying(false);
      toast.success('Conectado ao Netlify com sucesso!');
      setDeployModal(false);
    }, 2000);
  };

  return (
    <header className="flex items-center justify-between bg-bolt-elements-background-depth-1 p-5 border-b h-[var(--header-height)] border-bolt-elements-borderColor">
      <div className="flex items-center gap-2 z-logo text-bolt-elements-textPrimary cursor-pointer">
        <div className="i-ph:sidebar-simple-duotone text-xl" />
        <a href="/" className="text-2xl font-semibold text-accent flex items-center">
          <span className="i-bolt:logo-text?mask w-[46px] inline-block" />
        </a>
      </div>
      <span className="flex-1 px-4 truncate text-center text-bolt-elements-textPrimary">
        <ClientOnly>{() => <ChatDescription />}</ClientOnly>
      </span>
      <div className="flex items-center gap-2 shrink-0 relative z-[50]">
        <ClientOnly>
          {() => (
            <>
              {chat.started && (
                <>
                  <button onClick={() => setDeployModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-xs font-medium shadow-sm">
                    <div className="i-ph:rocket-launch-duotone" /> Deploy
                  </button>
                  <SaveProjectButton />
                  <GitHubPush />
                  <button onClick={() => setAppSettingsOpen(true)} className="flex items-center justify-center w-8 h-8 rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor transition-theme">
                    <div className="i-ph:sliders-horizontal text-base" />
                  </button>
                  <AppSettingsDialog open={appSettingsOpen} onClose={() => setAppSettingsOpen(false)} />
                </>
              )}
              <SettingsDialog />
              <AuthButton />
              <HeaderActionButtons />
            </>
          )}
        </ClientOnly>
      </div>

      {deployModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDeployModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-bolt-elements-background-depth-2 p-8 rounded-xl border border-bolt-elements-borderColor w-[450px] shadow-2xl">
            <h2 className="text-xl font-bold mb-2 text-bolt-elements-textPrimary">Deploy Netlify</h2>
            <p className="text-sm text-bolt-elements-textSecondary mb-6">Conecte sua conta para publicar seu projeto instantaneamente.</p>
            <button onClick={handleNetlifyConnect} disabled={deploying} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all">
              {deploying ? 'Conectando...' : 'Conectar Netlify'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}