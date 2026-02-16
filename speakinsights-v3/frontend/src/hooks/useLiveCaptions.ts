import { useState, useCallback, useRef, useEffect } from 'react';

interface UseLiveCaptionsOptions {
  enabled: boolean;
  language?: string;
  participantName: string;
  onCaption?: (text: string, speaker: string) => void;
}

interface CaptionEntry {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
  isFinal: boolean;
}

// Extend window for browser Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionType) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useLiveCaptions({
  enabled,
  language = 'en-US',
  participantName,
  onCaption,
}: UseLiveCaptionsOptions) {
  const [currentCaption, setCurrentCaption] = useState('');
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabledRef = useRef(enabled);
  const onCaptionRef = useRef(onCaption);
  const participantNameRef = useRef(participantName);

  // Keep refs current
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    onCaptionRef.current = onCaption;
  }, [onCaption]);
  useEffect(() => {
    participantNameRef.current = participantName;
  }, [participantName]);

  // Check browser support
  useEffect(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      setIsSupported(false);
      setError('Speech recognition not supported. Use Chrome or Edge.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // already stopped
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
    setCurrentCaption('');
  }, []);

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    // Stop any existing instance
    stopListening();

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update current (interim) caption
      if (interimTranscript) {
        setCurrentCaption(interimTranscript);
      }

      // On final result, add to captions list and send via callback
      if (finalTranscript.trim()) {
        const entry: CaptionEntry = {
          id: `caption-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          text: finalTranscript.trim(),
          speaker: participantNameRef.current,
          timestamp: Date.now(),
          isFinal: true,
        };
        setCaptions((prev) => [...prev.slice(-50), entry]); // keep last 50
        setCurrentCaption('');
        onCaptionRef.current?.(finalTranscript.trim(), participantNameRef.current);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are expected — don't treat as errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
        setIsListening(false);
        return;
      }
      console.warn('[LiveCaptions] Error:', event.error);
    };

    recognition.onend = () => {
      // Auto-restart if still enabled (speech recognition stops after silence)
      if (enabledRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              // Ignore start errors during restart
            }
          }
        }, 200);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.error('[LiveCaptions] Failed to start:', err);
      setError('Failed to start speech recognition.');
    }
  }, [language, stopListening]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && isSupported) {
      startListening();
    } else {
      stopListening();
    }
    return () => {
      stopListening();
    };
  }, [enabled, isSupported, startListening, stopListening]);

  const clearCaptions = useCallback(() => {
    setCaptions([]);
    setCurrentCaption('');
  }, []);

  return {
    currentCaption,
    captions,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    clearCaptions,
  };
}

export default useLiveCaptions;
