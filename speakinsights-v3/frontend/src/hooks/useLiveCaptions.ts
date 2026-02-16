import { useState, useCallback, useRef, useEffect } from 'react';

interface UseLiveCaptionsOptions {
  enabled: boolean;
  language?: string;
  participantName: string;
  /** Called when a final caption is produced */
  onCaption?: (text: string, speaker: string) => void;
}

interface CaptionEntry {
  id: string;
  text: string;
  speaker: string;
  timestamp: number;
  isFinal: boolean;
}

// ── Browser Speech Recognition types ──
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
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as
    | (new () => SpeechRecognitionType)
    | null;
}

/**
 * Browser Web Speech API hook for instant English captions.
 *
 * - Uses SpeechRecognition (Chrome/Edge) for real-time speech-to-text
 * - Provides interim (typing) and final captions
 * - Auto-restarts on silence (Speech API stops after pause)
 * - Sends final captions to transcript WebSocket via onCaption callback
 * - Can be toggled on/off by the user from MeetingControls
 */
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
  const intentionalStopRef = useRef(false);

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

  // ── Check browser support on mount ──
  useEffect(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      setIsSupported(false);
      setError('Speech recognition not supported. Use Chrome or Edge.');
      console.warn('[SpeakInsights] Speech recognition not supported in this browser');
    } else {
      console.log('[SpeakInsights] Speech recognition is supported');
    }
  }, []);

  // ── Stop listening ──
  const stopListening = useCallback(() => {
    intentionalStopRef.current = true;

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
    console.log('[SpeakInsights] Live captions stopped');
  }, []);

  // ── Start listening ──
  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      setError('Speech recognition not supported. Use Chrome or Edge.');
      return;
    }

    // Stop any existing instance
    stopListening();
    intentionalStopRef.current = false;

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
      console.log('[SpeakInsights] Live captions started (lang:', language, ')');
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

      // Update current (interim) caption — shows real-time typing effect
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

        setCaptions((prev) => [...prev.slice(-50), entry]); // Keep last 50
        setCurrentCaption('');

        // Send to transcript WebSocket via callback
        onCaptionRef.current?.(finalTranscript.trim(), participantNameRef.current);

        console.log(
          '[SpeakInsights] Final caption:',
          finalTranscript.trim().substring(0, 60)
        );
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
        console.error('[SpeakInsights] Microphone access denied for captions');
        return;
      }

      console.warn('[SpeakInsights] Speech recognition error:', event.error);

      // Attempt restart after 1 second for recoverable errors
      if (!intentionalStopRef.current && enabledRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !intentionalStopRef.current) {
            console.log('[SpeakInsights] Restarting captions after error...');
            try {
              recognition.start();
            } catch {
              // Ignore
            }
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still enabled (speech API stops after silence)
      if (enabledRef.current && !intentionalStopRef.current) {
        restartTimeoutRef.current = setTimeout(() => {
          if (enabledRef.current && !intentionalStopRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
              console.log('[SpeakInsights] Captions auto-restarted after silence');
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
      console.error('[SpeakInsights] Failed to start speech recognition:', err);
      setError('Failed to start speech recognition.');
    }
  }, [language, stopListening]);

  // ── Toggle captions (convenience for MeetingControls) ──
  const toggleCaptions = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // ── Auto-start/stop based on enabled prop ──
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

  // ── Clear all captions ──
  const clearCaptions = useCallback(() => {
    setCaptions([]);
    setCurrentCaption('');
  }, []);

  return {
    /** Current interim caption (updates rapidly as user speaks) */
    currentCaption,
    /** Array of finalized caption entries */
    captions,
    /** Whether the speech recognition is actively listening */
    isListening,
    /** Whether the browser supports the Speech Recognition API */
    isSupported,
    /** Current error message, if any */
    error,
    /** Manually start listening */
    startListening,
    /** Manually stop listening */
    stopListening,
    /** Toggle captions on/off (for MeetingControls button) */
    toggleCaptions,
    /** Clear all accumulated captions */
    clearCaptions,
  };
}

export default useLiveCaptions;
