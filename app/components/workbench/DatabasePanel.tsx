import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getSupabase } from '~/lib/supabase';
import { authStore } from '~/lib/stores/auth';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings, getActiveProject, isValidUUID } from '~/lib/stores/project';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useT } from '~/lib/i18n/useT';

interface CollectionInfo {
  name: string;
  schema: Record<string, { type: string; required?: boolean; unique?: boolean; default?: any }>;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QuotaInfo {
  used_bytes: number;
  max_bytes: number;
  row_count: number;
  collection_count: number;
}

export const DatabasePanel = memo(() => {
  const t = useT();
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const { user } = useStore(authStore);
  const settings = projects[activeId]?.settings;

  const dbType = settings?.database?.type || 'none';
  const supabaseConfig = settings?.database?.supabase || { url: '', anonKey: '', serviceRoleKey: '' };
  const firebaseConfig = settings?.database?.firebase || {
    apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '',
  };

  const [tables, setTables] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [editingDb, setEditingDb] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // Omni DB state
  const [showCreateCollection, setShowCreateCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionSchema, setNewCollectionSchema] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRowData, setNewRowData] = useState('');

  // Auth state
  const [showAuthPanel, setShowAuthPanel] = useState(false);
  const [authUsers, setAuthUsers] = useState<{ _id: string; email: string; _createdAt: string }[]>([]);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

  // Local form state for editing
  const [editType, setEditType] = useState(dbType);
  const [editSupabase, setEditSupabase] = useState(supabaseConfig);
  const [editFirebase, setEditFirebase] = useState(firebaseConfig);

  useEffect(() => {
    setEditType(dbType);
    setEditSupabase(supabaseConfig);
    setEditFirebase(firebaseConfig);
  }, [dbType, supabaseConfig.url, supabaseConfig.anonKey, firebaseConfig.apiKey]);

  // Ensure project exists in Supabase (auto-create if not a valid UUID)
  const ensureProjectInSupabase = useCallback(async (): Promise<string | null> => {
    let currentId = activeProjectIdStore.get();

    if (isValidUUID(currentId)) {
      return currentId; // Already a valid UUID
    }

    // Need to create the project in Supabase
    try {
      const proj = getActiveProject();
      const projectName = proj?.name || 'Untitled Project';
      await updateActiveProjectSettings({ name: projectName });
      currentId = activeProjectIdStore.get();

      if (!isValidUUID(currentId)) {
        toast.error(t('databasePanel.failedToCreateProject'));
        return null;
      }

      // Save all files for the new project
      try { await workbenchStore.saveEntireProject(); } catch {}

      return currentId;
    } catch (err) {
      console.error('[DatabasePanel] Failed to auto-create project:', err);
      toast.error(t('databasePanel.failedToCreateProjectCloud'));
      return null;
    }
  }, [t]);

  // Omni DB API calls
  const omniApiCall = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    // Ensure we have a valid project UUID before calling the API
    const projectId = await ensureProjectInSupabase();
    if (!projectId) {
      throw new Error(t('databasePanel.projectNotSaved'));
    }

    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, projectId, ...extra }),
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.error || 'API call failed');
    return data;
  }, [ensureProjectInSupabase, t]);

  // Load Omni DB collections and quota
  const loadOmniData = useCallback(async () => {
    setLoading(true);
    try {
      // Init quota if not exists
      await omniApiCall('init');
      // Load collections
      const collectionsRes = await omniApiCall('collections');
      setTables(collectionsRes.collections || []);
      // Load quota
      const statsRes = await omniApiCall('stats');
      setQuota(statsRes.quota);
    } catch (err) {
      console.error('Failed to load Omni DB data:', err);
    } finally {
      setLoading(false);
    }
  }, [omniApiCall]);

  // Load Omni DB data when type is omni
  useEffect(() => {
    if (dbType === 'omni') {
      loadOmniData();
    }
  }, [dbType, loadOmniData]);

  // Auto-refresh when AI creates collections via omni_db tool
  useEffect(() => {
    if (dbType !== 'omni') return;

    const handleDbChange = () => {
      loadOmniData();
    };

    // Listen for AI tool calls that create collections
    window.addEventListener('omni-db-collections-changed', handleDbChange);
    // Also refresh when AI finishes a response (it may have used the omni_db tool)
    window.addEventListener('ai-response-finished', handleDbChange);

    return () => {
      window.removeEventListener('omni-db-collections-changed', handleDbChange);
      window.removeEventListener('ai-response-finished', handleDbChange);
    };
  }, [dbType, loadOmniData]);

  const fetchTables = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;

    setLoading(true);
    try {
      const { data, error } = await sb
        .from('information_schema_tables' as never)
        .select('table_name')
        .eq('table_schema', 'public');

      if (error || !data) {
        setTables([]);
        return;
      }

      const tableNames = (data as { table_name: string }[]).map((t) => t.table_name);
      const tableInfos: CollectionInfo[] = tableNames.map((name) => ({
        name,
        rowCount: 0,
        schema: {},
        createdAt: '',
        updatedAt: '',
      }));
      setTables(tableInfos);
    } catch {
      setTables([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (dbType === 'supabase' && supabaseConfig.url) {
      fetchTables();
    }
  }, [dbType, supabaseConfig.url, fetchTables]);

  const fetchTableData = useCallback(async (tableName: string) => {
    const sb = getSupabase();
    if (!sb) return;

    setLoading(true);
    setSelectedTable(tableName);
    try {
      const { data, error } = await sb.from(tableName).select('*').limit(50);
      if (error) {
        toast.error(`${t('databasePanel.failedToFetchData')}: ${error.message}`);
        setTableData([]);
        return;
      }
      setTableData((data as Record<string, unknown>[]) || []);
    } catch {
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Omni DB: Fetch collection data
  const fetchOmniCollectionData = useCallback(async (collectionName: string) => {
    setLoading(true);
    setSelectedTable(collectionName);
    try {
      const res = await omniApiCall('query', { collection: collectionName, limit: 50 });
      setTableData(res.data || []);
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToFetchData'));
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [omniApiCall, t]);

  const handleSaveDb = async () => {
    if (editType === 'omni') {
      // Ensure project exists in Supabase first (auto-create if needed)
      const realProjectId = await ensureProjectInSupabase();
      if (!realProjectId) return; // Error toast already shown

      // Enable Omni DB
      await updateActiveProjectSettings({
        database: {
          type: 'omni',
          firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
          supabase: { url: '', anonKey: '', serviceRoleKey: '' },
          omni: { enabled: true, projectId: realProjectId },
        },
      });

      // Dispatch event for AI auto-configuration (use the REAL project ID)
      window.dispatchEvent(new CustomEvent('database-config-changed', {
        detail: { type: 'omni', config: { enabled: true, projectId: realProjectId } },
      }));

      setEditingDb(false);
      toast.success(t('databasePanel.mojoDbActivated'));

      // Auto-init the DB
      try {
        await omniApiCall('init');
      } catch {}

      // Auto-create _auth collection
      try {
        await omniApiCall('createCollection', {
          collection: '_auth',
          schema: {
            email: { type: 'string', required: true, unique: true },
            password_hash: { type: 'string', required: true },
          },
        });
      } catch {}
      return;
    }

    await updateActiveProjectSettings({
      database: {
        type: editType as 'none' | 'supabase' | 'firebase' | 'omni',
        supabase: editSupabase,
        firebase: editFirebase,
        omni: settings?.database?.omni || { enabled: false, projectId: '' },
      },
    });
    setEditingDb(false);
    toast.success(t('databasePanel.databaseConfigSaved'));
  };

  // Parse schema from various flexible formats
  const parseSchema = (input: string): Record<string, any> | null => {
    const trimmed = input.trim();
    if (!trimmed) return {};

    // 1) Try strict JSON first
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}

    // 2) Try lenient JSON (fix common mistakes: single quotes, unquoted keys, trailing commas)
    try {
      let fixed = trimmed
        .replace(/'/g, '"')                    // single → double quotes
        .replace(/(\w+)\s*:/g, '"$1":')        // unquoted keys → quoted
        .replace(/,\s*([}\]])/g, '$1')         // trailing commas
        .replace(/:\s*"([^"]*?)"\s*([,}])/g, ':"$1"$2'); // fix spacing
      const parsed = JSON.parse(fixed);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {}

    // 3) Try simple format: "name: string, email: string, age: number"
    //    Also handles multi-line: "name: string\nemail: string"
    try {
      const schema: Record<string, any> = {};
      // Split by comma or newline
      const parts = trimmed.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
      for (const part of parts) {
        // Match patterns like: "name: string", "name string", "name: string required", "name: string required unique"
        const match = part.match(/^(\w+)\s*:\s*(\w+)(?:\s+(required|unique|required\s+unique|unique\s+required))?$/i);
        if (match) {
          const fieldName = match[1];
          const fieldType = match[2].toLowerCase();
          const modifiers = (match[3] || '').toLowerCase();

          // Validate type
          const validTypes = ['string', 'number', 'boolean', 'date', 'object', 'array'];
          const resolvedType = validTypes.includes(fieldType) ? fieldType : 'string';

          const fieldDef: Record<string, any> = { type: resolvedType };
          if (modifiers.includes('required')) fieldDef.required = true;
          if (modifiers.includes('unique')) fieldDef.unique = true;

          schema[fieldName] = fieldDef;
        } else {
          // If any part doesn't match the simple format, fail
          return null;
        }
      }
      if (Object.keys(schema).length > 0) {
        return schema;
      }
    } catch {}

    return null;
  };

  // Create collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error(t('databasePanel.collectionNameRequired'));
      return;
    }

    try {
      // Parse schema from flexible format or default to empty
      let schema: Record<string, any> = {};
      if (newCollectionSchema.trim()) {
        const parsed = parseSchema(newCollectionSchema);
        if (parsed === null) {
          toast.error(t('databasePanel.invalidSchema'));
          return;
        }
        schema = parsed;
      }

      await omniApiCall('createCollection', { collection: newCollectionName.trim(), schema });
      toast.success(t('databasePanel.collectionCreated', { name: newCollectionName }));
      setShowCreateCollection(false);
      setNewCollectionName('');
      setNewCollectionSchema('');
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToCreateCollection'));
    }
  };

  // Drop collection
  const handleDropCollection = async (name: string) => {
    if (!confirm(t('databasePanel.confirmDropCollection', { name }))) return;
    try {
      await omniApiCall('dropCollection', { collection: name });
      toast.success(t('databasePanel.collectionDeleted', { name }));
      setSelectedTable(null);
      setTableData([]);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToDeleteCollection'));
    }
  };

  // Insert row
  const handleInsertRow = async () => {
    if (!selectedTable || !newRowData.trim()) return;
    try {
      let data = {};
      try {
        data = JSON.parse(newRowData);
      } catch {
        toast.error(t('databasePanel.invalidRowData'));
        return;
      }
      await omniApiCall('insert', { collection: selectedTable, data });
      toast.success(t('databasePanel.dataInserted'));
      setShowAddRow(false);
      setNewRowData('');
      await fetchOmniCollectionData(selectedTable);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToInsertData'));
    }
  };

  // Delete row
  const handleDeleteRow = async (rowId: string) => {
    if (!selectedTable || !confirm(t('databasePanel.confirmDeleteRow'))) return;
    try {
      await omniApiCall('delete', { collection: selectedTable, rowId });
      toast.success(t('databasePanel.rowDeleted'));
      await fetchOmniCollectionData(selectedTable);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToDeleteRow'));
    }
  };

  // Auth handlers
  const loadAuthUsers = useCallback(async () => {
    try {
      const res = await omniApiCall('authUsers');
      setAuthUsers(res.data || []);
    } catch (err: any) {
      console.error('Failed to load auth users:', err);
    }
  }, [omniApiCall]);

  const handleAuthRegister = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      toast.error(t('databasePanel.emailPasswordRequired'));
      return;
    }
    try {
      await omniApiCall('authRegister', { email: authEmail.trim(), password: authPassword });
      toast.success(t('databasePanel.userRegistered'));
      setAuthEmail('');
      setAuthPassword('');
      await loadAuthUsers();
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToRegister'));
    }
  };

  const handleAuthLogin = async () => {
    if (!authEmail.trim() || !authPassword.trim()) {
      toast.error(t('databasePanel.emailPasswordRequired'));
      return;
    }
    try {
      const res = await omniApiCall('authLogin', { email: authEmail.trim(), password: authPassword });
      toast.success(t('databasePanel.loginSuccess', { userId: res.data?._id?.slice(0, 8) || '' }));
      setAuthEmail('');
      setAuthPassword('');
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.loginFailed'));
    }
  };

  const handleDeleteAuthUser = async (userId: string) => {
    if (!confirm(t('databasePanel.confirmDeleteUser'))) return;
    try {
      await omniApiCall('delete', { collection: '_auth', rowId: userId });
      toast.success(t('databasePanel.userDeleted'));
      await loadAuthUsers();
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || t('databasePanel.failedToDeleteUser'));
    }
  };

  const connected = dbType !== 'none' && (
    dbType === 'supabase' ? !!supabaseConfig.url :
    dbType === 'firebase' ? !!firebaseConfig.apiKey :
    dbType === 'omni' ? true : false
  );

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usedPercent = quota ? Math.min((quota.used_bytes / quota.max_bytes) * 100, 100) : 0;

  return (
    <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          <div className={`text-lg ${dbType === 'omni' ? 'i-ph:cube-duotone text-purple-400' : 'i-ph:database-duotone text-purple-400'}`} />
          <h2 className="text-sm font-semibold text-bolt-elements-textPrimary">{t('workbench.database')}</h2>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {t('databasePanel.connected')}
            </span>
          )}
          {!connected && dbType === 'none' && (
            <span className="text-[10px] font-medium text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 px-2 py-0.5 rounded-full">
              {t('databasePanel.notConfigured')}
            </span>
          )}
        </div>
        <button
          onClick={() => setEditingDb(!editingDb)}
          className={classNames(
            'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
            editingDb
              ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
              : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary border border-bolt-elements-borderColor',
          )}
        >
          <div className="flex items-center gap-1.5">
            <div className={editingDb ? 'i-ph:check-circle' : 'i-ph:gear-six'} />
            {editingDb ? t('databasePanel.done') : t('databasePanel.configure')}
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Edit Database Configuration */}
        {editingDb && (
          <div className="p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-3">
              {t('databasePanel.databaseType')}
            </h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {(['omni', 'supabase', 'firebase', 'none'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setEditType(type)}
                  className={classNames(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                    editType === type
                      ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary',
                  )}
                >
                  <div className={
                    type === 'omni' ? 'i-ph:cube' :
                    type === 'supabase' ? 'i-ph:database' :
                    type === 'firebase' ? 'i-ph:flame' : 'i-ph:prohibit'
                  } />
                  {type === 'omni' ? t('databasePanel.mojoDb') :
                   type === 'none' ? t('appSettings.none') :
                   type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Mojo DB Info */}
            {editType === 'omni' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="i-ph:cube-duotone text-purple-400 text-xl" />
                    <div>
                      <h4 className="text-sm font-bold text-bolt-elements-textPrimary">{t('databasePanel.mojoDb')}</h4>
                      <p className="text-[10px] text-bolt-elements-textTertiary">{t('databasePanel.mojoDbTagline')}</p>
                    </div>
                  </div>
                  <ul className="text-xs text-bolt-elements-textSecondary space-y-1.5 mb-3">
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span>{t('databasePanel.mojoFeatureFreeStorage')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span>{t('databasePanel.mojoFeatureAiConfig')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span>{t('databasePanel.mojoFeatureRestApi')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span>{t('databasePanel.mojoFeatureFlexibleCollections')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span>{t('databasePanel.mojoFeatureNoSetup')}</span>
                    </li>
                  </ul>
                  <div className="text-[10px] text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 rounded-lg p-2">
                    <code className="text-purple-400">POST /api/db</code> — {t('databasePanel.mojoApiCrudDescription')}
                  </div>
                </div>
              </div>
            )}

            {editType === 'supabase' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider mb-1 block">
                    {t('databasePanel.supabaseUrl')}
                  </label>
                  <input
                    type="text"
                    value={editSupabase.url}
                    onChange={(e) => setEditSupabase({ ...editSupabase, url: e.target.value })}
                    placeholder="https://yourproject.supabase.co"
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider mb-1 block">
                    {t('databasePanel.anonKey')}
                  </label>
                  <input
                    type="password"
                    value={editSupabase.anonKey}
                    onChange={(e) => setEditSupabase({ ...editSupabase, anonKey: e.target.value })}
                    placeholder="Your anon key"
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider mb-1 block">
                    {t('databasePanel.serviceRoleKey')}
                  </label>
                  <input
                    type="password"
                    value={editSupabase.serviceRoleKey}
                    onChange={(e) => setEditSupabase({ ...editSupabase, serviceRoleKey: e.target.value })}
                    placeholder="Your service role key (optional)"
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>
              </div>
            )}

            {editType === 'firebase' && (
              <div className="space-y-3">
                {Object.entries(editFirebase).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider mb-1 block">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </label>
                    <input
                      type={key.toLowerCase().includes('key') || key.toLowerCase().includes('id') ? 'password' : 'text'}
                      value={value}
                      onChange={(e) => setEditFirebase({ ...editFirebase, [key]: e.target.value })}
                      placeholder={`Enter ${key}...`}
                      className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                  </div>
                ))}
              </div>
            )}

            {editType !== 'none' && (
              <button
                onClick={handleSaveDb}
                className="mt-4 w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-purple-500/12 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
              >
                <div className="i-ph:floppy-disk text-sm" />
                {editType === 'omni' ? t('databasePanel.activateMojoDb') : t('databasePanel.saveConfiguration')}
              </button>
            )}
            {editType === 'none' && (
              <button
                onClick={handleSaveDb}
                className="mt-4 w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary border border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary transition-all flex items-center justify-center gap-2"
              >
                <div className="i-ph:x text-sm" />
                {t('databasePanel.removeDatabase')}
              </button>
            )}
          </div>
        )}

        {/* Omni DB Content */}
        {connected && !editingDb && dbType === 'omni' && (
          <div className="p-4">
            {/* Quota Bar */}
            {quota && (
              <div className="mb-4 p-3 rounded-xl bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider">{t('databasePanel.storage')}</span>
                  <span className="text-xs text-bolt-elements-textSecondary font-mono">
                    {formatBytes(quota.used_bytes)} / {formatBytes(quota.max_bytes)}
                  </span>
                </div>
                <div className="h-2 bg-bolt-elements-background-depth-2 rounded-full overflow-hidden">
                  <div
                    className={classNames(
                      'h-full rounded-full transition-all duration-500',
                      usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-yellow-500' : 'bg-purple-500',
                    )}
                    style={{ width: `${Math.max(usedPercent, 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-bolt-elements-textTertiary">
                  <span>{t('databasePanel.collectionsCount', { count: quota.collection_count })}</span>
                  <span>{t('databasePanel.recordsCount', { count: quota.row_count })}</span>
                </div>
              </div>
            )}

            {/* Collections Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                {t('databasePanel.collections')}
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-lg"
                >
                  <div className="i-ph:plus text-xs" />
                  {t('common.new')}
                </button>
                <button
                  onClick={loadOmniData}
                  className="text-[10px] text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors flex items-center gap-1"
                >
                  <div className={classNames('i-ph:arrow-clockwise text-xs', loading ? 'animate-spin' : '')} />
                  {t('workbench.refresh')}
                </button>
              </div>
            </div>

            {/* Create Collection Form */}
            {showCreateCollection && (
              <div className="mb-4 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder={t('databasePanel.collectionNamePlaceholder')}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <textarea
                    value={newCollectionSchema}
                    onChange={(e) => setNewCollectionSchema(e.target.value)}
                    placeholder={t('databasePanel.schemaPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30 min-h-[80px] resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCollection}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all"
                    >
                      {t('databasePanel.createCollection')}
                    </button>
                    <button
                      onClick={() => { setShowCreateCollection(false); setNewCollectionName(''); setNewCollectionSchema(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && tables.length === 0 && (
              <div className="flex items-center justify-center py-8 text-bolt-elements-textTertiary text-xs">
                <div className="i-ph:spinner-gap animate-spin text-lg mr-2" />
                {t('databasePanel.loadingCollections')}
              </div>
            )}

            {!loading && tables.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                <div className="i-ph:table text-3xl mb-2 opacity-40" />
                <p className="text-xs">{t('databasePanel.noCollectionsFound')}</p>
                <p className="text-[10px] mt-1">{t('databasePanel.createCollectionHint')}</p>
              </div>
            )}

            {/* Auth collection - special entry */}
            {tables.some(t => t.name === '_auth') && (
              <div
                className={classNames(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all group cursor-pointer mb-1',
                  showAuthPanel
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                )}
                onClick={() => { setShowAuthPanel(!showAuthPanel); if (!showAuthPanel) loadAuthUsers(); }}
              >
                <div className="i-ph:shield-check text-sm shrink-0 text-blue-400" />
                <span className="font-mono font-medium">Auth</span>
                <span className="text-[10px] text-bolt-elements-textTertiary shrink-0">
                  {authUsers.length > 0 ? authUsers.length : tables.find(t => t.name === '_auth')?.rowCount || 0}
                </span>
                <div className="i-ph:caret-right text-xs ml-auto transition-transform" style={{ transform: showAuthPanel ? 'rotate(90deg)' : '' }} />
              </div>
            )}

            {/* Auth Panel */}
            {showAuthPanel && (
              <div className="mb-3 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                <div className="flex items-center gap-2 mb-4">
                  <div className="i-ph:shield-check text-lg text-blue-400" />
                  <h3 className="text-sm font-bold text-bolt-elements-textPrimary">Auth</h3>
                  <span className="text-[10px] text-bolt-elements-textTertiary">{t('databasePanel.userAuthentication')}</span>
                </div>

                {/* Register/Login Form */}
                <div className="space-y-2 mb-4">
                  <div className="flex gap-2 mb-2">
                    <button
                      onClick={() => setAuthMode('register')}
                      className={classNames(
                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                        authMode === 'register' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
                      )}
                    >
                      {t('databasePanel.register')}
                    </button>
                    <button
                      onClick={() => setAuthMode('login')}
                      className={classNames(
                        'text-xs px-3 py-1.5 rounded-lg font-medium transition-all',
                        authMode === 'login' ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary'
                      )}
                    >
                      {t('databasePanel.login')}
                    </button>
                  </div>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder={t('databasePanel.emailPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={t('databasePanel.passwordPlaceholder')}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                  <button
                    onClick={authMode === 'register' ? handleAuthRegister : handleAuthLogin}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-all"
                  >
                    {authMode === 'register' ? t('databasePanel.registerUser') : t('databasePanel.testLogin')}
                  </button>
                </div>

                {/* Users List */}
                <div>
                  <h4 className="text-[10px] font-semibold text-bolt-elements-textTertiary uppercase tracking-wider mb-2">
                    {t('databasePanel.registeredUsers', { count: authUsers.length })}
                  </h4>
                  {authUsers.length === 0 ? (
                    <p className="text-[10px] text-bolt-elements-textTertiary text-center py-4">{t('databasePanel.noRegisteredUsers')}</p>
                  ) : (
                    <div className="space-y-1">
                      {authUsers.map((u) => (
                        <div key={u._id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-xs group">
                          <div className="i-ph:user-circle text-blue-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-bolt-elements-textPrimary truncate">{u.email}</div>
                            <div className="text-[9px] text-bolt-elements-textTertiary">
                              {t('databasePanel.userMeta', { id: u._id.slice(0, 8), date: new Date(u._createdAt).toLocaleDateString('en-US') })}
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteAuthUser(u._id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all shrink-0"
                            title={t('databasePanel.deleteUser')}
                          >
                            <div className="i-ph:trash text-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tables.length > 0 && (
              <div className="space-y-1">
                {tables.filter(t => t.name !== '_auth').map((table) => (
                  <div
                    key={table.name}
                    className={classNames(
                      'flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all group',
                      selectedTable === table.name
                        ? 'bg-purple-500/15 text-purple-400'
                        : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary',
                    )}
                  >
                    <button
                      onClick={() => fetchOmniCollectionData(table.name)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <div className="i-ph:table text-sm shrink-0" />
                      <span className="font-mono font-medium truncate">{table.name}</span>
                      <span className="text-[10px] text-bolt-elements-textTertiary shrink-0">{table.rowCount}</span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDropCollection(table.name); }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all shrink-0"
                      title={t('databasePanel.deleteCollection')}
                    >
                      <div className="i-ph:trash text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Collection Data View */}
            {selectedTable && tableData.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                    {selectedTable}
                  </h3>
                  <button
                    onClick={() => setShowAddRow(true)}
                    className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-lg"
                  >
                    <div className="i-ph:plus text-xs" />
                    {t('databasePanel.add')}
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-bolt-elements-borderColor">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-bolt-elements-background-depth-1">
                        {Object.keys(tableData[0]).map((key) => (
                          <th key={key} className="px-3 py-2 text-left font-mono font-semibold text-bolt-elements-textTertiary whitespace-nowrap">
                            {key}
                          </th>
                        ))}
                        <th className="px-2 py-2 w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row, i) => (
                        <tr key={i} className="border-t border-bolt-elements-borderColor/50">
                          {Object.entries(row).map(([key, val], j) => (
                            <td key={j} className="px-3 py-1.5 font-mono text-bolt-elements-textSecondary whitespace-nowrap max-w-[200px] truncate">
                              {key === '_id' ? (
                                <span className="text-purple-400 text-[10px]">{String(val).slice(0, 8)}...</span>
                              ) : val === null ? (
                                <span className="text-bolt-elements-textTertiary italic">null</span>
                              ) : typeof val === 'object' ? (
                                <span className="text-purple-400">{JSON.stringify(val).slice(0, 50)}</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <button
                              onClick={() => handleDeleteRow((row as any)._id)}
                              className="text-red-400/50 hover:text-red-400 transition-colors"
                              title={t('databasePanel.deleteRecord')}
                            >
                              <div className="i-ph:trash text-xs" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Add Row Form */}
            {showAddRow && selectedTable && (
              <div className="mt-4 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <h4 className="text-xs font-semibold text-purple-400 mb-2">{t('databasePanel.addRecordTo', { collection: selectedTable })}</h4>
                <textarea
                  value={newRowData}
                  onChange={(e) => setNewRowData(e.target.value)}
                  placeholder={t('databasePanel.rowDataPlaceholder')}
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30 min-h-[80px] resize-y"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleInsertRow}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all"
                  >
                    {t('databasePanel.insert')}
                  </button>
                  <button
                    onClick={() => { setShowAddRow(false); setNewRowData(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            )}

            {selectedTable && tableData.length === 0 && !loading && (
              <div className="mt-4 text-center text-bolt-elements-textTertiary text-xs py-4">
                <div className="i-ph:empty text-2xl mb-1 opacity-40 mx-auto" />
                {t('databasePanel.emptyCollection')}
              </div>
            )}
          </div>
        )}

        {/* Supabase/Firebase Content (existing) */}
        {connected && !editingDb && dbType === 'supabase' && (
          <div className="p-4">
            <>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                  {t('databasePanel.tables')}
                </h3>
                <button
                  onClick={fetchTables}
                  className="text-[10px] text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors flex items-center gap-1"
                >
                  <div className={classNames('i-ph:arrow-clockwise text-xs', loading ? 'animate-spin' : '')} />
                  {t('workbench.refresh')}
                </button>
              </div>

              {loading && tables.length === 0 && (
                <div className="flex items-center justify-center py-8 text-bolt-elements-textTertiary text-xs">
                  <div className="i-ph:spinner-gap animate-spin text-lg mr-2" />
                  {t('databasePanel.loadingTables')}
                </div>
              )}

              {!loading && tables.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                  <div className="i-ph:table text-3xl mb-2 opacity-40" />
                  <p className="text-xs">{t('databasePanel.noTablesFound')}</p>
                  <p className="text-[10px] mt-1">{t('databasePanel.createTablesInDashboard')}</p>
                </div>
              )}

              {tables.length > 0 && (
                <div className="space-y-1">
                  {tables.map((table) => (
                    <button
                      key={table.name}
                      onClick={() => fetchTableData(table.name)}
                      className={classNames(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all',
                        selectedTable === table.name
                          ? 'bg-purple-500/15 text-purple-400'
                          : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-1/80',
                      )}
                    >
                      <div className="i-ph:table text-sm" />
                      <span className="font-mono font-medium">{table.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {selectedTable && tableData.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                    {selectedTable} <span className="text-bolt-elements-textTertiary font-normal">({tableData.length} {t('databasePanel.rows')})</span>
                  </h3>
                  <div className="overflow-x-auto rounded-lg border border-bolt-elements-borderColor">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-bolt-elements-background-depth-1">
                          {Object.keys(tableData[0]).map((key) => (
                            <th key={key} className="px-3 py-2 text-left font-mono font-semibold text-bolt-elements-textTertiary whitespace-nowrap">
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => (
                          <tr key={i} className="border-t border-bolt-elements-borderColor/50">
                            {Object.values(row).map((val, j) => (
                              <td key={j} className="px-3 py-1.5 font-mono text-bolt-elements-textSecondary whitespace-nowrap max-w-[200px] truncate">
                                {val === null ? (
                                  <span className="text-bolt-elements-textTertiary italic">null</span>
                                ) : typeof val === 'object' ? (
                                  <span className="text-purple-400">{JSON.stringify(val).slice(0, 50)}</span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedTable && tableData.length === 0 && !loading && (
                <div className="mt-4 text-center text-bolt-elements-textTertiary text-xs py-4">
                  <div className="i-ph:empty text-2xl mb-1 opacity-40 mx-auto" />
                  {t('databasePanel.tableIsEmpty')}
                </div>
              )}
            </>
          </div>
        )}

        {connected && !editingDb && dbType === 'firebase' && (
          <div className="p-4">
            <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
              <div className="i-ph:flame text-3xl mb-2 text-orange-400/60" />
              <p className="text-xs">{t('databasePanel.firebaseConnected')}</p>
              <p className="text-[10px] mt-1">{t('databasePanel.useFirebaseConsole')}</p>
              {firebaseConfig.projectId && (
                <a
                  href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <div className="i-ph:arrow-square-out" />
                  {t('databasePanel.openFirebaseConsole')}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Not Connected State */}
        {!connected && !editingDb && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-bolt-elements-textTertiary">
            <div className="relative mb-6">
              <div className="i-ph:database text-5xl opacity-30" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor flex items-center justify-center">
                <div className="i-ph:plus text-xs" />
              </div>
            </div>
            <p className="text-sm font-medium text-bolt-elements-textSecondary mb-1">{t('databasePanel.noDatabaseConnected')}</p>
            <p className="text-xs text-bolt-elements-textTertiary mb-4 max-w-[260px] text-center">
              {t('databasePanel.connectDatabaseMessage')}
            </p>
            <button
              onClick={() => setEditingDb(true)}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-purple-500/12 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-2"
            >
              <div className="i-ph:plug text-sm" />
              {t('databasePanel.connectDatabase')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

DatabasePanel.displayName = 'DatabasePanel';
