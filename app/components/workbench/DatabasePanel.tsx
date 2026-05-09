import { useStore } from '@nanostores/react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { getSupabase } from '~/lib/supabase';
import { authStore } from '~/lib/stores/auth';
import { activeProjectIdStore, projectsStore, updateActiveProjectSettings } from '~/lib/stores/project';
import { classNames } from '~/utils/classNames';

interface TableInfo {
  name: string;
  rowCount: number;
  columns: { name: string; type: string; nullable: boolean }[];
}

export const DatabasePanel = memo(() => {
  const activeId = useStore(activeProjectIdStore);
  const projects = useStore(projectsStore);
  const { user } = useStore(authStore);
  const settings = projects[activeId]?.settings;

  const dbType = settings?.database?.type || 'none';
  const supabaseConfig = settings?.database?.supabase || { url: '', anonKey: '', serviceRoleKey: '' };
  const firebaseConfig = settings?.database?.firebase || {
    apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', measurementId: '',
  };

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [editingDb, setEditingDb] = useState(false);

  // Local form state for editing
  const [editType, setEditType] = useState(dbType);
  const [editSupabase, setEditSupabase] = useState(supabaseConfig);
  const [editFirebase, setEditFirebase] = useState(firebaseConfig);

  useEffect(() => {
    setEditType(dbType);
    setEditSupabase(supabaseConfig);
    setEditFirebase(firebaseConfig);
  }, [dbType, supabaseConfig.url, supabaseConfig.anonKey, firebaseConfig.apiKey]);

  const fetchTables = useCallback(async () => {
    const sb = getSupabase();
    if (!sb || !user) return;

    setLoading(true);
    try {
      // Query Supabase information_schema to get table info
      const { data, error } = await sb
        .from('information_schema_tables' as never)
        .select('table_name')
        .eq('table_schema', 'public');

      if (error || !data) {
        // Fallback: try to use RPC or just show a message
        setTables([]);
        return;
      }

      const tableNames = (data as { table_name: string }[]).map((t) => t.table_name);
      const tableInfos: TableInfo[] = tableNames.map((name) => ({
        name,
        rowCount: 0,
        columns: [],
      }));
      setTables(tableInfos);
    } catch {
      // If information_schema isn't accessible via the client, just show empty
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
        toast.error(`Failed to fetch data: ${error.message}`);
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

  const handleSaveDb = async () => {
    await updateActiveProjectSettings({
      database: {
        type: editType as 'none' | 'supabase' | 'firebase',
        supabase: editSupabase,
        firebase: editFirebase,
      },
    });
    setEditingDb(false);
    toast.success('Database configuration saved!');
  };

  const connected = dbType !== 'none' && (dbType === 'supabase' ? !!supabaseConfig.url : !!firebaseConfig.apiKey);

  return (
    <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          <div className="i-ph:database-duotone text-lg text-purple-400" />
          <h2 className="text-sm font-semibold text-bolt-elements-textPrimary">Database</h2>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
          {!connected && dbType === 'none' && (
            <span className="text-[10px] font-medium text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 px-2 py-0.5 rounded-full">
              Not configured
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
            {editingDb ? 'Done' : 'Configure'}
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Edit Database Configuration */}
        {editingDb && (
          <div className="p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-3">
              Database Type
            </h3>
            <div className="flex gap-2 mb-4">
              {(['none', 'supabase', 'firebase'] as const).map((type) => (
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
                  <div className={type === 'supabase' ? 'i-ph:database' : type === 'firebase' ? 'i-ph:flame' : 'i-ph:prohibit'} />
                  {type === 'none' ? 'None' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {editType === 'supabase' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-medium text-bolt-elements-textTertiary uppercase tracking-wider mb-1 block">
                    Supabase URL
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
                    Anon Key
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
                    Service Role Key
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
                Save Configuration
              </button>
            )}
            {editType === 'none' && (
              <button
                onClick={handleSaveDb}
                className="mt-4 w-full px-4 py-2.5 rounded-lg text-xs font-semibold bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary border border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary transition-all flex items-center justify-center gap-2"
              >
                <div className="i-ph:x text-sm" />
                Remove Database
              </button>
            )}
          </div>
        )}

        {/* Database Content - Tables & Data */}
        {connected && !editingDb && (
          <div className="p-4">
            {dbType === 'supabase' && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider">
                    Tables
                  </h3>
                  <button
                    onClick={fetchTables}
                    className="text-[10px] text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors flex items-center gap-1"
                  >
                    <div className={classNames('i-ph:arrow-clockwise text-xs', loading && 'animate-spin')} />
                    Refresh
                  </button>
                </div>

                {loading && tables.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-bolt-elements-textTertiary text-xs">
                    <div className="i-ph:spinner-gap animate-spin text-lg mr-2" />
                    Loading tables...
                  </div>
                )}

                {!loading && tables.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                    <div className="i-ph:table text-3xl mb-2 opacity-40" />
                    <p className="text-xs">No tables found</p>
                    <p className="text-[10px] mt-1">Create tables in your Supabase dashboard</p>
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

                {/* Table Data Preview */}
                {selectedTable && tableData.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-bolt-elements-textSecondary uppercase tracking-wider mb-2">
                      {selectedTable} <span className="text-bolt-elements-textTertiary font-normal">({tableData.length} rows)</span>
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
                    Table is empty
                  </div>
                )}
              </>
            )}

            {dbType === 'firebase' && (
              <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
                <div className="i-ph:flame text-3xl mb-2 text-orange-400/60" />
                <p className="text-xs">Firebase connected</p>
                <p className="text-[10px] mt-1">Use the Firebase console to manage your data</p>
                {firebaseConfig.projectId && (
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 text-[10px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                  >
                    <div className="i-ph:arrow-square-out" />
                    Open Firebase Console
                  </a>
                )}
              </div>
            )}
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
            <p className="text-sm font-medium text-bolt-elements-textSecondary mb-1">No database connected</p>
            <p className="text-xs text-bolt-elements-textTertiary mb-4 max-w-[260px] text-center">
              Connect a Supabase or Firebase database to view and manage your data
            </p>
            <button
              onClick={() => setEditingDb(true)}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-purple-500/12 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-2"
            >
              <div className="i-ph:plug text-sm" />
              Connect Database
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

DatabasePanel.displayName = 'DatabasePanel';
