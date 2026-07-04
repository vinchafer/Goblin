'use client';

/**
 * Dictation for the chat composer (Sprint CHAT-IO C1).
 *
 * Two paths, resolved once per device:
 *  - 'speech'  — Web Speech API (desktop Chrome, Android Chrome): live interim
 *                results streamed into the composer, tap-to-stop.
 *  - 'server'  — MediaRecorder → POST /api/transcribe (iOS Safari, and any
 *                browser without a usable SpeechRecognition): record, then
 *                transcribe server-side (Whisper). No interim; result lands
 *                after processing.
 *
 * The result is only ever inserted into the composer — it NEVER auto-sends.
 * This hook does not touch the textarea's key events, so native iOS keyboard
 * dictation keeps working independently.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL, getAuthHeaders } from '@/lib/api';

export type DictationMode = 'speech' | 'server';
export type DictationStatus = 'idle' | 'listening' | 'processing' | 'error';

interface UseDictationOptions {
  lang: 'de' | 'en';
  /** Called on start so the caller can snapshot the caret position. */
  onStart?: () => void;
  /** Full dictated text for the current session (speech: cumulative incl. interim). */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Honest, user-facing message (already localized). */
  onError?: (message: string) => void;
}

// Server-path recording ceiling — matches the endpoint's ~2 min cap.
const MAX_RECORD_MS = 120_000;

function detectMode(): DictationMode {
  if (typeof window === 'undefined') return 'server';
  const hasSR = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports as MacIntel with touch — treat as iOS.
  const isIOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  // iOS Safari's webkitSpeechRecognition is unreliable (Siri-gated, often silent);
  // route iOS through the server path. Everything else with SR uses live speech.
  return !isIOS && hasSR ? 'speech' : 'server';
}

export function useDictation({ lang, onStart, onTranscript, onError }: UseDictationOptions) {
  const [status, setStatus] = useState<DictationStatus>('idle');
  const [mode, setMode] = useState<DictationMode>('server');

  const recognitionRef = useRef<any | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMode(detectMode());
  }, []);

  const fail = useCallback(
    (msg: string) => {
      setStatus('error');
      onError?.(msg);
      setTimeout(() => setStatus('idle'), 2500);
    },
    [onError],
  );

  // ── Speech path ──────────────────────────────────────────────────────────────
  const startSpeech = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: any = new SR();
    recognition.lang = lang === 'en' ? 'en-US' : 'de-DE';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (e: any) => {
      let finalStr = '';
      let interimStr = '';
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0]?.transcript ?? '';
        if (e.results[i].isFinal) finalStr += chunk;
        else interimStr += chunk;
      }
      const full = (finalStr + interimStr).trim();
      onTranscript(full, interimStr === '');
    };
    recognition.onerror = (e: any) => {
      if (e?.error === 'no-speech' || e?.error === 'aborted') {
        setStatus('idle');
        return;
      }
      fail(lang === 'en' ? "Couldn't hear you — please try again." : 'Ich konnte dich nicht hören — bitte nochmal.');
    };
    recognition.onend = () => setStatus((s) => (s === 'error' ? s : 'idle'));

    recognitionRef.current = recognition;
    onStart?.();
    try {
      recognition.start();
    } catch {
      fail(lang === 'en' ? "Couldn't start dictation." : 'Diktat konnte nicht gestartet werden.');
    }
  }, [lang, onStart, onTranscript, fail]);

  // ── Server path ──────────────────────────────────────────────────────────────
  const uploadRecording = useCallback(
    async (blob: Blob, durationMs: number) => {
      setStatus('processing');
      try {
        const headers = await getAuthHeaders();
        const authHeader = (headers as Record<string, string>)['Authorization'];
        const fd = new FormData();
        fd.append('audio', blob, 'dictation.webm');
        fd.append('lang', lang);
        fd.append('durationMs', String(Math.round(durationMs)));
        const res = await fetch(`${API_URL}/api/transcribe`, {
          method: 'POST',
          headers: authHeader ? { Authorization: authHeader } : undefined,
          body: fd,
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          fail(body.error || (lang === 'en' ? 'Transcription failed — please try again.' : 'Transkription fehlgeschlagen — bitte nochmal.'));
          return;
        }
        const body = (await res.json()) as { text: string };
        onStart?.();
        onTranscript(body.text.trim(), true);
        setStatus('idle');
      } catch {
        fail(lang === 'en' ? 'Transcription failed — please try again.' : 'Transkription fehlgeschlagen — bitte nochmal.');
      }
    },
    [lang, onStart, onTranscript, fail],
  );

  const startServer = useCallback(async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      fail(lang === 'en' ? 'No microphone access.' : 'Kein Mikrofonzugriff.');
      return;
    }
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    chunksRef.current = [];
    const startedAt = Date.now();
    mr.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      if (blob.size === 0) {
        setStatus('idle');
        return;
      }
      void uploadRecording(blob, Date.now() - startedAt);
    };
    mr.start();
    setStatus('listening');
    stopTimerRef.current = setTimeout(() => {
      if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
    }, MAX_RECORD_MS);
  }, [lang, uploadRecording, fail]);

  // ── Public controls ────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (status === 'listening' || status === 'processing') return;
    if (mode === 'speech') startSpeech();
    else void startServer();
  }, [mode, status, startSpeech, startServer]);

  const stop = useCallback(() => {
    if (mode === 'speech') {
      recognitionRef.current?.stop();
    } else if (mediaRef.current?.state === 'recording') {
      mediaRef.current.stop();
    }
  }, [mode]);

  const toggle = useCallback(() => {
    if (status === 'listening') stop();
    else if (status === 'idle') start();
  }, [status, start, stop]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      if (mediaRef.current?.state === 'recording') mediaRef.current.stop();
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    };
  }, []);

  return { status, mode, toggle, start, stop };
}
