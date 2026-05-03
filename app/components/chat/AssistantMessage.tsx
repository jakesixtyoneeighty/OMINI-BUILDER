import { memo } from 'react';
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

export const AssistantMessage = memo(({ content, tokenUsage, isStreaming }: AssistantMessageProps) => {
  const estimatedCost = tokenUsage
    ? tokenUsage.promptTokens * INPUT_PRICE_PER_TOKEN + tokenUsage.completionTokens * OUTPUT_PRICE_PER_TOKEN
    : 0;

  const { thinking, content: mainContent, isThinking } = extractThinking(content);
  const displayContent = stripActionTags(mainContent);

  if (!displayContent && !thinking) {
    return null;
  }

  return (
    <div className="overflow-hidden w-full">
      {thinking && <ThinkingBlock content={thinking} isStreaming={isStreaming || isThinking} />}
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
