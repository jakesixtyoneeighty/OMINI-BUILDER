import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

type DeployProvider = 'netlify' | 'vercel' | 'cloudrun' | 'omnibuilder';

interface DeployButtonProps {
  onOpenSettings: () => void;
}

export const DeployButton = memo(function DeployButton({ onOpenSettings }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [deploying, setDeploying] = useState<DeployProvider | null>(null);
  const [deployResult, setDeployResult] = useState<{ url: string; provider: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[projectId] ?? getActiveProject();
  const settings = project?.settings;

  const hasNetlify = !!(settings?.netlify?.token);
  const hasVercel = !!(settings?.vercel?.token);
  const hasCloudRun = !!(settings?.cloudRun?.serviceAccountKey && settings?.cloudRun?.projectId);
  const hasAnyProvider = hasNetlify || hasVercel || hasCloudRun;

  const configuredProviders = useMemo(() => {
    const list: { key: DeployProvider; label: string; logo: string; color: string }[] = [];
    if (hasNetlify) list.push({ key: 'netlify', label: 'Netlify', logo: '/logos/netlify.svg', color: 'text-teal-400' });
    if (hasVercel) list.push({ key: 'vercel', label: 'Vercel', logo: '/logos/vercel.svg', color: 'text-white' });
    if (hasCloudRun) list.push({ key: 'cloudrun', label: 'Google Cloud', logo: '/logos/google-cloud.svg', color: 'text-blue-400' });
    return list;
  }, [hasNetlify, hasVercel, hasCloudRun]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const getProjectFiles = async () => {
    await workbenchStore.saveAllFiles();
    const files = workbenchStore.files.get();
    return Object.entries(files)
      .filter(([, f]) => f?.type === 'file' && !f.isBinary)
      .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content }));
  };

  // Deploy via Omni Builder (self-hosted preview)
  const deployToOmniBuilder = async () => {
    setDeploying('omnibuilder');
    setDeployResult(null);
    setOpen(false);

    try {
      const fileList = await getProjectFiles();
      const projectName = settings?.name || project?.name || 'My Project';
      const projectDesc = settings?.description || '';

      const res = await fetch('/api/deploy-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name: projectName,
          description: projectDesc,
          files: fileList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.migrationNeeded) {
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Database migration needed</span>
              <span className="text-xs">Run the SQL in supabase_deploy_migration.sql to create the deployed_projects table</span>
            </div>,
            { autoClose: 12000 },
          );
          return;
        }
        throw new Error(data.error || 'Deploy failed');
      }

      setDeployResult({ url: data.viewUrl, provider: 'Omni Builder' });

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Deploy realizado pelo Omni Builder!</span>
          <a
            href={data.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-xs hover:text-blue-300"
          >
            {data.viewUrl}
          </a>
        </div>,
        { autoClose: 10000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no deploy', { autoClose: 8000 });
    } finally {
      setDeploying(null);
    }
  };

  const deployTo = async (provider: DeployProvider) => {
    setDeploying(provider);
    setDeployResult(null);
    setOpen(false);

    try {
      const fileList = await getProjectFiles();
      let res: Response;
      let data: any;

      switch (provider) {
        case 'netlify': {
          const token = settings?.netlify?.token || '';
          const siteId = settings?.netlify?.siteId || '';
          res = await fetch('/api/netlify-deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, siteId: siteId || undefined, files: fileList }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || 'Deploy failed'); }
          data = await res.json();
          setDeployResult({ url: data.url, provider: 'Netlify' });
          if (data.siteId) {
            const { updateActiveProjectSettings } = await import('~/lib/stores/project');
            updateActiveProjectSettings({ netlify: { token, siteId: data.siteId } });
          }
          break;
        }
        case 'vercel': {
          const token = settings?.vercel?.token || '';
          const projectName = settings?.vercel?.projectName || '';
          const framework = settings?.vercel?.framework || 'vite';
          res = await fetch('/api/vercel-deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, projectName: projectName || undefined, framework, files: fileList }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || 'Deploy failed'); }
          data = await res.json();
          setDeployResult({ url: data.url, provider: 'Vercel' });
          break;
        }
        case 'cloudrun': {
          const cr = settings?.cloudRun || {};
          res = await fetch('/api/cloudrun-deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: cr.projectId,
              region: cr.region || 'us-central1',
              serviceAccountKey: cr.serviceAccountKey,
              serviceName: cr.serviceName || 'default',
              allowUnauthenticated: cr.allowUnauthenticated !== false,
              files: fileList,
            }),
          });
          if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error((err as any).error || 'Deploy failed'); }
          data = await res.json();
          setDeployResult({ url: data.url, provider: 'Cloud Run' });
          break;
        }
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">Deploy realizado com sucesso!</span>
          {data?.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300">
              {data.url}
            </a>
          )}
        </div>,
        { autoClose: 8000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha no deploy', { autoClose: 8000 });
    } finally {
      setDeploying(null);
    }
  };

  const deployWithAI = useCallback(() => {
    setOpen(false);

    const providerInfo = configuredProviders.map((p) => p.label).join(', ') || 'nenhum provedor configurado';

    window.dispatchEvent(
      new CustomEvent('deploy-requested', {
        detail: {
          configuredProviders: providerInfo,
          hasNetlify,
          hasVercel,
          hasCloudRun,
          netlifySiteId: settings?.netlify?.siteId || '',
          vercelProjectName: settings?.vercel?.projectName || '',
          cloudRunServiceName: settings?.cloudRun?.serviceName || '',
          cloudRunRegion: settings?.cloudRun?.region || 'us-central1',
        },
      }),
    );
  }, [configuredProviders, hasNetlify, hasVercel, hasCloudRun]);

  const quickDeploy = useCallback(() => {
    if (!hasAnyProvider) {
      onOpenSettings();
      toast.info('Configure um provedor de deploy primeiro!', { autoClose: 4000 });
      return;
    }
    deployTo(configuredProviders[0].key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyProvider, configuredProviders, onOpenSettings]);

  const isDeploying = deploying !== null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Main button */}
        <button
          onClick={() => setOpen(!open)}
          disabled={isDeploying}
          className={classNames(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all relative overflow-hidden',
            isDeploying
              ? 'bg-teal-600/80 text-white cursor-wait'
              : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500 hover:shadow-md active:scale-[0.97]',
          )}
        >
          {isDeploying ? (
            <>
              <div className="i-svg-spinners:90-ring-with-bg text-sm" />
              {deploying === 'omnibuilder' ? 'Deploying to Omni...' : 'Deploying...'}
            </>
          ) : deployResult ? (
            <>
              <div className="i-ph:check-circle-fill text-sm" />
              Deployed!
            </>
          ) : (
            <>
              <div className="i-ph:rocket-launch-duotone text-sm" />
              Deploy
              <div className="i-ph:caret-down text-[10px] opacity-70" />
            </>
          )}
        </button>

        {/* Dropdown */}
        {open && !isDeploying && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-gradient-to-r from-teal-600/10 to-emerald-600/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
                  <div className="i-ph:rocket-launch-duotone text-teal-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">Deploy do Projeto</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    Escolha como publicar seu projeto
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              {/* Deploy pelo Omni Builder — PRIMARY option */}
              <button
                onClick={deployToOmniBuilder}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group border border-teal-500/20 bg-teal-500/5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center shrink-0 group-hover:from-teal-500/30 group-hover:to-emerald-500/30 transition-colors">
                  <div className="i-ph:cube-duotone text-teal-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">Deploy pelo Omni Builder</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">Preview ao vivo com WebContainer — link instantâneo</p>
                </div>
                <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-teal-500/20 text-teal-400 uppercase tracking-wider">
                  Novo
                </div>
              </button>

              {/* Deploy com IA */}
              <button
                onClick={deployWithAI}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0 group-hover:bg-purple-500/25 transition-colors">
                  <div className="i-ph:openai-logo-duotone text-purple-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">Deploy com IA</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">Pede para IA preparar e fazer o deploy</p>
                </div>
                <div className="i-ph:sparkle text-purple-400/50 text-xs" />
              </button>

              {/* Separator — External providers */}
              {hasAnyProvider && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                  <span className="text-[9px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium">Deploy Externo</span>
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                </div>
              )}

              {/* Quick Deploy — deploy to first available provider */}
              {hasAnyProvider && (
                <button
                  onClick={quickDeploy}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/25 transition-colors">
                    <div className="i-ph:lightning-duotone text-emerald-400 text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-bolt-elements-textPrimary">Deploy Rapido</p>
                    <p className="text-[10px] text-bolt-elements-textTertiary truncate">
                      {configuredProviders.length === 1
                        ? `Deploy para ${configuredProviders[0].label}`
                        : `Deploy para ${configuredProviders[0].label} (primeiro)`}
                    </p>
                  </div>
                </button>
              )}

              {/* Individual provider buttons */}
              {configuredProviders.length > 1 && configuredProviders.map((p) => (
                <button
                  key={p.key}
                  onClick={() => deployTo(p.key)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-bolt-elements-item-backgroundActive flex items-center justify-center shrink-0 overflow-hidden">
                    <img src={p.logo} alt={p.label} className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs text-bolt-elements-textSecondary font-medium">{p.label}</span>
                </button>
              ))}

              {/* Deploy result card */}
              {deployResult && (
                <div className="mx-1 mt-1 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="i-ph:check-circle-fill text-emerald-400 text-sm" />
                    <span className="text-[10px] font-semibold text-emerald-400">Ultimo deploy: {deployResult.provider}</span>
                  </div>
                  {deployResult.url && (
                    <a
                      href={deployResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-blue-400 hover:text-blue-300 underline break-all block"
                    >
                      {deployResult.url}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Footer — configure */}
            <div className="px-2 py-2 border-t border-bolt-elements-borderColor">
              <button
                onClick={() => { setOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
              >
                <div className="i-ph:gear-six text-sm" />
                Configurar Provedores
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Deploy result toast-like banner */}
      {deployResult && !open && !isDeploying && (
        <div className="absolute right-0 top-full mt-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 whitespace-nowrap z-50 shadow-lg">
          <div className="i-ph:check-circle-fill text-xs mr-1" />
          {deployResult.provider}
        </div>
      )}
    </>
  );
});
