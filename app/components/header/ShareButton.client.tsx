import { useStore } from '@nanostores/react';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject, updateActiveProjectSettings, isValidUUID } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore } from '~/lib/stores/auth';
import { chatStore } from '~/lib/stores/chat';
import { getSupabase } from '~/lib/supabase';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';

type ShareType = 'collaborative' | 'basic';

interface ShareRecord {
  id: string;
  share_type: ShareType;
  collaborator_email?: string;
  collaborator_name?: string;
  collaborator_avatar?: string;
  share_token: string;
  status: string;
  created_at: string;
}

interface ShareButtonProps {
  onOpenSettings: () => void;
}

export const ShareButton = memo(function ShareButton({ onOpenSettings }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [shareType, setShareType] = useState<ShareType>('collaborative');
  const [collaboratorEmail, setCollaboratorEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [loadingShares, setLoadingShares] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const t = useT();
  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[projectId] ?? getActiveProject();
  const { user } = useStore(authStore);
  const chat = useStore(chatStore);

  // Real-time collaboration channel
  const [collabChannel, setCollabChannel] = useState<any>(null);
  const [onlineCollaborators, setOnlineCollaborators] = useState<{ id: string; name: string }[]>([]);

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

  // Load existing shares when dropdown opens
  useEffect(() => {
    if (!open) return;
    const pid = activeProjectIdStore.get();
    if (!pid || pid === 'default') return;
    loadShares();
  }, [open, projectId]);

  const loadShares = async () => {
    const pid = activeProjectIdStore.get();
    if (!pid || pid === 'default') return;
    setLoadingShares(true);
    try {
      const res = await fetch(`/api/share?projectId=${pid}`);
      const data: any = await res.json();
      if (data.shares) {
        setShares(data.shares);
      }
    } catch (err) {
      console.warn('[ShareButton] Failed to load shares:', err);
    } finally {
      setLoadingShares(false);
    }
  };

  // Set up real-time collaboration when the project has active collaborative shares
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !projectId || projectId === 'default') return;

    // Subscribe to a collaboration channel for this project
    const channel = sb.channel(`project-collab:${projectId}`, {
      config: { presence: { key: user?.id || 'anonymous' } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const collabs = Object.entries(state).map(([id, presences]: [string, any]) => ({
        id,
        name: presences[0]?.name || 'Anonymous',
      }));
      setOnlineCollaborators(collabs);
    });

    // Listen for real-time file changes from collaborators
    channel.on('broadcast', { event: 'file-change' }, (payload: any) => {
      const { path, content, changedBy } = payload;
      if (changedBy === user?.id) return; // Ignore own changes
      // Update the file in the workbench
      const files = workbenchStore.files.get();
      if (files[path]) {
        workbenchStore.files.setKey(path, { ...files[path], content, type: 'file', isBinary: false });
      }
    });

    // Listen for real-time chat messages from collaborators
    channel.on('broadcast', { event: 'chat-message' }, (payload: any) => {
      const { message, sentBy } = payload;
      if (sentBy === user?.id) return;
      // Dispatch the message to the chat store
      window.dispatchEvent(new CustomEvent('collaborator-message', { detail: { message, sentBy } }));
    });

    channel.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          name: user?.user_metadata?.full_name || user?.email || 'Anonymous',
          userId: user?.id,
        });
      }
    });

    setCollabChannel(channel);

    return () => {
      channel.unsubscribe();
      setCollabChannel(null);
      setOnlineCollaborators([]);
    };
  }, [projectId, user?.id]);

  // Broadcast file changes to collaborators
  useEffect(() => {
    if (!collabChannel) return;

    const handler = (e: CustomEvent) => {
      const { path, content } = e.detail;
      collabChannel.send({
        type: 'broadcast',
        event: 'file-change',
        payload: { path, content, changedBy: user?.id },
      });
    };

    window.addEventListener('file-content-changed', handler as EventListener);
    return () => window.removeEventListener('file-content-changed', handler as EventListener);
  }, [collabChannel, user?.id]);

  const handleShare = useCallback(async () => {
    if (!user) {
      toast.error(t('share.loginRequired'));
      return;
    }

    // If the project is not a valid UUID, auto-create it in Supabase first
    let currentProjectId = activeProjectIdStore.get();

    if (!isValidUUID(currentProjectId)) {
      try {
        const proj = projectsStore.get()[currentProjectId || 'default'];
        const projectName = proj?.name || project?.name || 'Untitled Project';
        await updateActiveProjectSettings({ name: projectName });
        currentProjectId = activeProjectIdStore.get();

        if (!isValidUUID(currentProjectId)) {
          toast.error('Falha ao criar projeto. Envie uma mensagem no chat para salvar primeiro.');
          return;
        }

        // Save all files to Supabase for the new project
        await workbenchStore.saveEntireProject();
      } catch (err: any) {
        console.error('[ShareButton] Failed to auto-create project:', err);
        toast.error(err?.message || 'Falha ao criar projeto na nuvem. Tente salvar primeiro.');
        return;
      }
    }

    const shareProjectId = currentProjectId;

    if (shareType === 'collaborative' && !collaboratorEmail.trim()) {
      toast.error(t('share.emailRequired'));
      return;
    }

    setSharing(true);
    try {
      // Save all files first
      await workbenchStore.saveAllFiles();

      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          projectId: shareProjectId,
          shareType,
          collaboratorEmail: shareType === 'collaborative' ? collaboratorEmail.trim() : undefined,
          userId: user.id,
        }),
      });

      const data: any = await res.json();

      if (!res.ok) {
        if (data.migrationNeeded) {
          toast.error(
            <div className="flex flex-col gap-1">
              <span className="font-semibold">Database migration needed</span>
              <span className="text-xs">Run the project_shares migration SQL in Supabase SQL Editor to create the table.</span>
            </div>,
            { autoClose: 15000 },
          );
          return;
        }
        throw new Error(data.error || 'Failed to create share');
      }

      // Copy share link to clipboard
      const shareUrl = `${window.location.origin}/chat/${shareProjectId}?share=${data.share?.id}`;
      await navigator.clipboard.writeText(shareUrl);

      if (shareType === 'collaborative') {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('share.collabInvited')}</span>
            <span className="text-xs text-bolt-elements-textTertiary">{collaboratorEmail}</span>
          </div>,
          { autoClose: 5000 },
        );
      } else {
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{t('share.linkCopied')}</span>
            <span className="text-xs text-blue-400 underline break-all">{shareUrl}</span>
          </div>,
          { autoClose: 8000 },
        );
      }

      setCollaboratorEmail('');
      loadShares();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('share.failed'));
    } finally {
      setSharing(false);
    }
  }, [shareType, collaboratorEmail, projectId, user, t]);

  const handleRevoke = useCallback(async (shareId: string) => {
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', shareId }),
      });

      const data: any = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to revoke');

      toast.success(t('share.revoked'));
      loadShares();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to revoke share');
    }
  }, [t]);

  const collaborativeShares = shares.filter((s) => s.share_type === 'collaborative');
  const basicShares = shares.filter((s) => s.share_type === 'basic');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={!chat.started}
        className={classNames(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all',
          'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-400 hover:to-cyan-400 hover:shadow-md active:scale-[0.97]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
        )}
        title={t('share.button')}
      >
        <div className="i-ph:share-network text-sm" />
        <span className="hidden sm:inline">{t('share.button')}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[85vh] overflow-y-auto bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <div className="i-ph:share-network text-blue-400 text-base" />
              </div>
              <div>
                <p className="text-sm font-semibold text-bolt-elements-textPrimary">{t('share.title')}</p>
                <p className="text-[10px] text-bolt-elements-textTertiary">
                  {t('share.subtitle')}
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-bolt-elements-borderColor">
            <button
              onClick={() => setActiveTab('create')}
              className={classNames(
                'flex-1 px-3 py-2 text-xs font-medium transition-all border-b-2',
                activeTab === 'create'
                  ? 'text-blue-400 border-blue-400 bg-blue-500/5'
                  : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textSecondary',
              )}
            >
              {t('share.newShare')}
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={classNames(
                'flex-1 px-3 py-2 text-xs font-medium transition-all border-b-2 relative',
                activeTab === 'manage'
                  ? 'text-blue-400 border-blue-400 bg-blue-500/5'
                  : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textSecondary',
              )}
            >
              {t('share.manage')}
              {shares.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-400">
                  {shares.length}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'create' ? (
            <div className="p-4 space-y-4">
              {/* Share Type Selector */}
              <div>
                <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-2">
                  {t('share.shareType')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {/* Collaborative */}
                  <button
                    onClick={() => setShareType('collaborative')}
                    className={classNames(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-left',
                      shareType === 'collaborative'
                        ? 'border-blue-500/40 bg-blue-500/10 shadow-sm'
                        : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-blue-500/20',
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/15 flex items-center justify-center">
                      <div className="i-ph:users-three-duotone text-blue-400 text-lg" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-bolt-elements-textPrimary">{t('share.collaborative')}</p>
                      <p className="text-[9px] text-bolt-elements-textTertiary mt-0.5">{t('share.collabDesc')}</p>
                    </div>
                    <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-500/20 text-blue-400 uppercase tracking-wider">
                      {t('share.realtime')}
                    </div>
                  </button>

                  {/* Basic */}
                  <button
                    onClick={() => setShareType('basic')}
                    className={classNames(
                      'flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-left',
                      shareType === 'basic'
                        ? 'border-emerald-500/40 bg-emerald-500/10 shadow-sm'
                        : 'border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 hover:border-emerald-500/20',
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                      <div className="i-ph:link-duotone text-emerald-400 text-lg" />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-bolt-elements-textPrimary">{t('share.basic')}</p>
                      <p className="text-[9px] text-bolt-elements-textTertiary mt-0.5">{t('share.basicDesc')}</p>
                    </div>
                    <div className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
                      {t('share.readOnly')}
                    </div>
                  </button>
                </div>
              </div>

              {/* Collaborative: Email input */}
              {shareType === 'collaborative' && (
                <div>
                  <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1">
                    {t('share.collaboratorEmail')}
                  </label>
                  <input
                    type="email"
                    value={collaboratorEmail}
                    onChange={(e) => setCollaboratorEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/40 transition-all"
                  />
                  <p className="text-[9px] text-bolt-elements-textTertiary mt-1">
                    {t('share.collabNote')}
                  </p>

                  {/* Real-time features info */}
                  <div className="mt-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                    <p className="text-[10px] font-semibold text-blue-400 mb-1.5">{t('share.realtimeFeatures')}</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                        <div className="i-ph:check-circle-fill text-blue-400 text-[10px]" />
                        {t('share.featureFiles')}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                        <div className="i-ph:check-circle-fill text-blue-400 text-[10px]" />
                        {t('share.featureChat')}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                        <div className="i-ph:check-circle-fill text-blue-400 text-[10px]" />
                        {t('share.featureSettings')}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Basic share info */}
              {shareType === 'basic' && (
                <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                  <p className="text-[10px] font-semibold text-emerald-400 mb-1.5">{t('share.basicFeatures')}</p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                      <div className="i-ph:check-circle-fill text-emerald-400 text-[10px]" />
                      {t('share.featureFilesOnly')}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                      <div className="i-ph:x-circle-fill text-red-400/50 text-[10px]" />
                      {t('share.noEdit')}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                      <div className="i-ph:x-circle-fill text-red-400/50 text-[10px]" />
                      {t('share.noHistory')}
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-bolt-elements-textTertiary">
                      <div className="i-ph:x-circle-fill text-red-400/50 text-[10px]" />
                      {t('share.noSettings')}
                    </div>
                  </div>
                </div>
              )}

              {/* Create button */}
              <button
                onClick={handleShare}
                disabled={sharing || (shareType === 'collaborative' && !collaboratorEmail.trim()) || !user}
                className={classNames(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
                  shareType === 'collaborative'
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500'
                    : 'bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-500 hover:to-green-500',
                )}
              >
                {sharing ? (
                  <>
                    <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                    {t('share.creating')}
                  </>
                ) : (
                  <>
                    <div className={shareType === 'collaborative' ? 'i-ph:users-three text-sm' : 'i-ph:link text-sm'} />
                    {shareType === 'collaborative' ? t('share.inviteCollaborator') : t('share.createLink')}
                  </>
                )}
              </button>

              {!user && (
                <p className="text-[10px] text-center text-amber-400">{t('share.loginRequired')}</p>
              )}
            </div>
          ) : (
            /* Manage tab */
            <div className="p-4 space-y-3">
              {loadingShares ? (
                <div className="flex items-center justify-center py-6">
                  <div className="i-svg-spinners:90-ring-with-bg text-lg text-blue-400" />
                </div>
              ) : shares.length === 0 ? (
                <div className="text-center py-6">
                  <div className="i-ph:share-network text-2xl text-bolt-elements-textTertiary/30 mb-2" />
                  <p className="text-xs text-bolt-elements-textTertiary">{t('share.noShares')}</p>
                </div>
              ) : (
                <>
                  {/* Collaborative shares */}
                  {collaborativeShares.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-2">
                        {t('share.collaborative')} ({collaborativeShares.length})
                      </p>
                      <div className="space-y-1.5">
                        {collaborativeShares.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor"
                          >
                            <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                              {share.collaborator_avatar ? (
                                <img src={share.collaborator_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="i-ph:user text-blue-400 text-xs" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-bolt-elements-textPrimary truncate">
                                {share.collaborator_name || share.collaborator_email || 'Unknown'}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className={classNames(
                                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase',
                                  share.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400',
                                )}>
                                  <div className={classNames(
                                    'w-1 h-1 rounded-full',
                                    share.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400',
                                  )} />
                                  {share.status === 'active' ? t('share.active') : t('share.pending')}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevoke(share.id)}
                              className="p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                              title={t('share.revoke')}
                            >
                              <div className="i-ph:x text-xs" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Basic shares */}
                  {basicShares.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2">
                        {t('share.basic')} ({basicShares.length})
                      </p>
                      <div className="space-y-1.5">
                        {basicShares.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor"
                          >
                            <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                              <div className="i-ph:link text-emerald-400 text-xs" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-bolt-elements-textPrimary">
                                {t('share.sharedLink')}
                              </p>
                              <p className="text-[9px] text-bolt-elements-textTertiary">
                                {new Date(share.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const url = `${window.location.origin}/chat/${projectId}?share=${share.id}`;
                                  await navigator.clipboard.writeText(url);
                                  toast.success(t('share.linkCopied'));
                                }}
                                className="p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                                title={t('share.copyLink')}
                              >
                                <div className="i-ph:copy text-xs" />
                              </button>
                              <button
                                onClick={() => handleRevoke(share.id)}
                                className="p-1.5 rounded-lg text-bolt-elements-textTertiary hover:text-red-400 hover:bg-red-500/10 transition-all"
                                title={t('share.revoke')}
                              >
                                <div className="i-ph:x text-xs" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Online collaborators */}
              {onlineCollaborators.length > 0 && (
                <div className="mt-3 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/15">
                  <p className="text-[10px] font-semibold text-blue-400 mb-1.5">
                    {t('share.onlineNow')} ({onlineCollaborators.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {onlineCollaborators.map((collab) => (
                      <span key={collab.id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-[9px] font-medium text-blue-400">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {collab.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
