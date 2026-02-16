import { useState, useCallback, useRef } from 'react';
import type { ChatSource } from '@/types/chat';

interface StreamParams {
  message: string;
  session_id: string;
  model?: string;
  use_rag?: boolean;
  meeting_ids?: string[];
}

interface StreamResult {
  content: string;
  sources: ChatSource[];
  session_id: string;
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamedText, setCurrentStreamedText] = useState('');
  const [streamedSources, setStreamedSources] = useState<ChatSource[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (params: StreamParams): Promise<StreamResult | null> => {
      setIsStreaming(true);
      setCurrentStreamedText('');
      setStreamedSources([]);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const body: Record<string, unknown> = {
          message: params.message,
          session_id: params.session_id,
          model: params.model,
          use_rag: params.use_rag ?? false,
        };

        if (params.meeting_ids?.length) {
          body.meeting_ids = params.meeting_ids;
        }

        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullText = '';
        let allSources: ChatSource[] = [];
        let sessionId = params.session_id;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === 'token' && event.content) {
                fullText += event.content;
                setCurrentStreamedText(fullText);
              } else if (event.type === 'context' && event.sources) {
                const mapped: ChatSource[] = event.sources.map((s: any) => ({
                  segment_id: s.meeting_id || '',
                  speaker_name: s.speaker || '',
                  text: s.text || '',
                  start_time: s.start_time || 0,
                  meeting_title: s.meeting_title || '',
                  score: s.distance ? 1 / (1 + s.distance) : 0,
                }));
                allSources = mapped;
                setStreamedSources(mapped);
              } else if (event.type === 'done') {
                sessionId = event.session_id || sessionId;
              } else if (event.type === 'error') {
                throw new Error(event.message || 'Stream error');
              }
            } catch (parseErr) {
              // Skip non-JSON lines
              if (parseErr instanceof SyntaxError) continue;
              throw parseErr;
            }
          }
        }

        setIsStreaming(false);
        return { content: fullText, sources: allSources, session_id: sessionId };
      } catch (err: any) {
        if (err.name === 'AbortError') {
          setIsStreaming(false);
          return null;
        }
        const msg = err.message || 'Failed to stream response';
        setError(msg);
        setIsStreaming(false);
        return null;
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  return {
    sendMessage,
    isStreaming,
    currentStreamedText,
    streamedSources,
    error,
    cancelStream,
  };
}

export default useChatStream;
