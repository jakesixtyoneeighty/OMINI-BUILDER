// ============================================================
// Omni-Builder — Database Service
// ============================================================
import type {
  DatabaseConfig,
  DatabaseQueryResult,
  DatabaseSchemaInfo,
  SupabaseConfig,
  FirebaseConfig,
} from '@/types';

// ============================================================
// Supabase (PostgREST) Operations
// ============================================================

async function supabaseQuery(
  config: SupabaseConfig,
  operation: 'select' | 'insert' | 'update' | 'delete' | 'rpc' | 'raw',
  params: {
    table?: string;
    data?: any;
    filters?: string;
    columns?: string;
    limit?: number;
    orderBy?: string;
    query?: string; // for raw SQL via RPC
  }
): Promise<DatabaseQueryResult> {
  const { table, data, filters, columns, limit = 100, orderBy, query } = params;
  const baseUrl = config.url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': config.anonKey,
    'Authorization': `Bearer ${config.anonKey}`,
    'Prefer': 'return=representation',
  };

  try {
    if (operation === 'raw' && query) {
      // Execute raw SQL via Supabase RPC (requires a function to exist)
      // Fallback: use the REST endpoint with RPC pattern
      const rpcUrl = `${baseUrl}/rest/v1/rpc/execute_sql`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ sql_query: query }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Supabase RPC error: ${res.status} - ${errBody}`);
      }

      const result = await res.json();
      return {
        success: true,
        data: result,
        operation: 'raw',
        rowCount: Array.isArray(result) ? result.length : 1,
      };
    }

    if (operation === 'rpc' && query) {
      const rpcName = query;
      const rpcUrl = `${baseUrl}/rest/v1/rpc/${rpcName}`;
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data || {}),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Supabase RPC error: ${res.status} - ${errBody}`);
      }

      const result = await res.json();
      return {
        success: true,
        data: result,
        operation: 'rpc',
        rowCount: Array.isArray(result) ? result.length : 1,
      };
    }

    if (!table) {
      throw new Error('Table name is required for this operation');
    }

    let url = `${baseUrl}/rest/v1/${table}`;
    if (columns) url += `?select=${columns}`;
    if (filters) url += columns ? `&${filters}` : `?${filters}`;
    if (orderBy) url += `${filters || columns ? '&' : '?'}order=${orderBy}`;
    url += `${filters || columns || orderBy ? '&' : '?'}limit=${limit}`;

    const methodMap = {
      select: 'GET',
      insert: 'POST',
      update: 'PATCH',
      delete: 'DELETE',
    };

    const method = methodMap[operation as 'select' | 'insert' | 'update' | 'delete'];

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
        'Prefer': operation === 'insert'
          ? 'return=representation'
          : operation === 'update'
          ? 'return=representation'
          : 'count=exact',
      },
    };

    if ((operation === 'insert' || operation === 'update') && data) {
      (fetchOptions as any).body = JSON.stringify(data);
    }

    const res = await fetch(url, fetchOptions);
    const contentRange = res.headers.get('content-range');
    const count = contentRange?.split('/')[1];

    if (!res.ok) {
      const errBody = await res.text();
      let errMsg = `Supabase error ${res.status}`;
      try {
        const errJson = JSON.parse(errBody);
        errMsg = errJson.message || errJson.msg || errMsg;
      } catch {
        errMsg += ` - ${errBody}`;
      }
      throw new Error(errMsg);
    }

    const result = await res.json();
    return {
      success: true,
      data: result,
      operation,
      rowCount: Array.isArray(result) ? result.length : parseInt(count || '1', 10),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Database query failed',
      operation,
    };
  }
}

async function supabaseGetSchema(config: SupabaseConfig): Promise<DatabaseSchemaInfo> {
  const baseUrl = config.url.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': config.anonKey,
    'Authorization': `Bearer ${config.anonKey}`,
  };

  try {
    // Fetch tables from information_schema via RPC or REST
    // Supabase exposes /rest/v1/ for all tables, but we need the schema
    // Use the openapi.json to discover tables
    const openApiUrl = `${baseUrl}/rest/v1/`;
    const res = await fetch(openApiUrl, {
      headers: {
        ...headers,
        'Accept': 'application/json',
      },
    });

    // Try to get the OpenAPI spec
    const specUrl = `${baseUrl}/rest/v1/`;
    const specRes = await fetch(specUrl, { headers });
    const specData = await specRes.json();

    // Alternative: try fetching from the tables endpoint
    // Most Supabase projects expose tables through the REST API
    // We'll try to introspect using a known table listing approach
    const tablesRes = await fetch(`${baseUrl}/rest/v1/`, {
      headers: {
        ...headers,
        'Accept': 'application/json',
      },
    });

    // Use a simpler approach: list tables via pg_tables if accessible
    // Otherwise return available paths from OpenAPI
    let tables: { name: string; columns?: any[] }[] = [];

    // Try fetching the openapi spec from Supabase
    try {
      const apiRes = await fetch(`${baseUrl}/rest/v1/`, {
        method: 'OPTIONS',
        headers,
      });
      // This usually returns CORS headers, not useful
    } catch {
      // ignore
    }

    // Best approach: fetch from information_schema through the API
    // This requires the information_schema to be exposed via REST API
    try {
      const schemaRes = await fetch(
        `${baseUrl}/rest/v1/rpc/get_tables`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
        }
      );
      if (schemaRes.ok) {
        const schemaData = await schemaRes.json();
        if (Array.isArray(schemaData)) {
          tables = schemaData.map((t: any) => ({
            name: t.table_name || t.name,
            columns: t.columns || [],
          }));
        }
      }
    } catch {
      // RPC not available, try listing from known tables
    }

    return { tables };
  } catch (error: any) {
    return { tables: [] };
  }
}

async function supabaseTestConnection(config: SupabaseConfig): Promise<{ success: boolean; error?: string }> {
  const baseUrl = config.url.replace(/\/$/, '');

  try {
    const res = await fetch(`${baseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': config.anonKey,
        'Authorization': `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        success: false,
        error: `Connection failed (${res.status}): ${errBody.substring(0, 200)}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Cannot reach Supabase instance',
    };
  }
}

// ============================================================
// Firebase (Firestore REST API) Operations
// ============================================================

async function firebaseQuery(
  config: FirebaseConfig,
  operation: 'get' | 'add' | 'update' | 'delete' | 'query',
  params: {
    collection?: string;
    documentId?: string;
    data?: any;
    where?: { field: string; op: string; value: any }[];
    orderBy?: string;
    limit?: number;
  }
): Promise<DatabaseQueryResult> {
  const { collection, documentId, data, where, orderBy, limit = 100 } = params;
  const projectId = config.projectId;
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If apiKey is available, get a token (anonymous)
  let authToken = '';
  if (config.apiKey) {
    try {
      // Use the Firebase Auth REST API to get an anonymous token
      const authRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ returnSecureToken: true }),
        }
      );
      if (authRes.ok) {
        const authData = await authRes.json();
        authToken = authData.idToken || '';
        headers['Authorization'] = `Bearer ${authToken}`;
      }
    } catch {
      // Continue without auth token
    }
  }

  try {
    if (operation === 'get' && collection && documentId) {
      const url = `${baseUrl}/${collection}/${documentId}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const parsed = parseFirebaseDocument(result);
      return { success: true, data: parsed, operation, rowCount: 1 };
    }

    if (operation === 'get' && collection && !documentId) {
      const url = `${baseUrl}/${collection}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const documents = (result.documents || []).map(parseFirebaseDocument);
      return { success: true, data: documents, operation, rowCount: documents.length };
    }

    if (operation === 'query' && collection) {
      const structuredQuery: any = {
        from: [{ collectionId: collection }],
      };

      if (where && where.length > 0) {
        structuredQuery.where = {
          compositeFilter: {
            op: 'AND',
            filters: where.map((w) => ({
              fieldFilter: {
                field: { fieldPath: w.field },
                op: getFirebaseOp(w.op),
                value: toFirebaseValue(w.value),
              },
            })),
          },
        };
      }

      if (orderBy) {
        structuredQuery.orderBy = [{ field: { fieldPath: orderBy }, direction: 'ASCENDING' }];
      }

      if (limit) {
        structuredQuery.limit = limit;
      }

      const url = `${baseUrl}:runQuery`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ structuredQuery }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase query error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const documents = result
        .filter((r: any) => r.document)
        .map((r: any) => parseFirebaseDocument(r.document));
      return { success: true, data: documents, operation: 'query', rowCount: documents.length };
    }

    if (operation === 'add' && collection && data) {
      const url = `${baseUrl}/${collection}`;
      const firebaseData = toFirebaseFields(data);

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: firebaseData,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase insert error ${res.status}: ${errBody}`);
      }

      const result = await res.json();
      const parsed = parseFirebaseDocument(result);
      return { success: true, data: parsed, operation: 'add', rowCount: 1 };
    }

    if (operation === 'update' && collection && documentId && data) {
      const url = `${baseUrl}/${collection}/${documentId}`;
      const firebaseData = toFirebaseFields(data);

      // Firestore update needs a mask
      const fieldPaths = Object.keys(data);
      const res = await fetch(`${url}?${fieldPaths.map((f) => `updateMask.fieldPaths=${f}`).join('&')}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: firebaseData,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase update error ${res.status}: ${errBody}`);
      }

      return { success: true, data: { id: documentId, ...data }, operation: 'update', rowCount: 1 };
    }

    if (operation === 'delete' && collection && documentId) {
      const url = `${baseUrl}/${collection}/${documentId}`;
      const res = await fetch(url, { method: 'DELETE', headers });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Firebase delete error ${res.status}: ${errBody}`);
      }

      return { success: true, operation: 'delete', rowCount: 1 };
    }

    return { success: false, error: 'Invalid operation or missing parameters', operation };
  } catch (error: any) {
    return { success: false, error: error.message || 'Firebase query failed', operation };
  }
}

function getFirebaseOp(op: string): string {
  const map: Record<string, string> = {
    '==': 'EQUAL',
    '!=': 'NOT_EQUAL',
    '<': 'LESS_THAN',
    '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN',
    '>=': 'GREATER_THAN_OR_EQUAL',
    'in': 'IN',
    'array-contains': 'ARRAY_CONTAINS',
  };
  return map[op] || 'EQUAL';
}

function toFirebaseValue(value: any): any {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirebaseValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirebaseFields(value) } };
  return { stringValue: String(value) };
}

function toFirebaseFields(data: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirebaseValue(value);
  }
  return fields;
}

function parseFirebaseValue(field: any): any {
  if (!field) return null;
  if (field.stringValue !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return parseInt(field.integerValue, 10);
  if (field.doubleValue !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.nullValue !== undefined) return null;
  if (field.arrayValue) {
    return (field.arrayValue.values || []).map(parseFirebaseValue);
  }
  if (field.mapValue) {
    const obj: Record<string, any> = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) {
      obj[k] = parseFirebaseValue(v);
    }
    return obj;
  }
  if (field.timestampValue) return field.timestampValue;
  if (field.referenceValue) return field.referenceValue;
  if (field.geoPointValue) return field.geoPointValue;
  return null;
}

function parseFirebaseDocument(doc: any): any {
  if (!doc) return null;
  const id = doc.name?.split('/').pop() || '';
  const fields: Record<string, any> = {};
  if (doc.fields) {
    for (const [key, value] of Object.entries(doc.fields)) {
      fields[key] = parseFirebaseValue(value);
    }
  }
  return { id, ...fields };
}

async function firebaseTestConnection(config: FirebaseConfig): Promise<{ success: boolean; error?: string }> {
  try {
    // Test by trying to list collections
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Try to get anonymous auth token
    if (config.apiKey) {
      try {
        const authRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${config.apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ returnSecureToken: true }),
          }
        );
        if (authRes.ok) {
          const authData = await authRes.json();
          headers['Authorization'] = `Bearer ${authData.idToken}`;
        }
      } catch {
        // Continue without auth
      }
    }

    const res = await fetch(baseUrl, { headers });

    if (!res.ok) {
      const errBody = await res.text();
      // 200 is fine, other statuses might still be fine for some configs
      if (res.status === 404 || res.status === 403) {
        return {
          success: false,
          error: `Cannot access Firestore (${res.status}): Check project ID and API key. ${errBody.substring(0, 200)}`,
        };
      }
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Cannot reach Firebase project',
    };
  }
}

// ============================================================
// Unified API
// ============================================================

export async function testDatabaseConnection(config: DatabaseConfig): Promise<{ success: boolean; error?: string }> {
  if (!config) return { success: false, error: 'No configuration provided' };

  if (config.provider === 'supabase') {
    return supabaseTestConnection(config);
  } else {
    return firebaseTestConnection(config);
  }
}

export async function executeDatabaseQuery(
  config: DatabaseConfig,
  operation: string,
  params: Record<string, any>
): Promise<DatabaseQueryResult> {
  if (!config) {
    return { success: false, error: 'No database configured' };
  }

  if (config.provider === 'supabase') {
    return supabaseQuery(config, operation as any, params);
  } else {
    return firebaseQuery(config, operation as any, params);
  }
}

export async function getDatabaseSchema(config: DatabaseConfig): Promise<DatabaseSchemaInfo> {
  if (!config) return { tables: [] };

  if (config.provider === 'supabase') {
    return supabaseGetSchema(config);
  }

  // Firebase doesn't have a fixed schema
  return { tables: [] };
}

export function getDatabaseContextString(config: DatabaseConfig): string {
  if (!config) return '';

  if (config.provider === 'supabase') {
    return `
## Database Configuration (Supabase)
- **Provider:** Supabase (PostgreSQL)
- **Project URL:** ${config.url}
- **Connection:** REST API (PostgREST)
- **Authentication:** Anon Key

The user has a Supabase database connected. You can:
1. Read data: \`SELECT * FROM table_name\` or use REST: GET /rest/v1/table_name
2. Insert data: \`INSERT INTO table_name ...\` or use REST: POST /rest/v1/table_name
3. Update data: \`UPDATE table_name SET ...\` or use REST: PATCH /rest/v1/table_name?id=eq.1
4. Delete data: \`DELETE FROM table_name WHERE ...\` or use REST: DELETE /rest/v1/table_name?id=eq.1
5. Create tables via SQL: Suggest the user creates tables in the Supabase dashboard or via SQL editor
6. Query with filters: Use Supabase REST filtering syntax

When the user asks you to work with their database, you can output SQL commands or REST API calls.
Include the database operations alongside the code you generate for the frontend.`;
  }

  if (config.provider === 'firebase') {
    return `
## Database Configuration (Firebase Firestore)
- **Provider:** Firebase (Cloud Firestore)
- **Project ID:** ${config.projectId}
- **Connection:** Firestore REST API

The user has a Firebase Firestore database connected. You can:
1. Get documents: GET /projects/{projectId}/databases/(default)/documents/{collection}/{documentId}
2. Add documents: POST /projects/{projectId}/databases/(default)/documents/{collection}
3. Update documents: PATCH /projects/{projectId}/databases/(default)/documents/{collection}/{documentId}
4. Delete documents: DELETE /projects/{projectId}/databases/(default)/documents/{collection}/{documentId}
5. Query with filters: POST /projects/{projectId}/databases/(default)/documents:runQuery

When the user asks you to work with their database, include the Firestore operations alongside the frontend code.
Generate Firebase integration code that connects to their project.`;
  }

  return '';
}
