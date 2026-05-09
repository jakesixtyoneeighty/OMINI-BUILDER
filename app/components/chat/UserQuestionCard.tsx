import { useState } from 'react';
import { useT } from '~/lib/i18n/useT';

export interface UserQuestionData {
  question: string;
  options: { label: string }[];
}

interface UserQuestionCardProps {
  data: UserQuestionData;
  onAnswer: (answer: string) => void;
  answered?: boolean;
}

export function UserQuestionCard({ data, onAnswer, answered }: UserQuestionCardProps) {
  const t = useT();
  const [customInput, setCustomInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handleSelect = (label: string) => {
    if (answered) return;
    setSelectedAnswer(label);
    onAnswer(label);
  };

  const handleCustomSubmit = () => {
    if (answered || !customInput.trim()) return;
    setSelectedAnswer(customInput.trim());
    onAnswer(customInput.trim());
  };

  return (
    <div className="my-3 rounded-xl border border-purple-500/30 bg-gradient-to-br from-purple-500/8 to-blue-500/8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-purple-500/10 border-b border-purple-500/20">
        <div className="i-ph:chat-teardrop-text text-purple-400 text-base" />
        <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">{t('question.fromAI')}</span>
      </div>

      {/* Question */}
      <div className="px-4 py-3">
        <p className="text-sm text-bolt-elements-textPrimary font-medium">{data.question}</p>
      </div>

      {/* Options */}
      <div className="px-4 pb-2 space-y-1.5">
        {data.options.map((option, i) => {
          const isSelected = selectedAnswer === option.label;
          return (
            <button
              key={i}
              onClick={() => handleSelect(option.label)}
              disabled={answered}
              className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 group ${
                isSelected
                  ? 'bg-purple-500/20 border border-purple-500/40 text-purple-200'
                  : answered
                    ? 'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor/50 text-bolt-elements-textTertiary cursor-default'
                    : 'bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textSecondary hover:bg-purple-500/10 hover:border-purple-500/30 hover:text-purple-300 cursor-pointer'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isSelected
                    ? 'border-purple-400 bg-purple-500'
                    : 'border-bolt-elements-borderColor group-hover:border-purple-500/50'
                }`}
              >
                {isSelected && <div className="i-ph:check-bold text-white text-[10px]" />}
              </div>
              <span className="flex-1">{option.label}</span>
            </button>
          );
        })}
      </div>

      {/* Custom answer input */}
      {!answered && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder={t('question.customAnswer')}
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="px-3 py-2 rounded-lg bg-purple-500/15 text-purple-400 text-sm font-medium border border-purple-500/25 hover:bg-purple-500/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              <div className="i-ph:paper-plane-tilt text-xs" />
              {t('question.send')}
            </button>
          </div>
        </div>
      )}

      {/* Answered state */}
      {answered && selectedAnswer && (
        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <div className="i-ph:check-circle-fill text-green-400 text-sm" />
            <span className="text-xs text-green-300">
              {t('question.answered')} {selectedAnswer}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
