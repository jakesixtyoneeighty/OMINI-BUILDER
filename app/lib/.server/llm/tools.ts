import { tool } from 'ai';
import { z } from 'zod';

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
          'User-Agent': 'Mozilla/5.0 (compatible; OmniBuilder/1.0)',
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
          'User-Agent': 'Mozilla/5.0 (compatible; OmniBuilder/1.0)',
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
 * All tools to be passed to the AI streamText call.
 */
export const tools = {
  web_search: webSearchTool,
  web_reader: webReaderTool,
} as const;
