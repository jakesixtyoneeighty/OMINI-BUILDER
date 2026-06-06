import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

/**
 * Web search tool — searches the internet for real-time information.
 * Uses a public search API to find relevant results.
 */
export const webSearchTool = tool({
  description: `Search the web for real-time information. Use this tool when you need to:
- Find current information about libraries, frameworks, or APIs
- Look up documentation or tutorials
- Check the latest versions of packages
- Find solutions to technical problems
- Get up-to-date information about any topic
Always use this tool when the user asks about something that requires current/recent information.`,
  parameters: z.object({
    query: z.string().describe('The search query to look up on the web'),
  }),
  execute: async ({ query }) => {
    try {
      // Use DuckDuckGo Instant Answer API (no API key required)
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MojoBuilder/1.0)',
        },
      });

      if (!response.ok) {
        return { error: `Search failed with status ${response.status}`, results: [] };
      }

      const data = await response.json() as any;
      const results: Array<{
        title: string;
        url: string;
        snippet: string;
      }> = [];

      // Add the abstract if available
      if (data.Abstract) {
        results.push({
          title: data.AbstractSource || 'DuckDuckGo',
          url: data.AbstractURL || '',
          snippet: data.Abstract,
        });
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics.slice(0, 8)) {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.substring(0, 80),
              url: topic.FirstURL,
              snippet: topic.Text,
            });
          } else if (topic.Topics) {
            for (const sub of topic.Topics.slice(0, 3)) {
              if (sub.Text && sub.FirstURL) {
                results.push({
                  title: sub.Text.substring(0, 80),
                  url: sub.FirstURL,
                  snippet: sub.Text,
                });
              }
            }
          }
          if (results.length >= 10) break;
        }
      }

      // Add infobox if available
      if (data.Infobox?.content) {
        for (const item of data.Infobox.content.slice(0, 3)) {
          if (item.value) {
            results.push({
              title: item.label || 'Info',
              url: item.wiki_order?.toString() || '',
              snippet: `${item.label || 'Info'}: ${item.value}`,
            });
          }
        }
      }

      // Fallback: if no results from DDG, try a simpler approach
      if (results.length === 0) {
        return {
          query,
          results: [],
          message: `No instant answers found for "${query}". Try a more specific search query, or use web_reader to read a specific URL if you know where to look.`,
        };
      }

      return { query, results };
    } catch (error) {
      console.error('[web_search] Error:', error);
      return { error: 'Search failed due to a network error', results: [], query };
    }
  },
});

/**
 * Web reader tool — reads the content of a web page by URL.
 * Useful for reading documentation, articles, or API references.
 */
export const webReaderTool = tool({
  description: `Read the content of a web page by URL. Use this tool when you need to:
- Read documentation from a specific URL
- Get the content of an article or blog post
- Check the contents of a GitHub repository's README
- Read API documentation
Provide the full URL of the page you want to read.`,
  parameters: z.object({
    url: z.string().url().describe('The full URL of the web page to read'),
  }),
  execute: async ({ url }) => {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MojoBuilder/1.0)',
          'Accept': 'text/html,text/plain,text/markdown,application/json',
        },
      });

      if (!response.ok) {
        return { error: `Failed to fetch URL: status ${response.status}`, content: '' };
      }

      const contentType = response.headers.get('content-type') || '';
      let content = await response.text();

      // If HTML, extract text content (basic stripping)
      if (contentType.includes('html')) {
        content = stripHtml(content);
      }

      // Truncate to reasonable size
      const MAX_LENGTH = 15000;
      if (content.length > MAX_LENGTH) {
        content = content.substring(0, MAX_LENGTH) + '\n\n[Content truncated - page was too long]';
      }

      return {
        url,
        title: extractTitle(content) || url,
        content,
      };
    } catch (error) {
      console.error('[web_reader] Error:', error);
      return { error: 'Failed to fetch the URL due to a network error', content: '', url };
    }
  },
});

/**
 * Basic HTML to text conversion — removes tags and extracts readable content.
 */
function stripHtml(html: string): string {
  return html
    // Remove script and style blocks entirely
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    // Replace common block elements with newlines
    .replace(/<\/?(p|div|h[1-6]|br|li|tr|hr)[^>]*>/gi, '\n')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract a title from text content (first significant line).
 */
function extractTitle(content: string): string {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[0]?.substring(0, 100) || '';
}

/**
 * Create the Omni DB tool with access to Supabase credentials.
 * This tool lets the AI directly create collections on the server
 * so they appear in the DatabasePanel immediately.
 */
export function createOmniDbTool(projectId: string, supabaseUrl: string, supabaseKey: string) {
  return tool({
    description: `Manage the Mojo DB built-in database for this project. Use this tool to:
- Create collections with schemas (they will be immediately available in the Database panel)
- Initialize the database for the project
- Check storage stats

IMPORTANT: Always use this tool to create collections BEFORE generating code that uses them. This ensures the collections exist in the database and appear in the Database panel right away.

Call this tool with action="createCollection" for each collection the app needs.`,
    parameters: z.object({
      action: z.enum(['init', 'createCollection', 'stats', 'collections']).describe('The database action to perform'),
      collection: z.string().optional().describe('Collection name (for createCollection)'),
      schema: z.record(z.object({
        type: z.string(),
        required: z.boolean().optional(),
        unique: z.boolean().optional(),
        default: z.any().optional(),
      })).optional().describe('Collection schema (for createCollection)'),
    }),
    execute: async ({ action, collection, schema }) => {
      try {
        const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
        const MAX_BYTES_PER_PROJECT = 104857600; // 100MB

        switch (action) {
          case 'init': {
            const { data: existingQuota } = await sb
              .from('app_db_quota')
              .select('*')
              .eq('project_id', projectId)
              .single();

            if (existingQuota) {
              return { success: true, quota: existingQuota };
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
              return { error: `Failed to initialize DB: ${quotaError.message}` };
            }

            return { success: true, quota: newQuota };
          }

          case 'createCollection': {
            if (!collection || !schema) {
              return { error: 'Missing collection name or schema' };
            }

            // Validate collection name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(collection)) {
              return { error: 'Invalid collection name. Use only letters, numbers, and underscores. Must start with a letter or underscore.' };
            }

            // Check if collection already exists - if so, update the schema
            const { data: existing } = await sb
              .from('app_db_schemas')
              .select('id, schema_def')
              .eq('project_id', projectId)
              .eq('collection_name', collection)
              .single();

            // Add system fields to schema
            const fullSchema = {
              _id: { type: 'string', required: true, unique: true },
              _createdAt: { type: 'string', required: true },
              _updatedAt: { type: 'string', required: true },
              ...schema,
            };

            if (existing) {
              // Collection already exists - update the schema by merging
              const existingSchema = existing.schema_def as Record<string, any>;
              const mergedSchema = { ...existingSchema, ...fullSchema };

              const { error: updateError } = await sb
                .from('app_db_schemas')
                .update({ schema_def: mergedSchema })
                .eq('id', existing.id);

              if (updateError) {
                return { error: `Failed to update collection: ${updateError.message}` };
              }

              return { success: true, collection: { name: collection, schema: mergedSchema }, message: `Collection "${collection}" already existed. Schema updated.` };
            }

            // Create new collection
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
              return { error: `Failed to create collection: ${schemaError.message}` };
            }

            return { success: true, collection: { name: collection, schema: fullSchema } };
          }

          case 'stats': {
            const { data: quota, error } = await sb
              .from('app_db_quota')
              .select('*')
              .eq('project_id', projectId)
              .single();

            if (error || !quota) {
              return { quota: { used_bytes: 0, max_bytes: MAX_BYTES_PER_PROJECT, row_count: 0, collection_count: 0 } };
            }

            return { quota };
          }

          case 'collections': {
            const { data: schemas, error } = await sb
              .from('app_db_schemas')
              .select('collection_name, schema_def, created_at, updated_at')
              .eq('project_id', projectId)
              .order('collection_name');

            if (error) {
              return { error: `Failed to fetch collections: ${error.message}` };
            }

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

            return { collections: collectionStats };
          }

          default:
            return { error: `Unknown action: ${action}` };
        }
      } catch (err) {
        console.error('Omni DB tool error:', err);
        return { error: err instanceof Error ? err.message : 'Internal error' };
      }
    },
  });
}

/**
 * Create the deploy tool — tells the AI to instruct the user to deploy.
 * The actual deploy is triggered client-side via a custom event because
 * the project files live in the browser (WebContainer), not on the server.
 */
export function createDeployTool() {
  return tool({
    description: `Deploy the project to Cloudflare Pages (FREE, no API key needed). Use this tool when:
- The user asks to deploy, publish, or go live with their project
- The user says "deploy", "publicar", "colocar no ar", "make it live", "ship it"
- The user wants to share their project with others via a public URL

This deploys to Cloudflare Pages which gives a *.pages.dev URL. It's completely free, requires no API key, and the site gets SSL automatically.

IMPORTANT: Before deploying, briefly review the project to make sure everything is ready (index.html exists, no build errors, etc). If there are obvious issues, fix them first or warn the user.`,
    parameters: z.object({
      projectName: z.string().optional().describe('Optional project name for the deployment URL (lowercase, hyphens only). If not provided, a name will be generated automatically from the project name.'),
    }),
    execute: async ({ projectName }) => {
      // The actual deploy happens client-side via the DeployButton component.
      // The AI tool just confirms the intent and provides the project name.
      // The Chat.client.tsx listens for 'ai-deploy-request' events.
      return {
        action: 'deploy',
        provider: 'cloudflare',
        projectName: projectName || null,
        message: 'Deploy started! The project will be published to Cloudflare Pages (free, no API key). The deploy will run automatically in the interface.',
        instructions: 'Tell the user that the deploy has been initiated and they will see the URL shortly. The site will be available at a *.pages.dev URL with automatic SSL.',
      };
    },
  });
}

/**
 * Build the tools object for the AI streamText call.
 * Includes omni_db tool when Omni DB is configured.
 * Includes deploy tool always (Cloudflare Pages — free, no API key).
 */
export function buildTools(projectId?: string, supabaseUrl?: string, supabaseKey?: string, _serverOrigin?: string) {
  const result: Record<string, any> = {
    web_search: webSearchTool,
    web_reader: webReaderTool,
    deploy: createDeployTool(),
  };

  // Add omni_db tool if Omni DB is configured with valid Supabase credentials
  if (projectId && supabaseUrl && supabaseKey) {
    result.omni_db = createOmniDbTool(projectId, supabaseUrl, supabaseKey);
  }

  return result;
}

/**
 * All tools to be passed to the AI streamText call (without Omni DB).
 * Use buildTools() for the full set including omni_db.
 */
export const tools = {
  web_search: webSearchTool,
  web_reader: webReaderTool,
} as const;
