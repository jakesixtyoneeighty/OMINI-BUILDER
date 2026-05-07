import { useStore } from '@nanostores/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { authStore } from '~/lib/stores/auth';
import { getSupabase } from '~/lib/supabase';
import { toast } from 'react-toastify';

interface AccountSettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

export function AccountSettingsDialog({ open, onClose }: AccountSettingsDialogProps) {
  const { user } = useStore(authStore);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'avatar'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form from user metadata
  useEffect(() => {
    if (!open || !user) return;
    const meta = user.user_metadata || {};
    setDisplayName(meta.full_name || meta.name || '');
    setAvatarUrl(meta.avatar_url || '');
  }, [open, user]);

  const handleSave = useCallback(async () => {
    if (!user) return;

    setSaving(true);
    try {
      const sb = getSupabase();
      if (!sb) {
        toast.error('Supabase is not configured');
        return;
      }

      // Update auth user metadata
      const { error: authError } = await sb.auth.updateUser({
        data: {
          full_name: displayName,
          avatar_url: avatarUrl,
        },
      });

      if (authError) {
        toast.error(authError.message);
        return;
      }

      // Also update profiles table
      await sb.from('profiles').upsert({
        id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      });

      // Refresh the auth store with updated user
      const { data: sessionData } = await sb.auth.getSession();
      if (sessionData.session?.user) {
        authStore.setKey('user', sessionData.session.user);
      }

      toast.success('Profile updated!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }, [user, displayName, avatarUrl, onClose]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    // Convert to base64 for storage in user metadata
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAvatarUrl(result);
      setActiveTab('avatar');
    };
    reader.readAsDataURL(file);
  }, []);

  if (!open || !user) return null;

  const currentAvatar = avatarUrl || user.user_metadata?.avatar_url || '';
  const currentName = displayName || user.user_metadata?.full_name || user.user_metadata?.name || user.email || 'User';

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-md mx-4 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bolt-elements-borderColor">
          <h2 className="text-base font-semibold text-bolt-elements-textPrimary">Account Settings</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            <div className="i-ph:x text-base" />
          </button>
        </div>

        {/* Avatar preview */}
        <div className="flex flex-col items-center pt-6 pb-4 px-5">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-bolt-elements-background-depth-3 border-2 border-bolt-elements-borderColor overflow-hidden flex items-center justify-center">
              {currentAvatar ? (
                <img src={currentAvatar} alt={currentName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl font-bold text-bolt-elements-textTertiary">{currentName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 w-24 h-24 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all"
              title="Change photo"
            >
              <div className="i-ph:camera text-xl text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
          <p className="text-sm text-bolt-elements-textPrimary font-medium mt-3">{currentName}</p>
          <p className="text-xs text-bolt-elements-textTertiary">{user.email}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-bolt-elements-borderColor px-5">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textPrimary'
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab('avatar')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              activeTab === 'avatar'
                ? 'text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent'
                : 'text-bolt-elements-textTertiary border-transparent hover:text-bolt-elements-textPrimary'
            }`}
          >
            Avatar
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {activeTab === 'profile' && (
            <>
              {/* Display name */}
              <div>
                <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive transition-all"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Email</label>
                <input
                  type="email"
                  value={user.email || ''}
                  readOnly
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textTertiary cursor-not-allowed"
                />
                <p className="text-[11px] text-bolt-elements-textTertiary mt-1">Email cannot be changed here</p>
              </div>

              {/* Provider info */}
              {user.app_metadata?.provider && (
                <div>
                  <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Connected via</label>
                  <div className="flex items-center gap-2 px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg">
                    <div className={`text-sm ${user.app_metadata.provider === 'github' ? 'i-ph:github-logo' : user.app_metadata.provider === 'google' ? 'i-ph:google-logo' : 'i-ph:envelope'}`} />
                    <span className="text-sm text-bolt-elements-textPrimary capitalize">{user.app_metadata.provider}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'avatar' && (
            <>
              {/* Upload from file */}
              <div>
                <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Upload Photo</label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:border-bolt-elements-borderColorActive transition-all"
                >
                  <div className="i-ph:upload-simple text-base" />
                  Choose image
                </button>
                <p className="text-[11px] text-bolt-elements-textTertiary mt-1">PNG, JPG, or GIF. Max 2MB.</p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-bolt-elements-borderColor" />
                <span className="text-xs text-bolt-elements-textTertiary">or paste URL</span>
                <div className="flex-1 border-t border-bolt-elements-borderColor" />
              </div>

              {/* Avatar URL */}
              <div>
                <label className="block text-xs font-medium text-bolt-elements-textSecondary mb-1.5">Image URL</label>
                <input
                  type="url"
                  value={avatarUrl.startsWith('data:') ? '' : avatarUrl}
                  onChange={(e) => {
                    setAvatarUrl(e.target.value);
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg text-sm text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:border-bolt-elements-borderColorActive transition-all"
                />
                {avatarUrl && !avatarUrl.startsWith('data:') && (
                  <button
                    onClick={() => setAvatarUrl('')}
                    className="text-[11px] text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary mt-1 transition-colors"
                  >
                    Clear URL
                  </button>
                )}
              </div>

              {/* Preview of URL image */}
              {avatarUrl && (
                <div className="flex items-center gap-3 p-3 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded-lg">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor shrink-0">
                    <img
                      src={avatarUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-bolt-elements-textPrimary">Preview</p>
                    <p className="text-[11px] text-bolt-elements-textTertiary truncate">
                      {avatarUrl.startsWith('data:') ? 'Uploaded image' : avatarUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => setAvatarUrl('')}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-bolt-elements-textTertiary hover:text-red-400 hover:bg-red-400/10 transition-all"
                    title="Remove"
                  >
                    <div className="i-ph:trash text-sm" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-bolt-elements-borderColor">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover text-sm font-medium transition-all disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="i-ph:spinner-gap text-base animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <div className="i-ph:check text-base" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
