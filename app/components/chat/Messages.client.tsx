import type { Message } from 'ai';
import React from 'react';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { UserQuestionCard, type UserQuestionData } from './UserQuestionCard';
import { useT } from '~/lib/i18n/useT';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  tokenUsage?: Record<number, { promptTokens: number; completionTokens: number; totalTokens: number }>;
  userQuestions?: Record<number, UserQuestionData>;
  answeredQuestions?: Set<number>;
  onQuestionAnswer?: (msgIndex: number, answer: string) => void;
  planMode?: boolean;
  onProceed?: () => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [], tokenUsage, userQuestions, answeredQuestions, onQuestionAnswer, planMode, onProceed } = props;
  const t = useT();

  // Find the last assistant message index when in plan mode and not streaming
  const lastAssistantIndex = React.useMemo(() => {
    if (!planMode || isStreaming || messages.length === 0) return -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [planMode, isStreaming, messages]);

  return (
    <div id={id} ref={ref} className={props.className}>
      {messages.length > 0
        ? messages.map((message, index) => {
            const { role, content } = message;
            const isUserMessage = role === 'user';
            const isFirst = index === 0;
            const isLast = index === messages.length - 1;

            return (
              <div
                key={index}
                className={classNames('flex gap-4 p-6 w-full rounded-[calc(0.75rem-1px)]', {
                  'bg-bolt-elements-messages-background': isUserMessage || !isStreaming || (isStreaming && !isLast),
                  'bg-gradient-to-b from-bolt-elements-messages-background from-30% to-transparent':
                    isStreaming && isLast,
                  'mt-4': !isFirst,
                })}
              >
                {isUserMessage && (
                  <div className="flex items-center justify-center w-[34px] h-[34px] overflow-hidden bg-bolt-elements-bg-depth-3 text-bolt-elements-textSecondary rounded-full shrink-0 self-start">
                    <div className="i-ph:user-fill text-xl"></div>
                  </div>
                )}
                <div className="grid grid-col-1 w-full">
                  {isUserMessage ? (
                    <UserMessage message={message} />
                  ) : (
                    <>
                      <AssistantMessage content={content} tokenUsage={tokenUsage?.[index]} isStreaming={isStreaming && isLast} />
                      {userQuestions?.[index] && (
                        <UserQuestionCard
                          data={userQuestions[index]}
                          onAnswer={(answer) => onQuestionAnswer?.(index, answer)}
                          answered={answeredQuestions?.has(index)}
                        />
                      )}
                      {/* Proceed button: shows after the last assistant message in plan mode when not streaming */}
                      {planMode && !isStreaming && index === lastAssistantIndex && onProceed && (
                        <div className="mt-4 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={onProceed}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-bolt-elements-item-contentAccent text-white hover:brightness-110 shadow-md hover:shadow-lg transition-all active:scale-[0.97]"
                          >
                            <div className="i-ph:play-fill text-base" />
                            {t('plan.proceed')}
                          </button>
                          <span className="text-xs text-bolt-elements-textTertiary">
                            {t('plan.proceedHint')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        : null}
      {isStreaming && (
        <div className="flex items-center gap-3 px-6 py-4 w-full">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-500/10 border-2 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
            <div className="i-svg-spinners:90-ring-with-bg text-blue-400 text-sm" />
            <span className="text-xs font-semibold text-blue-400">Pensando</span>
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          </div>
        </div>
      )}
    </div>
  );
});
