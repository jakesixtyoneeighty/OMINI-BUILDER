import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { createClient } from '@supabase/supabase-js';

const MAX_BYTES_PER_PROJECT = 104857600; // 100MB
const MAX_ROWS_PER_QUERY = 100;
const MAX_ROW_SIZE_BYTES = 1024 * 1024; // 1MB per row

function getServerSupabase(context: any) {
  const env = context?.cloudflare?.env;
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface DbAction {
  action: 'init' | 'stats' | 'collections' | 'createCollection' | 'dropCollection' | 'getSchema' | 'query' | 'insert' | 'update' | 'delete' | 'count';
  projectId: string;
  collection?: string;
  schema?: Record<string, { type: string; required?: boolean; unique?: boolean; default?: any }>;
  data?: Record<string, any>;
  rowId?: string;
  where?: Record<string, any>;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  select?: string[];
}

export async function action(args: ActionFunctionArgs) {
  return dbAction(args);
}

async function dbAction({ context, request }: ActionFunctionArgs) {
  // CORS headers for cross-origin requests from WebContainer
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const sb = getServerSupabase(context);

  let body: DbAction;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const { action, projectId, collection, schema, data, rowId, where, orderBy, orderDir, limit, offset, select } = body;

  if (!projectId || !action) {
    return json({ error: 'Missing required fields: projectId, action' }, { status: 400, headers: corsHeaders });
  }

  try {
    switch (action) {
      case 'init': {
        // Initialize DB for a project - create quota record
        const { data: existingQuota } = await sb
          .from('app_db_quota')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (existingQuota) {
          return json({ success: true, quota: existingQuota }, { headers: corsHeaders });
        }

        const { data: newQuota, error: quotaError } = await sb
          .from('app_db_quota')
          .insert({
            project_id: projectId,
            used_bytes: 0,
            max_bytes: MAX_BYTES_PER_PROJECT,
            row_count: 0,
            collection_count: 0,
          })
          .select()
          .single();

        if (quotaError) {
          return json({ error: `Failed to initialize DB: ${quotaError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({ success: true, quota: newQuota }, { headers: corsHeaders });
      }

      case 'stats': {
        const { data: quota, error } = await sb
          .from('app_db_quota')
          .select('*')
          .eq('project_id', projectId)
          .single();

        if (error || !quota) {
          // Auto-init if not exists
          const { data: newQuota } = await sb
            .from('app_db_quota')
            .insert({
              project_id: projectId,
              used_bytes: 0,
              max_bytes: MAX_BYTES_PER_PROJECT,
              row_count: 0,
              collection_count: 0,
            })
            .select()
            .single();
          return json({ quota: newQuota || { used_bytes: 0, max_bytes: MAX_BYTES_PER_PROJECT, row_count: 0, collection_count: 0 } }, { headers: corsHeaders });
        }

        return json({ quota }, { headers: corsHeaders });
      }

      case 'collections': {
        const { data: schemas, error } = await sb
          .from('app_db_schemas')
          .select('collection_name, schema_def, created_at, updated_at')
          .eq('project_id', projectId)
          .order('collection_name');

        if (error) {
          return json({ error: `Failed to fetch collections: ${error.message}` }, { status: 500, headers: corsHeaders });
        }

        // Also get row counts per collection
        const collectionStats = [];
        for (const s of schemas || []) {
          const { count } = await sb
            .from('app_db_data')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('collection_name', s.collection_name);

          collectionStats.push({
            name: s.collection_name,
            schema: s.schema_def,
            rowCount: count || 0,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
          });
        }

        return json({ collections: collectionStats }, { headers: corsHeaders });
      }

      case 'createCollection': {
        if (!collection || !schema) {
          return json({ error: 'Missing collection name or schema' }, { status: 400, headers: corsHeaders });
        }

        // Validate collection name (alphanumeric + underscore only)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(collection)) {
          return json({ error: 'Invalid collection name. Use only letters, numbers, and underscores. Must start with a letter or underscore.' }, { status: 400, headers: corsHeaders });
        }

        // Check if collection already exists
        const { data: existing } = await sb
          .from('app_db_schemas')
          .select('id')
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .single();

        if (existing) {
          return json({ error: `Collection "${collection}" already exists` }, { status: 409, headers: corsHeaders });
        }

        // Add system fields to schema
        const fullSchema = {
          _id: { type: 'string', required: true, unique: true },
          _createdAt: { type: 'string', required: true },
          _updatedAt: { type: 'string', required: true },
          ...schema,
        };

        const { data: newSchema, error: schemaError } = await sb
          .from('app_db_schemas')
          .insert({
            project_id: projectId,
            collection_name: collection,
            schema_def: fullSchema,
          })
          .select()
          .single();

        if (schemaError) {
          return json({ error: `Failed to create collection: ${schemaError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({ success: true, collection: { name: collection, schema: fullSchema } }, { headers: corsHeaders });
      }

      case 'dropCollection': {
        if (!collection) {
          return json({ error: 'Missing collection name' }, { status: 400, headers: corsHeaders });
        }

        // Delete all data in the collection
        await sb
          .from('app_db_data')
          .delete()
          .eq('project_id', projectId)
          .eq('collection_name', collection);

        // Delete the schema
        const { error: dropError } = await sb
          .from('app_db_schemas')
          .delete()
          .eq('project_id', projectId)
          .eq('collection_name', collection);

        if (dropError) {
          return json({ error: `Failed to drop collection: ${dropError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({ success: true }, { headers: corsHeaders });
      }

      case 'getSchema': {
        if (!collection) {
          return json({ error: 'Missing collection name' }, { status: 400, headers: corsHeaders });
        }

        const { data: schemaData, error } = await sb
          .from('app_db_schemas')
          .select('schema_def, created_at, updated_at')
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .single();

        if (error || !schemaData) {
          return json({ error: `Collection "${collection}" not found` }, { status: 404, headers: corsHeaders });
        }

        return json({ schema: schemaData.schema_def, createdAt: schemaData.created_at, updatedAt: schemaData.updated_at }, { headers: corsHeaders });
      }

      case 'query': {
        if (!collection) {
          return json({ error: 'Missing collection name' }, { status: 400, headers: corsHeaders });
        }

        const queryLimit = Math.min(limit || MAX_ROWS_PER_QUERY, MAX_ROWS_PER_QUERY);
        const queryOffset = offset || 0;

        let query = sb
          .from('app_db_data')
          .select(select && select.length > 0 ? `data->>${select.join(',')},row_id,data,created_at,updated_at` : 'row_id,data,created_at,updated_at', { count: 'exact' })
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .range(queryOffset, queryOffset + queryLimit - 1);

        // Apply where filters
        if (where) {
          for (const [key, value] of Object.entries(where)) {
            if (key === '_id') {
              query = query.eq('row_id', String(value));
            } else if (typeof value === 'object' && value !== null) {
              // Advanced filters
              const filter = value as any;
              if (filter.eq !== undefined) query = query.eq(`data->>${key}`, String(filter.eq));
              else if (filter.neq !== undefined) query = query.neq(`data->>${key}`, String(filter.neq));
              else if (filter.gt !== undefined) query = query.gt(`data->>${key}`, String(filter.gt));
              else if (filter.gte !== undefined) query = query.gte(`data->>${key}`, String(filter.gte));
              else if (filter.lt !== undefined) query = query.lt(`data->>${key}`, String(filter.lt));
              else if (filter.lte !== undefined) query = query.lte(`data->>${key}`, String(filter.lte));
              else if (filter.like !== undefined) query = query.like(`data->>${key}`, String(filter.like));
              else if (filter.ilike !== undefined) query = query.ilike(`data->>${key}`, String(filter.ilike));
              else if (filter.in !== undefined && Array.isArray(filter.in)) query = query.in(`data->>${key}`, filter.in.map(String));
              else if (filter.is !== undefined) query = query.is(`data->>${key}`, filter.is);
            } else {
              // Simple equality filter
              query = query.eq(`data->>${key}`, String(value));
            }
          }
        }

        // Apply ordering
        if (orderBy) {
          const dir = orderDir === 'desc' ? false : true;
          if (orderBy === '_id') {
            query = query.order('row_id', { ascending: dir });
          } else if (orderBy === '_createdAt') {
            query = query.order('created_at', { ascending: dir });
          } else if (orderBy === '_updatedAt') {
            query = query.order('updated_at', { ascending: dir });
          } else {
            query = query.order(`data->>${orderBy}`, { ascending: dir });
          }
        } else {
          query = query.order('created_at', { ascending: false });
        }

        const { data: rows, count, error } = await query;

        if (error) {
          return json({ error: `Query failed: ${error.message}` }, { status: 500, headers: corsHeaders });
        }

        // Format response - merge row metadata into data
        const formattedRows = (rows || []).map((row: any) => ({
          _id: row.row_id,
          _createdAt: row.created_at,
          _updatedAt: row.updated_at,
          ...(row.data || {}),
        }));

        return json({
          data: formattedRows,
          count: count || 0,
          limit: queryLimit,
          offset: queryOffset,
        }, { headers: corsHeaders });
      }

      case 'count': {
        if (!collection) {
          return json({ error: 'Missing collection name' }, { status: 400, headers: corsHeaders });
        }

        let query = sb
          .from('app_db_data')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId)
          .eq('collection_name', collection);

        // Apply where filters
        if (where) {
          for (const [key, value] of Object.entries(where)) {
            if (typeof value === 'object' && value !== null) {
              const filter = value as any;
              if (filter.eq !== undefined) query = query.eq(`data->>${key}`, String(filter.eq));
              else if (filter.neq !== undefined) query = query.neq(`data->>${key}`, String(filter.neq));
              else if (filter.gt !== undefined) query = query.gt(`data->>${key}`, String(filter.gt));
              else if (filter.lt !== undefined) query = query.lt(`data->>${key}`, String(filter.lt));
              else if (filter.like !== undefined) query = query.like(`data->>${key}`, String(filter.like));
              else if (filter.ilike !== undefined) query = query.ilike(`data->>${key}`, String(filter.ilike));
            } else {
              query = query.eq(`data->>${key}`, String(value));
            }
          }
        }

        const { count, error } = await query;

        if (error) {
          return json({ error: `Count failed: ${error.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({ count: count || 0 }, { headers: corsHeaders });
      }

      case 'insert': {
        if (!collection || !data) {
          return json({ error: 'Missing collection name or data' }, { status: 400, headers: corsHeaders });
        }

        // Check quota
        const { data: quota } = await sb
          .from('app_db_quota')
          .select('used_bytes, max_bytes')
          .eq('project_id', projectId)
          .single();

        if (quota && quota.used_bytes >= quota.max_bytes) {
          return json({ error: 'Storage quota exceeded (100MB limit). Please delete some data or upgrade your plan.' }, { status: 413, headers: corsHeaders });
        }

        // Check row size
        const dataSize = JSON.stringify(data).length;
        if (dataSize > MAX_ROW_SIZE_BYTES) {
          return json({ error: `Row data too large (${(dataSize / 1024).toFixed(1)}KB). Maximum is 1MB per row.` }, { status: 413, headers: corsHeaders });
        }

        // Verify collection exists
        const { data: schemaData } = await sb
          .from('app_db_schemas')
          .select('schema_def')
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .single();

        if (!schemaData) {
          return json({ error: `Collection "${collection}" does not exist. Create it first.` }, { status: 404, headers: corsHeaders });
        }

        // Validate data against schema
        const schemaDef = schemaData.schema_def as Record<string, any>;
        const errors: string[] = [];
        for (const [field, def] of Object.entries(schemaDef)) {
          if (field.startsWith('_')) continue; // Skip system fields
          if (def.required && (data[field] === undefined || data[field] === null || data[field] === '')) {
            errors.push(`Field "${field}" is required`);
          }
        }
        if (errors.length > 0) {
          return json({ error: `Validation failed: ${errors.join('; ')}` }, { status: 400, headers: corsHeaders });
        }

        // Generate row ID
        const newRowId = crypto.randomUUID();
        const now = new Date().toISOString();

        const { data: inserted, error: insertError } = await sb
          .from('app_db_data')
          .insert({
            project_id: projectId,
            collection_name: collection,
            row_id: newRowId,
            data,
          })
          .select('row_id,data,created_at,updated_at')
          .single();

        if (insertError) {
          return json({ error: `Insert failed: ${insertError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({
          data: {
            _id: inserted.row_id,
            _createdAt: inserted.created_at,
            _updatedAt: inserted.updated_at,
            ...(inserted.data as Record<string, any>),
          },
        }, { headers: corsHeaders });
      }

      case 'update': {
        if (!collection || !rowId || !data) {
          return json({ error: 'Missing collection name, rowId, or data' }, { status: 400, headers: corsHeaders });
        }

        // Check row size
        const dataSize = JSON.stringify(data).length;
        if (dataSize > MAX_ROW_SIZE_BYTES) {
          return json({ error: `Row data too large (${(dataSize / 1024).toFixed(1)}KB). Maximum is 1MB per row.` }, { status: 413, headers: corsHeaders });
        }

        // Fetch existing row
        const { data: existingRow, error: fetchError } = await sb
          .from('app_db_data')
          .select('data')
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .eq('row_id', rowId)
          .single();

        if (fetchError || !existingRow) {
          return json({ error: `Row with id "${rowId}" not found in collection "${collection}"` }, { status: 404, headers: corsHeaders });
        }

        // Merge existing data with updates
        const mergedData = { ...(existingRow.data as Record<string, any>), ...data };
        // Remove _id, _createdAt, _updatedAt from data (they're metadata)
        delete mergedData._id;
        delete mergedData._createdAt;
        delete mergedData._updatedAt;

        const { data: updated, error: updateError } = await sb
          .from('app_db_data')
          .update({ data: mergedData })
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .eq('row_id', rowId)
          .select('row_id,data,created_at,updated_at')
          .single();

        if (updateError) {
          return json({ error: `Update failed: ${updateError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({
          data: {
            _id: updated.row_id,
            _createdAt: updated.created_at,
            _updatedAt: updated.updated_at,
            ...(updated.data as Record<string, any>),
          },
        }, { headers: corsHeaders });
      }

      case 'delete': {
        if (!collection || !rowId) {
          return json({ error: 'Missing collection name or rowId' }, { status: 400, headers: corsHeaders });
        }

        const { error: deleteError } = await sb
          .from('app_db_data')
          .delete()
          .eq('project_id', projectId)
          .eq('collection_name', collection)
          .eq('row_id', rowId);

        if (deleteError) {
          return json({ error: `Delete failed: ${deleteError.message}` }, { status: 500, headers: corsHeaders });
        }

        return json({ success: true }, { headers: corsHeaders });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error('DB API error:', err);
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}
