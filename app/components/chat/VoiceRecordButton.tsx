import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { useT } from '~/lib/i18n/useT';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
}

export const VoiceRecordButton = memo(function VoiceRecordButton({ onTranscript }: VoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const t = useT();

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript + ' ';
        } else {
          interim += result[0].transcript;
        }
      }
      // Only call onTranscript with final results to avoid flooding
      if (finalTranscript) {
        onTranscript(finalTranscript.trim());
        finalTranscript = '';
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      setRecording(false);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      if (recognitionRef.current) {
        try { recognition.start(); } catch {}
      } else {
        setRecording(false);
      }
    };

    recognitionRef.current = recognition;
    setRecording(true);

    try {
      recognition.start();
    } catch {
      setRecording(false);
    }
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
      }
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      title={recording ? t('voiceRecord.stopRecording') : t('voiceRecord.recordVoice')}
      className={`
        flex items-center justify-center w-7 h-7 rounded-full border transition-all active:scale-95
        ${recording
          ? 'text-red-500 border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
          : 'text-bolt-elements-textSecondary border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary hover:border-bolt-elements-textPrimary/40 hover:bg-bolt-elements-item-backgroundActive'}
      `}
    >
      {recording ? (
        <div className="i-ph:microphone-slash text-[13px]" />
      ) : (
        <div className="i-ph:microphone text-[13px]" />
      )}
    </button>
  );
});
