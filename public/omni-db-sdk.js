/**
 * Omni DB SDK - Built-in database for Omni Builder
 *
 * Each project gets 100MB of free storage.
 * API Endpoint: POST /api/db
 *
 * Usage:
 *   import OmniDB from './lib/omni-db.js';
 *   const db = new OmniDB('your-project-id');
 *
 *   // Create a collection
 *   await db.createCollection('users', {
 *     name: { type: 'string', required: true },
 *     email: { type: 'string', required: true, unique: true },
 *   });
 *
 *   // Insert
 *   await db.insert('users', { name: 'John', email: 'john@example.com' });
 *
 *   // Query
 *   const result = await db.query('users', { where: { name: { like: '%John%' } }, limit: 10 });
 *
 *   // Update
 *   await db.update('users', 'row-id', { name: 'Jane' });
 *
 *   // Delete
 *   await db.delete('users', 'row-id');
 */
class OmniDB {
  constructor(projectId, options = {}) {
    if (!projectId) {
      throw new Error('OmniDB: projectId is required');
    }
    this.projectId = projectId;
    this.baseUrl = options.baseUrl || '/api/db';
  }

  async _request(action, extra = {}) {
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, projectId: this.projectId, ...extra }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Omni DB request failed (${res.status})`);
    }
    return data;
  }

  /**
   * Initialize the database for this project
   * @returns {Promise<{success: boolean, quota: object}>}
   */
  async init() {
    return this._request('init');
  }

  /**
   * Get storage stats and quota info
   * @returns {Promise<{quota: {used_bytes: number, max_bytes: number, row_count: number, collection_count: number}}>}
   */
  async stats() {
    return this._request('stats');
  }

  /**
   * List all collections with their schemas and row counts
   * @returns {Promise<{collections: Array<{name: string, schema: object, rowCount: number}>}>}
   */
  async collections() {
    return this._request('collections');
  }

  /**
   * Create a new collection with a schema
   * @param {string} name - Collection name (alphanumeric + underscore)
   * @param {object} schema - Field definitions: { fieldName: { type: 'string|number|boolean', required?: boolean, unique?: boolean } }
   * @returns {Promise<{success: boolean, collection: {name: string, schema: object}}>}
   */
  async createCollection(name, schema) {
    return this._request('createCollection', { collection: name, schema });
  }

  /**
   * Drop a collection and all its data
   * @param {string} name - Collection name
   * @returns {Promise<{success: boolean}>}
   */
  async dropCollection(name) {
    return this._request('dropCollection', { collection: name });
  }

  /**
   * Get the schema of a collection
   * @param {string} name - Collection name
   * @returns {Promise<{schema: object, createdAt: string, updatedAt: string}>}
   */
  async getSchema(name) {
    return this._request('getSchema', { collection: name });
  }

  /**
   * Insert a document into a collection
   * @param {string} collection - Collection name
   * @param {object} data - Document data
   * @returns {Promise<{data: {_id: string, _createdAt: string, _updatedAt: string, ...data}}>}
   */
  async insert(collection, data) {
    return this._request('insert', { collection, data });
  }

  /**
   * Query documents from a collection
   * @param {string} collection - Collection name
   * @param {object} options - Query options
   * @param {object} [options.where] - Filter conditions
   * @param {string} [options.orderBy] - Field to order by
   * @param {'asc'|'desc'} [options.orderDir] - Order direction
   * @param {number} [options.limit] - Max results (default: 100, max: 100)
   * @param {number} [options.offset] - Results offset
   * @param {string[]} [options.select] - Fields to select
   * @returns {Promise<{data: Array, count: number, limit: number, offset: number}>}
   */
  async query(collection, options = {}) {
    return this._request('query', {
      collection,
      where: options.where,
      orderBy: options.orderBy,
      orderDir: options.orderDir,
      limit: options.limit,
      offset: options.offset,
      select: options.select,
    });
  }

  /**
   * Count documents in a collection
   * @param {string} collection - Collection name
   * @param {object} [where] - Filter conditions
   * @returns {Promise<{count: number}>}
   */
  async count(collection, where) {
    return this._request('count', { collection, where });
  }

  /**
   * Update a document by ID
   * @param {string} collection - Collection name
   * @param {string} rowId - Document ID (_id field)
   * @param {object} data - Fields to update (merged with existing data)
   * @returns {Promise<{data: {_id: string, _createdAt: string, _updatedAt: string, ...data}}>}
   */
  async update(collection, rowId, data) {
    return this._request('update', { collection, rowId, data });
  }

  /**
   * Delete a document by ID
   * @param {string} collection - Collection name
   * @param {string} rowId - Document ID (_id field)
   * @returns {Promise<{success: boolean}>}
   */
  async delete(collection, rowId) {
    return this._request('delete', { collection, rowId });
  }
}

// Support both ESM and CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OmniDB;
} else if (typeof window !== 'undefined') {
  window.OmniDB = OmniDB;
}

// ESM export
export default OmniDB;
