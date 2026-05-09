import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';

type DeployProvider = 'netlify' | 'vercel' | 'cloudrun' | 'omnibuilder';

interface DeployButtonProps {
  onOpenSettings: () => void;
}

export const DeployButton = memo(function DeployButton({ onOpenSettings }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [deploying, setDeploying] = useState<DeployProvider | null>(null);
  const [deployResult, setDeployResult] = useState<{ url: string; provider: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[projectId] ?? getActiveProject();
  const settings = project?.settings;

  // Netlify is always available because the server has NETLIFY_DEFAULT_API_KEY
  // The user's own token takes priority, but the server key is the fallback
  const netlifySiteId = settings?.netlify?.siteId || '';
  const hasUserNetlifyToken = !!(settings?.netlify?.token);
  const hasVercel = !!(settings?.vercel?.token);
  const hasCloudRun = !!(settings?.cloudRun?.serviceAccountKey && settings?.cloudRun?.projectId);

  const configuredProviders = useMemo(() => {
    const list: { key: DeployProvider; label: string; logo: string; color: string }[] = [];
    // Netlify is always available (server has default key)
    list.push({ key: 'netlify', label: 'Netlify', logo: '/logos/netlify.svg', color: 'text-teal-400' });
    if (hasVercel) list.push({ key: 'vercel', label: 'Vercel', logo: '/logos/vercel.svg', color: 'text-white' });
    if (hasCloudRun) list.push({ key: 'cloudrun', label: 'Google Cloud', logo: '/logos/google-cloud.svg', color: 'text-blue-400' });
    return list;
  }, [hasVercel, hasCloudRun]);

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

  // PRIMARY DEPLOY: Deploy to Netlify using server's default key
  // If the project already has a siteId, re-deploy to the same site (same URL)
  const deployToNetlify = async () => {
    setDeploying('netlify');
    setDeployResult(null);
    setOpen(false);

    try {
      const fileList = await getProjectFiles();
      const projectName = (settings?.name || project?.name || 'my-project')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 30);

      const token = settings?.netlify?.token || ''; // Empty = server will use NETLIFY_DEFAULT_API_KEY

      const res = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined, // If empty, server uses default key
          siteId: netlifySiteId || undefined,
          siteName: netlifySiteId ? undefined : projectName, // Only set name for new sites
          files: fileList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deploy failed');
      }

      setDeployResult({ url: data.url, provider: 'Netlify' });

      // Save the siteId so future deploys go to the same site (same URL)
      if (data.siteId && data.siteId !== netlifySiteId) {
        updateActiveProjectSettings({
          netlify: {
            token: hasUserNetlifyToken ? (settings?.netlify?.token || '') : '',
            siteId: data.siteId,
          },
        });
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('deploy.successNetlify')}</span>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-xs hover:text-blue-300"
          >
            {data.url}
          </a>
          {netlifySiteId && <span className="text-[9px] text-bolt-elements-textTertiary">{t('deploy.siteUpdated')}</span>}
        </div>,
        { autoClose: 10000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
    }
  };

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
          <span className="font-semibold">{t('deploy.successOmni')}</span>
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
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
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
          // Use the shared deployToNetlify logic
          setDeploying(null);
          return deployToNetlify();
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
          <span className="font-semibold">{t('deploy.successGeneric')}</span>
          {data?.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300">
              {data.url}
            </a>
          )}
        </div>,
        { autoClose: 8000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
    }
  };

  const deployWithAI = useCallback(() => {
    setOpen(false);

    const providerInfo = configuredProviders.map((p) => p.label).join(', ');

    window.dispatchEvent(
      new CustomEvent('deploy-requested', {
        detail: {
          configuredProviders: providerInfo,
          hasNetlify: true,
          hasVercel,
          hasCloudRun,
          netlifySiteId,
          vercelProjectName: settings?.vercel?.projectName || '',
          cloudRunServiceName: settings?.cloudRun?.serviceName || '',
          cloudRunRegion: settings?.cloudRun?.region || 'us-central1',
        },
      }),
    );
  }, [configuredProviders, hasVercel, hasCloudRun, netlifySiteId]);

  const isDeploying = deploying !== null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Main button — PRIMARY: Deploy to Netlify. Click deploys, long-press/right area opens dropdown */}
        <div className="flex">
          <button
            onClick={deployToNetlify}
            disabled={isDeploying}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-l-lg text-xs font-semibold shadow-sm transition-all relative overflow-hidden',
              isDeploying
                ? 'bg-teal-600/80 text-white cursor-wait'
                : deployResult
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500'
                  : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500 hover:shadow-md active:scale-[0.97]',
            )}
          >
            {isDeploying ? (
              <>
                <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                {t('deploy.deploying')}
              </>
            ) : deployResult ? (
              <>
                <div className="i-ph:check-circle-fill text-sm" />
                {t('deploy.deployed')}
              </>
            ) : (
              <>
                <div className="i-ph:rocket-launch-duotone text-sm" />
                {t('deploy.button')}
              </>
            )}
          </button>
          <button
            onClick={() => setOpen(!open)}
            disabled={isDeploying}
            className={classNames(
              'flex items-center px-1.5 py-1.5 rounded-r-lg text-xs font-semibold shadow-sm transition-all border-l border-white/10',
              isDeploying
                ? 'bg-teal-600/80 text-white cursor-wait'
                : 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:from-teal-500 hover:to-emerald-500',
            )}
          >
            <div className="i-ph:caret-down text-[10px] opacity-70" />
          </button>
        </div>

        {/* Dropdown — shown on caret click or right-click */}
        {open && !isDeploying && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-gradient-to-r from-teal-600/10 to-emerald-600/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
                  <div className="i-ph:rocket-launch-duotone text-teal-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">{t('deploy.projectDeploy')}</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    {netlifySiteId ? t('deploy.updateNetlify') : t('deploy.publishNetlify')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              {/* PRIMARY: Deploy to Netlify (always available) */}
              <button
                onClick={deployToNetlify}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group border border-teal-500/20 bg-teal-500/5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center shrink-0 group-hover:from-teal-500/30 group-hover:to-emerald-500/30 transition-colors">
                  <div className="i-ph:cube-duotone text-teal-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">
                    {netlifySiteId ? t('deploy.updateOnNetlify') : t('deploy.publishOnNetlify')}
                  </p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">
                    {netlifySiteId ? t('deploy.sameUrlUpdate') : t('deploy.createNewSite')}
                  </p>
                </div>
                <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-teal-500/20 text-teal-400 uppercase tracking-wider">
                  {t('deploy.default')}
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
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">{t('deploy.deployWithAI')}</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">{t('deploy.deployWithAIDesc')}</p>
                </div>
                <div className="i-ph:sparkle text-purple-400/50 text-xs" />
              </button>

              {/* Deploy pelo Omni Builder */}
              <button
                onClick={deployToOmniBuilder}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0 group-hover:bg-blue-500/25 transition-colors">
                  <div className="i-ph:eye-duotone text-blue-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">{t('deploy.previewOmni')}</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">{t('deploy.previewOmniDesc')}</p>
                </div>
              </button>

              {/* Separator — Other external providers */}
              {(hasVercel || hasCloudRun) && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                  <span className="text-[9px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium">{t('deploy.others')}</span>
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                </div>
              )}

              {/* Vercel (only if configured) */}
              {hasVercel && (
                <button
                  onClick={() => deployTo('vercel')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-bolt-elements-item-backgroundActive flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/vercel.svg" alt="Vercel" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs text-bolt-elements-textSecondary font-medium">Vercel</span>
                </button>
              )}

              {/* Cloud Run (only if configured) */}
              {hasCloudRun && (
                <button
                  onClick={() => deployTo('cloudrun')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-bolt-elements-item-backgroundActive flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/google-cloud.svg" alt="Google Cloud" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs text-bolt-elements-textSecondary font-medium">Google Cloud Run</span>
                </button>
              )}

              {/* Deploy result card */}
              {deployResult && (
                <div className="mx-1 mt-1 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="i-ph:check-circle-fill text-emerald-400 text-sm" />
                    <span className="text-[10px] font-semibold text-emerald-400">{t('deploy.lastDeploy')}: {deployResult.provider}</span>
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
                {t('deploy.configureProviders')}
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
