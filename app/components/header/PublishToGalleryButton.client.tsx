import { useStore } from '@nanostores/react';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { projectsStore, activeProjectIdStore, getActiveProject } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore } from '~/lib/stores/auth';
import { toast } from 'react-toastify';

const GALLERY_CATEGORIES = [
  { id: 'web-apps', label: 'Web App', icon: 'i-ph:globe-duotone' },
  { id: 'games', label: 'Game', icon: 'i-ph:game-controller-duotone' },
  { id: 'business', label: 'Business', icon: 'i-ph:briefcase-duotone' },
  { id: 'education', label: 'Education', icon: 'i-ph:graduation-cap-duotone' },
  { id: 'tools', label: 'Tool', icon: 'i-ph:wrench-duotone' },
  { id: 'dashboard', label: 'Dashboard', icon: 'i-ph:chart-bar-duotone' },
  { id: 'social', label: 'Social', icon: 'i-ph:chat-circle-dots-duotone' },
  { id: 'ecommerce', label: 'E-Commerce', icon: 'i-ph:shopping-cart-duotone' },
];

export const PublishToGalleryButton = memo(function PublishToGalleryButton() {
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [publishedId, setPublishedId] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'web-apps',
    tags: '',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projectId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const project = projects[projectId] ?? getActiveProject();
  const { user } = useStore(authStore);

  const files = useStore(workbenchStore.files);
  const fileCount = Object.values(files).filter((f: any) => f?.type === 'file' && !f.isBinary).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        if (step === 'success') {
          setStep('form');
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, step]);

  // Pre-fill name from project
  useEffect(() => {
    if (open && !formData.name) {
      setFormData((prev) => ({
        ...prev,
        name: project?.settings?.name || project?.name || '',
        description: project?.settings?.description || '',
      }));
    }
  }, [open]);

  const handlePublish = useCallback(async () => {
    if (!formData.name.trim()) {
      toast.error('Give your project a name!');
      return;
    }
    if (fileCount === 0) {
      toast.error('No files to publish. Create some files first!');
      return;
    }

    setPublishing(true);
    try {
      // Get all files from workbench
      await workbenchStore.saveAllFiles();
      const allFiles = workbenchStore.files.get();
      const fileList = Object.entries(allFiles)
        .filter(([, f]: any) => f?.type === 'file' && !f.isBinary)
        .map(([path, f]: any) => ({
          path: path.replace(/^\/+/, ''),
          content: f.content,
          isBinary: f.isBinary,
        }));

      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'publish',
          projectData: {
            name: formData.name.trim(),
            description: formData.description.trim(),
            category: formData.category,
            tags,
            authorName: user?.user_metadata?.full_name || user?.email || 'Anonymous',
            authorEmail: user?.email || null,
            files: fileList,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to publish');
      }

      setPublishedId(data.projectId);
      setStep('success');
      toast.success('Project published to Gallery! 🎉');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  }, [formData, fileCount, user, project]);

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setOpen(!open);
            if (open && step === 'success') setStep('form');
          }}
          disabled={fileCount === 0}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 hover:shadow-md active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
          title="Publish to Gallery"
        >
          <div className="i-ph:storefront-duotone text-sm" />
          <span className="hidden sm:inline">Gallery</span>
          <div className="i-ph:caret-down text-[10px] opacity-70" />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {step === 'form' ? (
              <>
                {/* Header */}
                <div className="px-4 py-3 border-b border-bolt-elements-borderColor bg-gradient-to-r from-purple-600/10 to-indigo-600/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <div className="i-ph:storefront-duotone text-purple-400 text-base" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-bolt-elements-textPrimary">Publicar na Galeria</p>
                      <p className="text-[10px] text-bolt-elements-textTertiary">
                        {fileCount} arquivo{fileCount !== 1 ? 's' : ''} no projeto
                      </p>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <div className="p-4 space-y-3">
                  {/* Name */}
                  <div>
                    <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1">
                      Nome do Projeto *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                      placeholder="My Awesome App"
                      className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1">
                      Descricao
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Describe your project..."
                      rows={2}
                      className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all resize-none"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1.5">
                      Categoria
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {GALLERY_CATEGORIES.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setFormData((p) => ({ ...p, category: cat.id }))}
                          className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                            formData.category === cat.id
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/25'
                              : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border border-bolt-elements-borderColor hover:text-bolt-elements-textSecondary'
                          }`}
                        >
                          <div className={`${cat.icon} text-sm`} />
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-[11px] font-medium text-bolt-elements-textSecondary mb-1">
                      Tags (separadas por virgula)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
                      placeholder="react, tailwind, app"
                      className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/40 transition-all"
                    />
                  </div>

                  {/* Publish Button */}
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !formData.name.trim()}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishing ? (
                      <>
                        <div className="i-svg-spinners:90-ring-with-bg text-sm" />
                        Publicando...
                      </>
                    ) : (
                      <>
                        <div className="i-ph:rocket-launch-duotone text-sm" />
                        Publicar na Galeria
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                  <div className="i-ph:check-circle-fill text-3xl text-emerald-400" />
                </div>
                <p className="text-sm font-semibold text-bolt-elements-textPrimary mb-1">Publicado com sucesso!</p>
                <p className="text-xs text-bolt-elements-textTertiary mb-4">
                  Seu projeto esta na galeria do Omni Builder
                </p>
                <div className="flex gap-2">
                  <a
                    href="/gallery"
                    onClick={() => setOpen(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all border border-purple-500/20"
                  >
                    <div className="i-ph:storefront text-sm" />
                    Ver Galeria
                  </a>
                  <button
                    onClick={() => {
                      setStep('form');
                      setFormData({ name: '', description: '', category: 'web-apps', tags: '' });
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor transition-all"
                  >
                    <div className="i-ph:plus text-sm" />
                    Novo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
});
