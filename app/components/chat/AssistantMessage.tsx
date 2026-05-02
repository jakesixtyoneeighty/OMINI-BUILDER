import { memo } from 'react';
import { Markdown } from './Markdown';

interface AssistantMessageProps {
  content: string;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}

/**
 * Price estimation (approximate per million tokens).
 * Claude 3.5 Sonnet: $3/MTok input, $15/MTok output.
 * GPT-4o: $2.50/MTok input, $10/MTok output.
 * Use average: $2.75/MTok input, $12.50/MTok output.
 */
const INPUT_PRICE_PER_TOKEN = 0.00000275;
const OUTPUT_PRICE_PER_TOKEN = 0.0000125;

export const AssistantMessage = memo(({ content, tokenUsage }: AssistantMessageProps) => {
  const estimatedCost = tokenUsage
    ? tokenUsage.promptTokens * INPUT_PRICE_PER_TOKEN + tokenUsage.completionTokens * OUTPUT_PRICE_PER_TOKEN
    : 0;

  return (
    <div className="overflow-hidden w-full">
      <Markdown html>{content}</Markdown>
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
