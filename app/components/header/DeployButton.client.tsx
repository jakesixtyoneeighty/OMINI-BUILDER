import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject, updateActiveProjectSettings } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';
import { buildProjectForDeploy, type BuildFile } from '~/utils/deploy-build';

type DeployProvider = 'cloudflare' | 'netlify' | 'vercel' | 'cloudrun' | 'omnibuilder';
type DeployPhase = 'idle' | 'building' | 'deploying';

interface DeployButtonProps {
  onOpenSettings: () => void;
}

export const DeployButton = memo(function DeployButton({ onOpenSettings }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [deploying, setDeploying] = useState<DeployProvider | null>(null);
  const [deployPhase, setDeployPhase] = useState<DeployPhase>('idle');
  const [deployResult, setDeployResult] = useState<{ url: string; provider: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[projectId] ?? getActiveProject();
  const settings = project?.settings;

  // Vercel is the default deploy provider — uses VERCEL_TOKEN env var or user-configured token
  const vercelToken = settings?.vercel?.token || (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VERCEL_TOKEN || '' : '');
  const hasVercel = !!vercelToken;
  const cloudflareProject = settings?.cloudflare?.projectName || '';
  const hasUserNetlifyToken = !!(settings?.netlify?.token);
  const hasCloudRun = !!(settings?.cloudRun?.serviceAccountKey && settings?.cloudRun?.projectId);

  const configuredProviders = useMemo(() => {
    const list: { key: DeployProvider; label: string; logo: string; color: string }[] = [];
    // Vercel is the PRIMARY deploy provider (default, uses VERCEL_TOKEN)
    if (hasVercel) list.push({ key: 'vercel', label: 'Vercel', logo: '/logos/vercel.svg', color: 'text-white' });
    // Cloudflare Pages is always available (free, no API key, server handles it)
    list.push({ key: 'cloudflare', label: 'Cloudflare Pages', logo: '/logos/cloudflare.svg', color: 'text-orange-400' });
    if (hasUserNetlifyToken) list.push({ key: 'netlify', label: 'Netlify', logo: '/logos/netlify.svg', color: 'text-teal-400' });
    if (hasCloudRun) list.push({ key: 'cloudrun', label: 'Google Cloud', logo: '/logos/google-cloud.svg', color: 'text-blue-400' });
    return list;
  }, [hasVercel, hasUserNetlifyToken, hasCloudRun]);

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

  // Default deploy: Vercel (if token available), otherwise Cloudflare Pages
  const defaultDeploy = useCallback(() => {
    if (hasVercel) {
      return deployTo('vercel');
    }
    return deployToCloudflare();
  }, [hasVercel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for AI deploy trigger — when the AI calls the deploy tool,
  // it dispatches 'ai-deploy-trigger' and we automatically deploy
  useEffect(() => {
    const handleAiDeploy = (event: Event) => {
      const { projectName } = (event as CustomEvent).detail || {};
      // If a project name is provided by the AI, update settings first
      if (projectName) {
        updateActiveProjectSettings({
          vercel: { projectName, token: vercelToken, framework: settings?.vercel?.framework || 'vite' },
        });
      }
      // Trigger the default deploy
      defaultDeploy();
    };

    window.addEventListener('ai-deploy-trigger', handleAiDeploy as EventListener);
    return () => window.removeEventListener('ai-deploy-trigger', handleAiDeploy as EventListener);
  }, [hasVercel, vercelToken]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Get raw source files from the workbench store.
   * Used as fallback when build fails or for providers that handle building server-side.
   */
  const getProjectFiles = async () => {
    await workbenchStore.saveAllFiles();
    const files = workbenchStore.files.get();
    return Object.entries(files)
      .filter(([, f]) => f?.type === 'file' && !f.isBinary)
      .map(([path, f]) => ({ path: path.replace(/^\/+/, ''), content: (f as any).content }));
  };

  /**
   * Build the project in the WebContainer and return the built output files.
   * This is needed because Cloudflare Pages Direct Upload doesn't run
   * a build step — it serves files as-is. So we must send pre-built
   * files (HTML, JS, CSS) instead of raw source (TSX, etc.).
   */
  const getBuiltFiles = async (): Promise<BuildFile[]> => {
    await workbenchStore.saveAllFiles();

    // Show build phase to the user
    setDeployPhase('building');
    toast.info(
      <div className="flex items-center gap-2">
        <div className="i-svg-spinners:90-ring-with-bg text-sm animate-spin" />
        <span>{t('deploy.building')}</span>
      </div>,
      { autoClose: false, toastId: 'deploy-building' },
    );

    try {
      const result = await buildProjectForDeploy();

      toast.dismiss('deploy-building');

      if (result.success && result.files.length > 0) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('deploy.buildSuccess')}</span>
            <span className="text-[10px] text-bolt-elements-textTertiary">
              {result.files.length} {t('deploy.filesFrom')} {result.buildOutputDir}/
            </span>
          </div>,
          { autoClose: 3000 },
        );
        return result.files;
      }

      // Build failed — fall back to raw source files
      console.warn('[deploy] Build failed, falling back to raw source files:', result.error);
      toast.warning(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('deploy.buildFailed')}</span>
          <span className="text-[10px] text-amber-300">{result.error}</span>
          <span className="text-[10px] text-bolt-elements-textTertiary">{t('deploy.fallbackRaw')}</span>
        </div>,
        { autoClose: 8000 },
      );

      return getProjectFiles();
    } catch (err) {
      toast.dismiss('deploy-building');
      console.warn('[deploy] Build error, falling back to raw source files:', err);

      // Fall back to raw source files
      return getProjectFiles();
    }
  };

  // ── PRIMARY DEPLOY: Cloudflare Pages (free, no API key) ──
  // If the project already has a projectName, re-deploy to the same site (same URL)
  const deployToCloudflare = async () => {
    setDeploying('cloudflare');
    setDeployPhase('idle');
    setDeployResult(null);
    setOpen(false);

    try {
      // Build project first, then deploy the built output
      const fileList = await getBuiltFiles();
      setDeployPhase('deploying');

      const projectName = (settings?.name || project?.name || 'my-project')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 28);

      // Use existing project name if available, or generate a new one
      const deployProjectName = cloudflareProject || projectName;

      const res = await fetch('/api/cloudflare-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: deployProjectName,
          files: fileList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deploy failed');
      }

      setDeployResult({ url: data.url, provider: 'Cloudflare Pages' });

      // Save the projectName AND lastDeploy so the deploy state persists
      updateActiveProjectSettings({
        cloudflare: {
          projectName: data.projectName || deployProjectName,
        },
        lastDeploy: {
          url: data.url,
          provider: 'cloudflare',
          siteId: data.projectName || deployProjectName,
          deployedAt: new Date().toISOString(),
        },
      });

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('deploy.successCloudflare')}</span>
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-xs hover:text-blue-300 break-all"
          >
            {data.url}
          </a>
          {data.processing && <span className="text-[9px] text-amber-400">{t('deploy.processing')}</span>}
          {cloudflareProject && !data.processing && <span className="text-[9px] text-bolt-elements-textTertiary">{t('deploy.siteUpdated')}</span>}
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
      setDeployPhase('idle');
    }
  };

  // ── Netlify Deploy (requires API key) ──
  const deployToNetlify = async () => {
    setDeploying('netlify');
    setDeployPhase('deploying');
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

      const token = settings?.netlify?.token || '';
      const netlifySiteId = settings?.netlify?.siteId || '';

      const res = await fetch('/api/netlify-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          siteId: netlifySiteId || undefined,
          siteName: netlifySiteId ? undefined : projectName,
          files: fileList,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deploy failed');
      }

      setDeployResult({ url: data.url, provider: 'Netlify' });

      updateActiveProjectSettings({
        netlify: {
          token: hasUserNetlifyToken ? (settings?.netlify?.token || '') : '',
          siteId: data.siteId || netlifySiteId || '',
        },
        lastDeploy: {
          url: data.url,
          provider: 'netlify',
          siteId: data.siteId || netlifySiteId || '',
          deployedAt: new Date().toISOString(),
        },
      });

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('deploy.successNetlify')}</span>
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">
            {data.url}
          </a>
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
      setDeployPhase('idle');
    }
  };

  const deployToOmniBuilder = async () => {
    setDeploying('omnibuilder');
    setDeployPhase('deploying');
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
            className="text-blue-400 underline text-xs hover:text-blue-300 break-all"
          >
            {data.viewUrl}
          </a>
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
      setDeployPhase('idle');
    }
  };

  const deployTo = async (provider: DeployProvider) => {
    setDeploying(provider);
    setDeployPhase('deploying');
    setDeployResult(null);
    setOpen(false);

    try {
      const fileList = await getProjectFiles();
      let res: Response;
      let data: any;

      switch (provider) {
        case 'cloudflare': {
          // Use the shared deployToCloudflare logic
          setDeploying(null);
          setDeployPhase('idle');
          return deployToCloudflare();
        }
        case 'netlify': {
          // Use the shared deployToNetlify logic
          setDeploying(null);
          setDeployPhase('idle');
          return deployToNetlify();
        }
        case 'vercel': {
          const token = vercelToken;
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

          // Save the Vercel project info after successful deploy
          updateActiveProjectSettings({
            vercel: {
              token: vercelToken,
              projectName: data.projectName || projectName || '',
              framework,
            },
            lastDeploy: {
              url: data.url,
              provider: 'vercel',
              siteId: data.projectId || '',
              deployedAt: new Date().toISOString(),
            },
          });
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

      const providerLabel = provider === 'cloudflare' ? 'Cloudflare Pages' : provider === 'netlify' ? 'Netlify' : provider === 'vercel' ? 'Vercel' : provider === 'cloudrun' ? 'Cloud Run' : provider;
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{t('deploy.successGeneric')}</span>
          {data?.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline text-xs hover:text-blue-300 break-all"
            >
              {data.url}
            </a>
          )}
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('deploy.failed'), { autoClose: 8000 });
    } finally {
      setDeploying(null);
      setDeployPhase('idle');
    }
  };

  const deployWithAI = useCallback(() => {
    setOpen(false);

    const providerInfo = configuredProviders.map((p) => p.label).join(', ');

    window.dispatchEvent(
      new CustomEvent('deploy-requested', {
        detail: {
          configuredProviders: providerInfo,
          hasNetlify: hasUserNetlifyToken,
          hasCloudflare: true,
          hasVercel,
          hasCloudRun,
          cloudflareProject,
          netlifySiteId: settings?.netlify?.siteId || '',
          vercelProjectName: settings?.vercel?.projectName || '',
          cloudRunServiceName: settings?.cloudRun?.serviceName || '',
          cloudRunRegion: settings?.cloudRun?.region || 'us-central1',
        },
      }),
    );
  }, [configuredProviders, hasUserNetlifyToken, hasVercel, hasCloudRun, cloudflareProject]);

  const isDeploying = deploying !== null;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Main button — PRIMARY: Deploy to Vercel (default) or Cloudflare Pages */}
        <div className="flex">
          <button
            onClick={defaultDeploy}
            disabled={isDeploying}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-l-lg text-xs font-semibold shadow-sm transition-all relative overflow-hidden',
              isDeploying
                ? 'bg-gray-600/80 text-white cursor-wait'
                : deployResult
                  ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500'
                  : hasVercel
                    ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700 hover:shadow-md active:scale-[0.97]'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 hover:shadow-md active:scale-[0.97]',
            )}
          >
            {isDeploying ? (
              <>
                <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                {deployPhase === 'building' ? t('deploy.building') : t('deploy.deploying')}
              </>
            ) : deployResult ? (
              <>
                <div className="i-ph:check-circle-fill text-sm" />
                {t('deploy.deployed')}
              </>
            ) : (
              <>
                <div className={hasVercel ? 'i-ph:triangle text-sm' : 'i-ph:rocket-launch-duotone text-sm'} />
                {hasVercel ? 'Vercel' : t('deploy.button')}
              </>
            )}
          </button>
          <button
            onClick={() => setOpen(!open)}
            disabled={isDeploying}
            className={classNames(
              'flex items-center px-1.5 py-1.5 rounded-r-lg text-xs font-semibold shadow-sm transition-all border-l border-white/10',
              isDeploying
                ? 'bg-gray-600/80 text-white cursor-wait'
                : hasVercel
                  ? 'bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-gray-800 hover:to-gray-700'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400',
            )}
          >
            <div className="i-ph:caret-down text-[10px] opacity-70" />
          </button>
        </div>

        {/* Dropdown */}
        {open && !isDeploying && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-gradient-to-r from-orange-500/10 to-amber-500/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <div className="i-ph:rocket-launch-duotone text-orange-400 text-base" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-bolt-elements-textPrimary">{t('deploy.projectDeploy')}</p>
                  <p className="text-[10px] text-bolt-elements-textTertiary">
                    {cloudflareProject ? t('deploy.updateCloudflare') : t('deploy.publishCloudflare')}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2 space-y-1">
              {/* PRIMARY: Deploy to Vercel (default provider) */}
              {hasVercel && (
                <button
                  onClick={() => deployTo('vercel')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group border border-gray-500/20 bg-gray-500/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-500/20 to-gray-600/20 flex items-center justify-center shrink-0 group-hover:from-gray-500/30 group-hover:to-gray-600/30 transition-colors">
                    <div className="i-ph:triangle-fill text-white text-base" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-bolt-elements-textPrimary">
                      {settings?.vercel?.projectName ? `Update on Vercel` : t('deploy.publishOnVercel')}
                    </p>
                    <p className="text-[10px] text-bolt-elements-textTertiary truncate">
                      {settings?.vercel?.projectName ? t('deploy.sameUrlUpdate') : t('deploy.vercelDefault')}
                    </p>
                  </div>
                  <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-500/20 text-white uppercase tracking-wider">
                    {t('deploy.default')}
                  </div>
                </button>
              )}

              {/* Cloudflare Pages (free, no API key) */}
              <button
                onClick={deployToCloudflare}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left group border border-orange-500/20 bg-orange-500/5"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center shrink-0 group-hover:from-orange-500/30 group-hover:to-amber-500/30 transition-colors">
                  <div className="i-ph:cloud-duotone text-orange-400 text-base" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-bolt-elements-textPrimary">
                    {cloudflareProject ? t('deploy.updateOnCloudflare') : t('deploy.publishOnCloudflare')}
                  </p>
                  <p className="text-[10px] text-bolt-elements-textTertiary truncate">
                    {cloudflareProject ? t('deploy.sameUrlUpdate') : t('deploy.freeNoApiKey')}
                  </p>
                </div>
                <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-orange-500/20 text-orange-400 uppercase tracking-wider">
                  {t('deploy.free')}
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
              {(hasUserNetlifyToken || hasCloudRun) && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                  <span className="text-[9px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium">{t('deploy.others')}</span>
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                </div>
              )}

              {/* Netlify (only if user has configured a token) */}
              {hasUserNetlifyToken && (
                <button
                  onClick={deployToNetlify}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bolt-elements-item-backgroundActive transition-all text-left"
                >
                  <div className="w-7 h-7 rounded-lg bg-bolt-elements-item-backgroundActive flex items-center justify-center shrink-0 overflow-hidden">
                    <img src="/logos/netlify.svg" alt="Netlify" className="w-5 h-5 object-contain" />
                  </div>
                  <span className="text-xs text-bolt-elements-textSecondary font-medium">Netlify</span>
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
