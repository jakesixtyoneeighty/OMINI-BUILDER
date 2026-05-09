import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getSupabase } from '~/lib/supabase';
import { authStore } from '~/lib/stores/auth';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings } from '~/lib/stores/project';
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

  // Local form state for editing
  const [editType, setEditType] = useState(dbType);
  const [editSupabase, setEditSupabase] = useState(supabaseConfig);
  const [editFirebase, setEditFirebase] = useState(firebaseConfig);

  useEffect(() => {
    setEditType(dbType);
    setEditSupabase(supabaseConfig);
    setEditFirebase(firebaseConfig);
  }, [dbType, supabaseConfig.url, supabaseConfig.anonKey, firebaseConfig.apiKey]);

  // Omni DB API calls
  const omniApiCall = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const res = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, projectId: activeId, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API call failed');
    return data;
  }, [activeId]);

  // Load Omni DB collections and quota
  const loadOmniData = useCallback(async () => {
    if (!activeId || activeId === 'default') return;
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
  }, [omniApiCall, activeId]);

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
  }, []);

  // Omni DB: Fetch collection data
  const fetchOmniCollectionData = useCallback(async (collectionName: string) => {
    setLoading(true);
    setSelectedTable(collectionName);
    try {
      const res = await omniApiCall('query', { collection: collectionName, limit: 50 });
      setTableData(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch data');
      setTableData([]);
    } finally {
      setLoading(false);
    }
  }, [omniApiCall]);

  const handleSaveDb = async () => {
    if (editType === 'omni') {
      // Enable Omni DB
      await updateActiveProjectSettings({
        database: {
          type: 'omni',
          firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '' },
          supabase: { url: '', anonKey: '', serviceRoleKey: '' },
          omni: { enabled: true, projectId: activeId },
        },
      });

      // Dispatch event for AI auto-configuration
      window.dispatchEvent(new CustomEvent('database-config-changed', {
        detail: { type: 'omni', config: { enabled: true, projectId: activeId } },
      }));

      setEditingDb(false);
      toast.success('Omni DB ativado! A IA vai configurar tudo automaticamente.');

      // Auto-init the DB
      try {
        await omniApiCall('init');
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

  // Create collection
  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('Nome da coleção é obrigatório');
      return;
    }

    try {
      // Parse schema from JSON or default to empty
      let schema: Record<string, any> = {};
      if (newCollectionSchema.trim()) {
        try {
          schema = JSON.parse(newCollectionSchema);
        } catch {
          toast.error('Schema inválido. Use formato JSON: {"campo": {"type": "string", "required": true}}');
          return;
        }
      }

      await omniApiCall('createCollection', { collection: newCollectionName.trim(), schema });
      toast.success(`Coleção "${newCollectionName}" criada!`);
      setShowCreateCollection(false);
      setNewCollectionName('');
      setNewCollectionSchema('');
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar coleção');
    }
  };

  // Drop collection
  const handleDropCollection = async (name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a coleção "${name}" e todos os seus dados?`)) return;
    try {
      await omniApiCall('dropCollection', { collection: name });
      toast.success(`Coleção "${name}" excluída`);
      setSelectedTable(null);
      setTableData([]);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir coleção');
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
        toast.error('Dados inválidos. Use formato JSON: {"campo": "valor"}');
        return;
      }
      await omniApiCall('insert', { collection: selectedTable, data });
      toast.success('Dados inseridos!');
      setShowAddRow(false);
      setNewRowData('');
      await fetchOmniCollectionData(selectedTable);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao inserir dados');
    }
  };

  // Delete row
  const handleDeleteRow = async (rowId: string) => {
    if (!selectedTable || !confirm('Excluir este registro?')) return;
    try {
      await omniApiCall('delete', { collection: selectedTable, rowId });
      toast.success('Registro excluído');
      await fetchOmniCollectionData(selectedTable);
      await loadOmniData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir registro');
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
                  {type === 'omni' ? 'Omni DB' :
                   type === 'none' ? t('appSettings.none') :
                   type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Omni DB Info */}
            {editType === 'omni' && (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="i-ph:cube-duotone text-purple-400 text-xl" />
                    <div>
                      <h4 className="text-sm font-bold text-bolt-elements-textPrimary">Omni DB</h4>
                      <p className="text-[10px] text-bolt-elements-textTertiary">Banco de dados integrado do Omni Builder</p>
                    </div>
                  </div>
                  <ul className="text-xs text-bolt-elements-textSecondary space-y-1.5 mb-3">
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span><b>100 MB grátis</b> por aplicativo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span><b>IA configura tudo</b> automaticamente</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span><b>API REST</b> pronta para usar</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span><b>Coleções flexíveis</b> com schema definido</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="i-ph:check-circle text-emerald-400 mt-0.5 shrink-0" />
                      <span><b>Sem configuração</b> necessária - já está pronto!</span>
                    </li>
                  </ul>
                  <div className="text-[10px] text-bolt-elements-textTertiary bg-bolt-elements-background-depth-2 rounded-lg p-2">
                    <code className="text-purple-400">POST /api/db</code> — API completa de CRUD
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
                {editType === 'omni' ? 'Ativar Omni DB' : t('databasePanel.saveConfiguration')}
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
                  <span className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider">Armazenamento</span>
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
                  <span>{quota.collection_count} coleções</span>
                  <span>{quota.row_count} registros</span>
                </div>
              </div>
            )}

            {/* Collections Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                Coleções
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateCollection(true)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 bg-purple-500/10 px-2 py-1 rounded-lg"
                >
                  <div className="i-ph:plus text-xs" />
                  Nova
                </button>
                <button
                  onClick={loadOmniData}
                  className="text-[10px] text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors flex items-center gap-1"
                >
                  <div className={classNames('i-ph:arrow-clockwise text-xs', loading && 'animate-spin')} />
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
                    placeholder="Nome da coleção (ex: users, products)"
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                  <textarea
                    value={newCollectionSchema}
                    onChange={(e) => setNewCollectionSchema(e.target.value)}
                    placeholder='Schema JSON (opcional): {"name": {"type": "string", "required": true}, "email": {"type": "string", "required": true, "unique": true}}'
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30 min-h-[80px] resize-y"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateCollection}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all"
                    >
                      Criar Coleção
                    </button>
                    <button
                      onClick={() => { setShowCreateCollection(false); setNewCollectionName(''); setNewCollectionSchema(''); }}
                      className="px-3 py-1.5 rounded-lg text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {loading && tables.length === 0 && (
              <div className="flex items-center justify-center py-8 text-bolt-elements-textTertiary text-xs">
                <div className="i-ph:spinner-gap animate-spin text-lg mr-2" />
                Carregando coleções...
              </div>
            )}

            {!loading && tables.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                <div className="i-ph:table text-3xl mb-2 opacity-40" />
                <p className="text-xs">Nenhuma coleção encontrada</p>
                <p className="text-[10px] mt-1">Crie uma coleção ou peça para a IA criar!</p>
              </div>
            )}

            {tables.length > 0 && (
              <div className="space-y-1">
                {tables.map((table) => (
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
                      title="Excluir coleção"
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
                    Adicionar
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
                              title="Excluir registro"
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
                <h4 className="text-xs font-semibold text-purple-400 mb-2">Adicionar registro em {selectedTable}</h4>
                <textarea
                  value={newRowData}
                  onChange={(e) => setNewRowData(e.target.value)}
                  placeholder='{"campo1": "valor1", "campo2": 123}'
                  className="w-full px-3 py-2 rounded-lg text-xs font-mono bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500/30 min-h-[80px] resize-y"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleInsertRow}
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-500/15 text-purple-400 hover:bg-purple-500/25 transition-all"
                  >
                    Inserir
                  </button>
                  <button
                    onClick={() => { setShowAddRow(false); setNewRowData(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {selectedTable && tableData.length === 0 && !loading && (
              <div className="mt-4 text-center text-bolt-elements-textTertiary text-xs py-4">
                <div className="i-ph:empty text-2xl mb-1 opacity-40 mx-auto" />
                Coleção vazia. Adicione dados ou peça para a IA criar!
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
                  <div className={classNames('i-ph:arrow-clockwise text-xs', loading && 'animate-spin')} />
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
