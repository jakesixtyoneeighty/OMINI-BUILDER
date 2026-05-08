import { memo, useMemo } from 'react';
import { Markdown } from './Markdown';
import { ThinkingBlock } from './ThinkingBlock';

interface AssistantMessageProps {
  content: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  isStreaming?: boolean;
}

/**
 * Price estimation (approximate per million tokens).
 * Claude 3.5 Sonnet: $3/MTok input, $15/MTok output.
 * GPT-4o: $2.50/MTok input, $10/MTok output.
 * Use average: $2.75/MTok input, $12.50/MTok output.
 */
const INPUT_PRICE_PER_TOKEN = 0.00000275;
const OUTPUT_PRICE_PER_TOKEN = 0.0000125;

// Strip special action tags from rendered content (they trigger modals/UI instead)
function stripActionTags(text: string): string {
  return text
    .replace(/<env_request>[\s\S]*?<\/env_request>/g, '')
    .replace(/<db_request[\s\S]*?<\/db_request>/g, '')
    .replace(/<user_question[\s\S]*?<\/user_question>/g, '')
    .trim();
}

/**
 * Extracts <think...>...</think) blocks from AI reasoning.
 * Handles complete blocks, unclosed (streaming), and partial opening tags.
 * Supports both <think) and <thinking) tag formats.
 */
function extractThinking(text: string): { thinking: string; content: string; isThinking: boolean } {
  let thinking = '';
  let content = text;
  let isThinking = false;

  // Match complete thinking blocks (supports <think) and <thinking))
  // Closing > is optional to handle streaming edge cases
  const thinkCompleteRegex = /<think(?:ing)?[^>]*>([\s\S]*?)<\/think(?:ing)?\s*>?/gi;
  content = content.replace(thinkCompleteRegex, (_: string, thinkContent: string) => {
    thinking += (thinking ? '\n\n' : '') + thinkContent;
    return '';
  });

  // Check for unclosed thinking block (still streaming)
  const unclosedMatch = content.match(/<think(?:ing)?[^>]*>([\s\S]*)$/i);

  if (unclosedMatch) {
    thinking += (thinking ? '\n\n' : '') + unclosedMatch[1];
    content = content.replace(unclosedMatch[0], '');
    isThinking = true;
  } else {
    // Remove any partial thinking opening tag at the end (streaming in progress)
    const partialMatch = content.match(/<think(?:ing)?[^>]*$/i);

    if (partialMatch) {
      content = content.replace(partialMatch[0], '');
      isThinking = true;
    }
  }

  return { thinking: thinking.trim(), content: content.trim(), isThinking };
}

/**
 * Detect URLs that the AI fetched/read from the content.
 * Looks for patterns like "I fetched https://..." or "Read content from https://..."
 */
function extractFetchedUrls(text: string): { url: string; domain: string }[] {
  const urls: { url: string; domain: string }[] = [];
  const seen = new Set<string>();

  // Match URLs in the content
  const urlRegex = /https?:\/\/[^\s<>\"')\]]+/g;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    // Clean trailing punctuation
    url = url.replace(/[.,;:!?\)}\]]+$/, '');

    if (!seen.has(url)) {
      seen.add(url);
      try {
        const parsed = new URL(url);
        // Skip common non-site URLs (API endpoints, internal URLs, etc.)
        if (
          parsed.pathname === '/' ||
          (parsed.pathname.length > 1 && !parsed.pathname.startsWith('/api/'))
        ) {
          urls.push({ url, domain: parsed.hostname });
        }
      } catch {
        // Skip invalid URLs
      }
    }
  }

  return urls;
}

/**
 * FetchSiteCard - shows a visual card when the AI visited/read a website.
 */
function FetchSiteCard({ url, domain, isStreaming }: { url: string; domain: string; isStreaming?: boolean }) {
  const screenshotUrl = `/api/screenshot?url=${encodeURIComponent(url)}`;

  return (
    <div className="my-2 rounded-xl overflow-hidden border border-[#e0e0e0] dark:border-bolt-elements-borderColor bg-[#f8f9fa] dark:bg-bolt-elements-background-depth-1 max-w-sm">
      {/* Screenshot */}
      <div className="relative w-full h-32 bg-bolt-elements-bg-depth-3 overflow-hidden">
        <img
          src={screenshotUrl}
          alt={`Preview of ${domain}`}
          className="w-full h-full object-cover object-top"
          loading="lazy"
          onError={(e) => {
            // Hide the image on error and show a placeholder
            (e.target as HTMLImageElement).style.display = 'none';
            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
          }}
        />
        {/* Placeholder when screenshot fails */}
        <div className="hidden absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div className="i-ph:globe text-4xl text-blue-400/40" />
        </div>

        {/* Fetch site badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm">
          {isStreaming ? (
            <div className="i-svg-spinners:90-ring-with-bg text-[10px] text-blue-300" />
          ) : (
            <div className="i-ph:globe text-[10px] text-emerald-300" />
          )}
          <span className="text-[10px] font-medium text-white">
            {isStreaming ? 'Fetch site' : 'Site fetched'}
          </span>
        </div>
      </div>

      {/* URL info */}
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="i-ph:globe text-sm text-blue-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-bolt-elements-textPrimary truncate">{domain}</p>
          <p className="text-[10px] text-bolt-elements-textTertiary truncate">{url}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="i-ph:arrow-square-out text-xs" />
        </a>
      </div>
    </div>
  );
}

export const AssistantMessage = memo(({ content, tokenUsage, isStreaming }: AssistantMessageProps) => {
  const estimatedCost = tokenUsage
    ? tokenUsage.promptTokens * INPUT_PRICE_PER_TOKEN + tokenUsage.completionTokens * OUTPUT_PRICE_PER_TOKEN
    : 0;

  const { thinking, content: mainContent, isThinking } = extractThinking(content);
  const displayContent = stripActionTags(mainContent);

  // Extract URLs from both thinking and content for fetch site cards
  const fetchedUrls = useMemo(() => {
    const allText = thinking + '\n' + displayContent;
    return extractFetchedUrls(allText);
  }, [thinking, displayContent]);

  if (!displayContent && !thinking) {
    return null;
  }

  return (
    <div className="overflow-hidden w-full">
      {thinking && <ThinkingBlock content={thinking} isStreaming={isStreaming || isThinking} />}
      {/* Fetch site cards */}
      {fetchedUrls.length > 0 && (
        <div className="flex flex-wrap gap-2 my-2">
          {fetchedUrls.map((item) => (
            <FetchSiteCard
              key={item.url}
              url={item.url}
              domain={item.domain}
              isStreaming={isStreaming || isThinking}
            />
          ))}
        </div>
      )}
      {displayContent && <Markdown html>{displayContent}</Markdown>}
      {tokenUsage && tokenUsage.totalTokens > 0 && (
        <div className="flex items-center gap-3 mt-2 text-[10px] text-bolt-elements-textTertiary">
          <span>{tokenUsage.totalTokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>
            {tokenUsage.promptTokens.toLocaleString()} in / {tokenUsage.completionTokens.toLocaleString()} out
          </span>
          {estimatedCost > 0 && (
            <>
              <span>·</span>
              <span>${estimatedCost.toFixed(4)}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
});
