import { memo, useState, useRef, useCallback, useEffect } from 'react';

interface VoiceRecordButtonProps {
  onTranscript: (text: string) => void;
}

export const VoiceRecordButton = memo(function VoiceRecordButton({ onTranscript }: VoiceRecordButtonProps) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const hasSR = !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
    const hasMedia = !!(navigator.mediaDevices?.getUserMedia);
    setSupported(hasSR || hasMedia);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());

        if (chunksRef.current.length === 0) return;

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });

        // Try Web Speech API first
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
          try {
            setTranscribing(true);
            const recognition = new SpeechRecognition();
            recognition.lang = 'pt-BR';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event: any) => {
              const transcript = event.results[0]?.[0]?.transcript || '';
              if (transcript) {
                onTranscript(transcript);
              }
              setTranscribing(false);
            };

            recognition.onerror = () => {
              setTranscribing(false);
            };

            recognition.onend = () => {
              setTranscribing(false);
            };

            // Create a new audio from the blob for the recognition
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(() => {});
            recognition.start();
            setTimeout(() => recognition.stop(), 30000);
            return;
          } catch {
            // Fall through to whisper-style if available
          }
        }

        setTranscribing(false);
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      // Microphone not available
    }
  }, [onTranscript]);

  useEffect(() => {
    if (recording) {
      const timeout = setTimeout(stopRecording, 60000); // Max 60s
      return () => clearTimeout(timeout);
    }
  }, [recording, stopRecording]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={recording ? stopRecording : startRecording}
      title={recording ? 'Parar gravacao' : transcribing ? 'Transcrevendo...' : 'Gravar voz'}
      className={`
        flex items-center justify-center w-8 h-8 rounded-lg transition-all active:scale-95
        ${recording
          ? 'text-red-400 hover:text-red-300 bg-red-500/15 hover:bg-red-500/25 animate-pulse'
          : transcribing
            ? 'text-bolt-elements-item-contentAccent bg-bolt-elements-item-backgroundAccent'
            : 'text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive'}
      `}
      disabled={transcribing}
    >
      {transcribing ? (
        <div className="i-svg-spinners:90-ring-with-bg text-sm" />
      ) : recording ? (
        <div className="i-ph:microphone-slash text-base" />
      ) : (
        <div className="i-ph:microphone text-base" />
      )}
    </button>
  );
});
