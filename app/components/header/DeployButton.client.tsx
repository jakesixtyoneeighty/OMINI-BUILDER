import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject, updateActiveProjectSettings, isValidUUID } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';
import { buildProjectForDeploy, getRawSourceFiles, type BuildFile } from '~/utils/deploy-build';

type DeployProvider = 'cloudflare' | 'netlify' | 'vercel' | 'cloudrun' | 'omnibuilder';
type DeployPhase = 'idle' | 'building' | 'deploying' | 'success' | 'error';

interface DeployButtonProps {
  onOpenSettings: () => void;
}

export const DeployButton = memo(function DeployButton({ onOpenSettings }: DeployButtonProps) {
  const [open, setOpen] = useState(false);
  const [deploying, setDeploying] = useState<DeployProvider | null>(null);
  const [deployPhase, setDeployPhase] = useState<DeployPhase>('idle');
  const [deployResult, setDeployResult] = useState<{ url: string; provider: string } | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastDeployStackRef = useRef<string>('');
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
    if (hasVercel) list.push({ key: 'vercel', label: 'Vercel', logo: '/logos/vercel.svg', color: 'text-white' });
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

  /**
   * Get ALL raw source files from the WebContainer filesystem.
   * This reads files directly from the container (not the store) to ensure
   * all files including binary ones are included with correct relative paths.
   */
  const getProjectFiles = async (): Promise<BuildFile[]> => {
    await workbenchStore.saveAllFiles();
    return getRawSourceFiles();
  };

  /**
   * Build the project in the WebContainer and return the built output files.
   * On build failure, sets buildError so the "Fix with AI" button appears.
   */
  const getBuiltFiles = async (): Promise<BuildFile[] | null> => {
    await workbenchStore.saveAllFiles();
    setDeployPhase('building');
    setBuildError(null);

    try {
      const result = await buildProjectForDeploy();

      if (result.success && result.files.length > 0) {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('deploy.buildSuccess')}</span>
            <span className="text-[10px] text-bolt-elements-textTertiary">
              {result.files.length} {t('deploy.filesFrom')} {result.buildOutputDir}/
            </span>
          </div>,
          { autoClose: 3000, toastId: 'deploy-build' },
        );
        return result.files;
      }

      // Build failed — show error + "Fix with AI" button
      setBuildError(result.error || 'Build failed');
      setDeployPhase('error');
      toast.dismiss('deploy-building');

      return null;
    } catch (err) {
      setBuildError(err instanceof Error ? err.message : 'Build failed');
      setDeployPhase('error');
      toast.dismiss('deploy-building');

      return null;
    }
  };

  /**
   * Poll Vercel deployment status until it's ready or fails.
   * Keeps the spinner running until the deployment actually completes.
   * Returns the final URL if successful, or throws on build error.
   */
  const pollVercelDeploy = async (deployId: string, token: string, teamId: string, fallbackUrl: string): Promise<string> => {
    const MAX_POLLS = 120; // 120 * 5s = 10 minutes max
    const POLL_INTERVAL = 5000; // 5 seconds

    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL));

      try {
        const params = new URLSearchParams({ deployId, token });
        if (teamId) params.set('teamId', teamId);
        const checkRes = await fetch(`/api/vercel-deploy?${params.toString()}`);
        const checkData: any = await checkRes.json();

        if (checkData.isReady) {
          return checkData.url || fallbackUrl;
        }

        if (checkData.isError) {
          const errMsg = checkData.errorMessage || 'Vercel build failed';
          setBuildError(errMsg);
          throw new Error(errMsg);
        }

        // Still building — keep spinning
      } catch (err) {
        // If it's our own thrown error (build failed), re-throw
        if (err instanceof Error && err.message !== 'Failed to fetch') {
          throw err;
        }
        // Network error — keep trying
        console.warn('[DeployButton] Poll error, retrying...', err);
      }
    }

    // Timeout — but don't fail, just return the URL (deployment might still be building)
    return fallbackUrl;
  };

  /**
   * Send the build/deploy error to the AI chat so it can fix it.
   * Includes the complete error details (stack trace) for better AI diagnosis.
   */
  const fixWithAI = useCallback(() => {
    const errorMsg = buildError || deployError || '';
    if (!errorMsg) return;

    // Include full error details for AI diagnosis
    const fullError = [
      `Erro de ${buildError ? 'build' : 'deploy'}:`,
      errorMsg,
      lastDeployStackRef.current ? `\nStack trace completo:\n${lastDeployStackRef.current}` : '',
    ].filter(Boolean).join('\n');

    // Send error to the chat as a user message
    window.dispatchEvent(
      new CustomEvent('ai-fix-requested', {
        detail: {
          error: fullError,
          type: buildError ? 'build' : 'deploy',
        },
      }),
    );

    // Clear errors and reset
    setBuildError(null);
    setDeployError(null);
    setDeployPhase('idle');
    setDeploying(null);
    lastDeployStackRef.current = '';
  }, [buildError, deployError]);

  // Default deploy: Vercel (if token available), otherwise Cloudflare Pages
  const defaultDeploy = useCallback(() => {
    if (hasVercel) {
      return deployTo('vercel');
    }
    return deployToCloudflare();
  }, [hasVercel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for AI deploy trigger
  useEffect(() => {
    const handleAiDeploy = (event: Event) => {
      const { projectName } = (event as CustomEvent).detail || {};
      if (projectName) {
        updateActiveProjectSettings({
          vercel: { projectName, token: vercelToken, framework: settings?.vercel?.framework || 'vite' },
        });
      }
      defaultDeploy();
    };

    window.addEventListener('ai-deploy-trigger', handleAiDeploy as EventListener);
    return () => window.removeEventListener('ai-deploy-trigger', handleAiDeploy as EventListener);
  }, [hasVercel, vercelToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cloudflare Pages deploy (reuses same project name = same URL) ──
  const deployToCloudflare = async () => {
    setDeploying('cloudflare');
    setDeployPhase('building');
    setDeployResult(null);
    setBuildError(null);
    setDeployError(null);
    setOpen(false);

    try {
      const fileList = await getBuiltFiles();
      if (fileList === null) return; // Build failed, error state is set

      setDeployPhase('deploying');

      const projectName = (settings?.name || project?.name || 'my-project')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 28);

      // Always reuse existing project name (same site / same URL)
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
      setDeployPhase('success');

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
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">
            {data.url}
          </a>
          {data.processing && <span className="text-[9px] text-amber-400">{t('deploy.processing')}</span>}
          {cloudflareProject && !data.processing && <span className="text-[9px] text-bolt-elements-textTertiary">{t('deploy.siteUpdated')}</span>}
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('deploy.failed');
      const errStack = err instanceof Error ? err.stack : '';
      lastDeployStackRef.current = errStack || errMsg;
      setDeployError(errMsg);
      setDeployPhase('error');
      toast.error(
        <div className="max-w-[450px]">
          <div className="font-semibold text-sm mb-1">{t('deploy.failed')}</div>
          <div className="text-xs text-red-300 break-all">{errMsg}</div>
          {errStack && (
            <details className="mt-2">
              <summary className="text-[10px] opacity-70 cursor-pointer hover:opacity-100">Ver detalhes completos do erro</summary>
              <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap break-all opacity-80">{errStack}</pre>
            </details>
          )}
        </div>,
        { autoClose: false, closeOnClick: false },
      );
    } finally {
      setDeploying(null);
    }
  };

  // ── Netlify Deploy ──
  const deployToNetlify = async () => {
    setDeploying('netlify');
    setDeployPhase('deploying');
    setDeployResult(null);
    setBuildError(null);
    setDeployError(null);
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

      // Reuse existing site ID (same URL)
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
      if (!res.ok) throw new Error(data.error || 'Deploy failed');

      setDeployResult({ url: data.url, provider: 'Netlify' });
      setDeployPhase('success');

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
          <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">{data.url}</a>
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('deploy.failed');
      const errStack = err instanceof Error ? err.stack : '';
      lastDeployStackRef.current = errStack || errMsg;
      setDeployError(errMsg);
      setDeployPhase('error');
      toast.error(
        <div className="max-w-[450px]">
          <div className="font-semibold text-sm mb-1">{t('deploy.failed')}</div>
          <div className="text-xs text-red-300 break-all">{errMsg}</div>
          {errStack && (
            <details className="mt-2">
              <summary className="text-[10px] opacity-70 cursor-pointer hover:opacity-100">Ver detalhes completos do erro</summary>
              <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap break-all opacity-80">{errStack}</pre>
            </details>
          )}
        </div>,
        { autoClose: false, closeOnClick: false },
      );
    } finally {
      setDeploying(null);
    }
  };

  const deployToOmniBuilder = async () => {
    setDeploying('omnibuilder');
    setDeployPhase('deploying');
    setDeployResult(null);
    setBuildError(null);
    setDeployError(null);
    setOpen(false);

    try {
      const allFiles = await getProjectFiles();
      // OmniBuilder preview only supports text files (no binary images/assets)
      const fileList = allFiles.filter((f) => !f.binary).map((f) => ({ path: f.path, content: f.content }));
      const projectName = settings?.name || project?.name || 'My Project';
      const projectDesc = settings?.description || '';

      // Check if we have an existing deploy to reuse (same URL)
      const existingDeployId = settings?.omnibuilder?.deployId || '';

      const res = await fetch('/api/deploy-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          existingDeployId
            ? { action: 'update', deployId: existingDeployId, name: projectName, description: projectDesc, files: fileList }
            : { action: 'create', name: projectName, description: projectDesc, files: fileList },
        ),
      });

      const data = await res.json();
      if (!res.ok) {
        // If update failed because deploy was deleted, try creating a new one
        if (existingDeployId && (data.error?.includes('not found') || res.status === 404)) {
          const retryRes = await fetch('/api/deploy-view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'create', name: projectName, description: projectDesc, files: fileList }),
          });
          const retryData = await retryRes.json();
          if (!retryRes.ok) {
            if (retryData.migrationNeeded) {
              toast.error(
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">Database migration needed</span>
                  <span className="text-xs">Run the SQL in supabase_deploy_migration.sql</span>
                </div>,
                { autoClose: 12000 },
              );
              return;
            }
            throw new Error(retryData.error || 'Deploy failed');
          }
          // New deploy created after old one was gone — save new deploy ID
          updateActiveProjectSettings({
            omnibuilder: { deployId: retryData.deployId },
            lastDeploy: {
              url: retryData.viewUrl,
              provider: 'omnibuilder',
              siteId: retryData.deployId,
              deployedAt: new Date().toISOString(),
            },
          });
          setDeployResult({ url: retryData.viewUrl, provider: 'Omni Builder' });
          setDeployPhase('success');
          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('deploy.successOmni')}</span>
              <a href={retryData.viewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">{retryData.viewUrl}</a>
            </div>,
            { autoClose: 12000 },
          );
          return;
        }
        if (data.migrationNeeded) {
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Database migration needed</span>
              <span className="text-xs">Run the SQL in supabase_deploy_migration.sql</span>
            </div>,
            { autoClose: 12000 },
          );
          return;
        }
        throw new Error(data.error || 'Deploy failed');
      }

      // Save deploy ID and last deploy info to project settings
      updateActiveProjectSettings({
        omnibuilder: { deployId: data.deployId },
        lastDeploy: {
          url: data.viewUrl,
          provider: 'omnibuilder',
          siteId: data.deployId,
          deployedAt: new Date().toISOString(),
        },
      });

      setDeployResult({ url: data.viewUrl, provider: 'Omni Builder' });
      setDeployPhase('success');

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{existingDeployId ? t('deploy.siteUpdated') || 'Site atualizado!' : t('deploy.successOmni')}</span>
          <a href={data.viewUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">{data.viewUrl}</a>
        </div>,
        { autoClose: 12000 },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('deploy.failed');
      const errStack = err instanceof Error ? err.stack : '';
      lastDeployStackRef.current = errStack || errMsg;
      setDeployError(errMsg);
      setDeployPhase('error');
      toast.error(
        <div className="max-w-[450px]">
          <div className="font-semibold text-sm mb-1">{t('deploy.failed')}</div>
          <div className="text-xs text-red-300 break-all">{errMsg}</div>
          {errStack && (
            <details className="mt-2">
              <summary className="text-[10px] opacity-70 cursor-pointer hover:opacity-100">Ver detalhes completos do erro</summary>
              <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap break-all opacity-80">{errStack}</pre>
            </details>
          )}
        </div>,
        { autoClose: false, closeOnClick: false },
      );
    } finally {
      setDeploying(null);
    }
  };

  // ── Generic deployTo (Vercel, CloudRun) ──
  const deployTo = async (provider: DeployProvider) => {
    setDeploying(provider);
    setDeployPhase('building');
    setDeployResult(null);
    setBuildError(null);
    setDeployError(null);
    setOpen(false);

    try {
      let fileList: BuildFile[] | null;

      switch (provider) {
        case 'cloudflare': {
          setDeploying(null);
          setDeployPhase('idle');
          return deployToCloudflare();
        }
        case 'netlify': {
          setDeploying(null);
          setDeployPhase('idle');
          return deployToNetlify();
        }
        case 'vercel': {
          // Vercel handles building server-side, so we send raw source files
          fileList = await getProjectFiles();
          if (!fileList || fileList.length === 0) return;

          setDeployPhase('deploying');

          // Ensure project is saved to Supabase before deploying (so Vercel settings can be persisted)
          let currentProjectId = activeProjectIdStore.get();
          if (!isValidUUID(currentProjectId)) {
            const proj = projectsStore.get()[currentProjectId || 'default'];
            const projectName = proj?.name || project?.name || 'Untitled Project';
            await updateActiveProjectSettings({ name: projectName });
            await workbenchStore.saveEntireProject();
            currentProjectId = activeProjectIdStore.get();
          }

          // Read the LATEST settings from the store (they may have updated after project creation)
          const latestProject = projectsStore.get()[activeProjectIdStore.get()] ?? getActiveProject();
          const latestSettings = latestProject?.settings;

          const token = vercelToken;
          // Always reuse the existing projectName (same Vercel project = same URL)
          const projectName = latestSettings?.vercel?.projectName || '';
          const vercelProjectId = latestSettings?.lastDeploy?.siteId || '';
          const framework = latestSettings?.vercel?.framework || 'vite';

          const res = await fetch('/api/vercel-deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, projectName: projectName || undefined, projectId: vercelProjectId || undefined, framework, files: fileList }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.error || 'Deploy failed');
          }

          // Save project info immediately so next deploy reuses the same site
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

          // ── Poll deployment status until ready or error ──
          if (data.deployId) {
            const finalUrl = await pollVercelDeploy(data.deployId, token, data.teamId, data.url);
            setDeployResult({ url: finalUrl || data.url, provider: 'Vercel' });
          } else {
            setDeployResult({ url: data.url, provider: 'Vercel' });
          }

          setDeployPhase('success');

          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('deploy.successGeneric')}</span>
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">{data.url}</a>
            </div>,
            { autoClose: 12000 },
          );
          break;
        }
        case 'cloudrun': {
          fileList = await getProjectFiles();
          if (!fileList) return;

          setDeployPhase('deploying');

          const cr = settings?.cloudRun || {};
          const res = await fetch('/api/cloudrun-deploy', {
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

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Deploy failed');

          setDeployResult({ url: data.url, provider: 'Cloud Run' });
          setDeployPhase('success');

          toast.success(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{t('deploy.successGeneric')}</span>
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline text-xs hover:text-blue-300 break-all">{data.url}</a>
            </div>,
            { autoClose: 12000 },
          );
          break;
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : t('deploy.failed');
      const errStack = err instanceof Error ? err.stack : '';
      const providerLabel = deploying === 'vercel' ? 'Vercel' : deploying === 'cloudrun' ? 'Cloud Run' : String(deploying);
      lastDeployStackRef.current = errStack || errMsg;
      setDeployError(errMsg);
      setDeployPhase('error');
      toast.error(
        <div className="max-w-[450px]">
          <div className="font-semibold text-sm mb-1">{t('deploy.failed')} — {providerLabel}</div>
          <div className="text-xs text-red-300 break-all">{errMsg}</div>
          {errStack && (
            <details className="mt-2">
              <summary className="text-[10px] opacity-70 cursor-pointer hover:opacity-100">Ver detalhes completos do erro</summary>
              <pre className="mt-1 text-[10px] font-mono bg-black/30 rounded p-2 overflow-auto max-h-[150px] whitespace-pre-wrap break-all opacity-80">{errStack}</pre>
            </details>
          )}
        </div>,
        { autoClose: false, closeOnClick: false },
      );
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
  const isInProgress = isDeploying || deployPhase === 'building' || deployPhase === 'deploying';
  const hasError = deployPhase === 'error';

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <div className="flex">
          {/* Main deploy button — shows spinner during entire process */}
          <button
            onClick={hasError ? fixWithAI : defaultDeploy}
            className={classNames(
              'flex items-center gap-2 px-3 py-1.5 rounded-l-lg text-xs font-semibold shadow-sm transition-all relative overflow-hidden',
              hasError
                ? 'bg-red-500/90 text-white hover:bg-red-500 border border-red-400/30'
                : isInProgress
                  ? 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary cursor-wait border border-bolt-elements-borderColor'
                  : deployResult && deployPhase === 'success'
                    ? 'bg-emerald-500/90 text-white hover:bg-emerald-500 border border-emerald-400/30'
                    : hasVercel
                      ? 'bg-bolt-elements-button-secondary-background text-bolt-elements-textPrimary hover:bg-bolt-elements-button-secondary-backgroundHover border border-bolt-elements-borderColor active:scale-[0.97]'
                      : 'bg-orange-500/90 text-white hover:bg-orange-500 border border-orange-400/30 hover:shadow-md active:scale-[0.97]',
            )}
          >
            {hasError ? (
              <>
                <div className="i-ph:wand text-sm" />
                {t('deploy.fixWithAI')}
              </>
            ) : isInProgress ? (
              <>
                <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                {deployPhase === 'building' ? t('deploy.building') : t('deploy.deploying')}
              </>
            ) : deployResult && deployPhase === 'success' ? (
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

          {/* Dropdown toggle */}
          <button
            onClick={() => setOpen(!open)}
            disabled={isInProgress}
            className={classNames(
              'flex items-center px-1.5 py-1.5 rounded-r-lg text-xs font-semibold shadow-sm transition-all border-l border-bolt-elements-borderColor',
              isInProgress
                ? 'bg-bolt-elements-bg-depth-3 text-bolt-elements-textPrimary cursor-wait'
                : hasVercel
                  ? 'bg-bolt-elements-button-secondary-background text-bolt-elements-textPrimary hover:bg-bolt-elements-button-secondary-backgroundHover'
                  : 'bg-orange-500/90 text-white hover:bg-orange-500 border-orange-400/30',
            )}
          >
            <div className="i-ph:caret-down text-[10px] opacity-70" />
          </button>
        </div>

        {/* Build/Deploy error banner with Fix with AI button and close button */}
        {hasError && !open && (buildError || deployError) && (
          <div className="absolute right-0 top-full mt-2 min-w-[280px] max-w-[400px] p-3 rounded-xl bg-red-500/10 border border-red-500/20 shadow-2xl z-[100]">
            <div className="flex items-start gap-2">
              <div className="i-ph:warning-circle-fill text-red-400 text-base mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-red-400 mb-1">
                  {buildError ? t('deploy.buildFailed') : t('deploy.deployFailed')}
                </p>
                <p className="text-[10px] text-bolt-elements-textTertiary break-all line-clamp-4">
                  {buildError || deployError}
                </p>
                <button
                  onClick={fixWithAI}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white text-[10px] font-semibold hover:from-purple-500 hover:to-blue-500 transition-all"
                >
                  <div className="i-ph:wand text-xs" />
                  {t('deploy.fixWithAI')}
                </button>
              </div>
              <button
                onClick={() => { setBuildError(null); setDeployError(null); setDeployPhase('idle'); }}
                className="shrink-0 flex items-center justify-center w-6 h-6 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
                title={t('error.dismiss')}
              >
                <div className="i-ph:x text-sm" />
              </button>
            </div>
          </div>
        )}

        {/* Dropdown */}
        {open && !isInProgress && (
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
                    {settings?.lastDeploy?.url ? t('deploy.updateExisting') : t('deploy.publishNew')}
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

              {/* Separator */}
              {(hasUserNetlifyToken || hasCloudRun) && (
                <div className="flex items-center gap-2 px-3 py-1">
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                  <span className="text-[9px] text-bolt-elements-textTertiary uppercase tracking-wider font-medium">{t('deploy.others')}</span>
                  <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                </div>
              )}

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
              {deployResult && deployPhase === 'success' && (
                <div className="mx-1 mt-1 p-2.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="i-ph:check-circle-fill text-emerald-400 text-sm" />
                    <span className="text-[10px] font-semibold text-emerald-400">{t('deploy.lastDeploy')}: {deployResult.provider}</span>
                  </div>
                  {deployResult.url && (
                    <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:text-blue-300 underline break-all block">
                      {deployResult.url}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
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

      {/* Success mini-banner */}
      {deployResult && deployPhase === 'success' && !open && !isInProgress && !hasError && (
        <div className="absolute right-0 top-full mt-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 whitespace-nowrap z-50 shadow-lg">
          <div className="i-ph:check-circle-fill text-xs mr-1" />
          {deployResult.provider}
        </div>
      )}
    </>
  );
});
