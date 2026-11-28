import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSTTTranscript } from '../services/speechApi';
import { encodePCMToWav16k } from '../utils/audioWav';

export function useVoiceDictation({
  currentLanguageRef,
  showErrorToast,
  onTranscript,
  isLiveActiveRef,
  closeLiveMode
}) {
  const [dictationState, setDictationState] = useState('idle'); // 'idle' | 'listening' | 'transcribing'

  const isDictatingRef = useRef(false);
  const isTranscribingRef = useRef(false);
  const sessionIdRef = useRef(0);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const gainRef = useRef(null);
  const chunksRef = useRef([]);
  const speechStartedRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastSpeechTimeRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const recognitionRef = useRef(null);

  const releaseDictationAudio = useCallback(() => {
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      gainRef.current?.disconnect();
      ctxRef.current?.close();
    } catch {}
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    ctxRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  const cancelVoiceDictation = useCallback(() => {
    sessionIdRef.current += 1;
    isDictatingRef.current = false;
    isTranscribingRef.current = false;
    chunksRef.current = [];
    speechStartedRef.current = false;
    releaseDictationAudio();
    setDictationState('idle');
  }, [releaseDictationAudio]);

  const finishVoiceDictation = useCallback(
    async (manualStop = false) => {
      if (!isDictatingRef.current) return;
      const session = sessionIdRef.current;
      isDictatingRef.current = false;

      const captured = [...chunksRef.current];
      const sr = ctxRef.current?.sampleRate || 16000;
      const hadSpeech = speechStartedRef.current;
      const durationSec = (captured.length * 4096) / sr;

      chunksRef.current = [];
      speechStartedRef.current = false;
      releaseDictationAudio();

      if (!captured.length || durationSec < 0.3 || (!hadSpeech && !manualStop)) {
        setDictationState('idle');
        if (manualStop) showErrorToast('No speech detected. Try speaking closer to the mic.');
        return;
      }

      isTranscribingRef.current = true;
      setDictationState('transcribing');
      try {
        const wavBlob = encodePCMToWav16k(captured, sr);
        const transcript = await fetchSTTTranscript(wavBlob, 'auto', true);
        if (session !== sessionIdRef.current) return;
        if (!onTranscript(transcript)) {
          showErrorToast("Didn't catch that. Please try speaking again.");
        }
      } catch (err) {
        if (session !== sessionIdRef.current) return;
        showErrorToast(err?.name === 'AbortError' ? 'Speech recognition timed out.' : 'Speech-to-text error. Please try again.');
      } finally {
        if (session === sessionIdRef.current) {
          isTranscribingRef.current = false;
          setDictationState('idle');
        }
      }
    },
    [onTranscript, releaseDictationAudio, showErrorToast]
  );

  const startBrowserSpeechFallback = useCallback(
    (session) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        showErrorToast('Microphone is not supported in this browser.');
        cancelVoiceDictation();
        return;
      }
      const rec = new SR();
      recognitionRef.current = rec;
      const lang = currentLanguageRef.current;
      rec.lang = lang === 'te' ? 'te-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let gotResult = false;
      rec.onresult = (event) => {
        if (session !== sessionIdRef.current) return;
        const transcript = Array.from(event.results || [])
          .map((r) => r[0]?.transcript || '')
          .join(' ')
          .trim();
        if (onTranscript(transcript)) gotResult = true;
      };
      rec.onerror = () => {
        if (session !== sessionIdRef.current) return;
        showErrorToast('Microphone permission denied or unavailable.');
        cancelVoiceDictation();
      };
      rec.onend = () => {
        if (session !== sessionIdRef.current) return;
        isDictatingRef.current = false;
        recognitionRef.current = null;
        setDictationState('idle');
        if (!gotResult) showErrorToast('No speech detected. Please try again.');
      };
      try {
        rec.start();
      } catch {
        showErrorToast('Unable to start speech recognition.');
        cancelVoiceDictation();
      }
    },
    [cancelVoiceDictation, currentLanguageRef, onTranscript, showErrorToast]
  );

  const toggleVoiceDictation = useCallback(async () => {
    if (isTranscribingRef.current) return;
    if (isDictatingRef.current) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          cancelVoiceDictation();
        }
      } else {
        await finishVoiceDictation(true);
      }
      return;
    }

    if (isLiveActiveRef?.current) closeLiveMode?.();

    const session = ++sessionIdRef.current;
    isDictatingRef.current = true;
    chunksRef.current = [];
    speechStartedRef.current = false;
    startTimeRef.current = Date.now();
    setDictationState('listening');

    if (!navigator.mediaDevices?.getUserMedia) {
      startBrowserSpeechFallback(session);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      if (session !== sessionIdRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const AC = window.AudioContext || window.webkitAudioContext;
      const ctx = new AC();
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);

      sourceRef.current = source;
      processorRef.current = processor;
      gainRef.current = gain;

      processor.onaudioprocess = (event) => {
        if (!isDictatingRef.current || session !== sessionIdRef.current) return;
        const copy = new Float32Array(event.inputBuffer.getChannelData(0));
        let sum = 0;
        for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
        const rms = Math.sqrt(sum / copy.length);
        const now = Date.now();

        chunksRef.current.push(copy);
        if (rms > 0.012) {
          if (!speechStartedRef.current) {
            speechStartedRef.current = true;
            speechStartTimeRef.current = now;
          }
          lastSpeechTimeRef.current = now;
        } else if (speechStartedRef.current) {
          if (now - lastSpeechTimeRef.current > 1600 || now - speechStartTimeRef.current > 30000) {
            finishVoiceDictation(false);
          }
        } else if (now - startTimeRef.current > 20000) {
          finishVoiceDictation(false);
        }
      };
    } catch {
      if (session !== sessionIdRef.current) return;
      showErrorToast('Microphone permission denied.');
      cancelVoiceDictation();
    }
  }, [cancelVoiceDictation, closeLiveMode, finishVoiceDictation, isLiveActiveRef, showErrorToast, startBrowserSpeechFallback]);

  useEffect(() => {
    return () => cancelVoiceDictation();
  }, [cancelVoiceDictation]);

  return {
    dictationState,
    toggleVoiceDictation,
    cancelVoiceDictation
  };
}
