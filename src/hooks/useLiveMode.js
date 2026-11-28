import { useCallback, useEffect, useRef, useState } from 'react';
import { API_ENDPOINTS } from '../config/endpoints';
import { LANG_NAME_MAP, TELUGU_LIVE_STATUS_TEXT, buildLiveSystemPrompt } from '../config/prompts';
import { callLiveChatModel, streamLiveChatModel } from '../services/chatApi';
import { warmNakshatraLocation } from '../services/locationService';
import { fetchSTTWithMeta, fetchTtsChunkAudio } from '../services/speechApi';
import { encodePCMToWav16k } from '../utils/audioWav';
import {
  analyzeLanguageSignal,
  getLangDirective,
  isLiveReplyLanguageMismatch,
  resolveTtsVoice
} from '../utils/language';
import { cleanTeluguOutput, sanitizeForSpeech, splitSpeechChunks } from '../utils/textCleaners';

/* ------------------------------------------------------------------ */
/* LATENCY / CALL-FEEL TUNING KNOBS (change these to fine-tune)        */
/* ------------------------------------------------------------------ */
const FRAME_SIZE = 1024; // mic frame size (smaller = faster reaction, ~21ms at 48kHz)

// End-of-speech detection (lower = faster replies, but may cut slow speakers)
const SILENCE_HANG_SHORT_MS = 380; // silence needed to end a short sentence
const SILENCE_HANG_LONG_MS = 480; // silence needed to end a long sentence
const MAX_UTTERANCE_MS = 12000;

// Barge-in: user can interrupt AI by just talking (like a real phone call)
const BARGE_IN_ENABLED = true; // set false if loudspeaker echo causes false interrupts
const BARGE_IN_MIN_RMS = 0.045; // mic loudness needed to interrupt while AI speaks
const BARGE_IN_SPEAKING_MS = 260; // sustained voice needed to interrupt AI speech
const BARGE_IN_THINKING_MS = 200; // sustained voice needed to interrupt while thinking
const BARGE_IN_GRACE_MS = 700; // ignore interrupts right after AI starts speaking

const RESTART_LISTEN_DELAY_MS = 60; // delay before listening again after AI finishes
const AFTER_AI_COOLDOWN_MS = 150; // ignore tiny echo tail right after AI audio ends
const LIVE_HISTORY_TURNS = 6;

const GENERIC_PLACEHOLDERS_RE =
  /^(Connecting\.\.\.|Listening\.\.\.|Thinking\.\.\.|కనెక్ట్ అవుతోంది\.\.\.|ఏంటి విశేషాలు\?|వింటున్నాను\.\.\.|ఆలోచిస్తున్నాను\.\.\.)$/i;

function createAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC({ latencyHint: 'interactive' });
  } catch {
    return new AC();
  }
}

export function useLiveMode({
  conversationHistoryRef,
  currentLanguageRef,
  appendUserMessage,
  appendCompletedAIMessage,
  showErrorToast,
  onBeforeOpen
}) {
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveState, setLiveState] = useState('listening'); // 'listening' | 'thinking' | 'speaking'
  const [liveStatusText, setLiveStatusText] = useState('Listening');
  const [liveTranscript, setLiveTranscript] = useState('');
  const [tapBlink, setTapBlink] = useState(false);
  const [liveLangMode, setLiveLangMode] = useState('auto');

  const liveOrbGlowRef = useRef(null);
  const livePlayerRef = useRef(null);

  const isLiveActiveRef = useRef(false);
  const isAITalkingRef = useRef(false);
  const isProcessingTurnRef = useRef(false);
  const liveLangModeRef = useRef('auto');
  const currentAudioSourceRef = useRef(null);
  const currentBlobUrlRef = useRef(null);
  const activeAudioSourcesRef = useRef([]);
  const liveTurnAbortCtrlRef = useRef(null);
  const livePlaybackSessionRef = useRef(0);
  const liveAnalyserNodeRef = useRef(null);
  const livePulseRafIdRef = useRef(null);
  const liveNoiseFloorRef = useRef(0.006);

  const mediaStreamRef = useRef(null);
  const recorderCtxRef = useRef(null);
  const micSourceNodeRef = useRef(null);
  const processorNodeRef = useRef(null);
  const silentGainNodeRef = useRef(null);

  const preSpeechBufferRef = useRef([]);
  const pcmChunksRef = useRef([]);
  const speechStartedRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const activeSpeechFramesRef = useRef(0);
  const lastSpeechChunkIdxRef = useRef(0);

  const bargeMsRef = useRef(0);
  const aiSpeechStartedAtRef = useRef(0);
  const lastAIEndAtRef = useRef(0);

  const playbackAudioCtxRef = useRef(null);
  const keepAliveOscRef = useRef(null);
  const keepAliveGainRef = useRef(null);

  const lastLiveTurnLangRef = useRef(null);
  const livePendingLangRef = useRef(null);
  const livePendingCountRef = useRef(0);
  const tapBlinkTimerRef = useRef(null);

  const updateLiveDisplay = useCallback((state, badgeText, transcriptText) => {
    setLiveState(state || 'listening');
    const upper = String(badgeText || '').toUpperCase();
    if (upper === 'CONNECTING...') setLiveStatusText('Connecting...');
    else if (upper === 'MIC BLOCKED') setLiveStatusText('Microphone access needed');
    else if (state === 'thinking') setLiveStatusText('Thinking');
    else if (state === 'speaking') setLiveStatusText('Speaking');
    else setLiveStatusText('Listening');

    const raw = String(transcriptText || '').trim();
    setLiveTranscript(GENERIC_PLACEHOLDERS_RE.test(raw) ? '' : raw);
  }, []);

  const getPlaybackAudioContext = useCallback(() => {
    if (!playbackAudioCtxRef.current) {
      const ctx = createAudioContext();
      if (ctx) playbackAudioCtxRef.current = ctx;
    }
    return playbackAudioCtxRef.current;
  }, []);

  const ensurePlaybackUnlocked = useCallback(() => {
    try {
      const ctx = getPlaybackAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!keepAliveOscRef.current) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.00001;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        keepAliveOscRef.current = osc;
        keepAliveGainRef.current = gain;
      }
    } catch {}
  }, [getPlaybackAudioContext]);

  const ensureLivePlaybackNodes = useCallback((ctx) => {
    if (!liveAnalyserNodeRef.current || liveAnalyserNodeRef.current.context !== ctx) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(ctx.destination);
      liveAnalyserNodeRef.current = analyser;
    }
    return liveAnalyserNodeRef.current;
  }, []);

  // When barge-in is OFF we mute the mic while AI talks (old behaviour).
  // When barge-in is ON the mic stays open so the user can interrupt like a real call.
  const pauseMicForAI = useCallback(() => {
    aiSpeechStartedAtRef.current = Date.now();
    bargeMsRef.current = 0;
    if (BARGE_IN_ENABLED) return;
    if (mediaStreamRef.current) mediaStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
    if (recorderCtxRef.current?.state === 'running') recorderCtxRef.current.suspend().catch(() => {});
  }, []);

  const stopOrbVoicePulse = useCallback(() => {
    if (livePulseRafIdRef.current) {
      cancelAnimationFrame(livePulseRafIdRef.current);
      livePulseRafIdRef.current = null;
    }
    const glow = liveOrbGlowRef.current;
    if (glow) {
      glow.style.transform = '';
      glow.style.opacity = '';
    }
  }, []);

  const startOrbVoicePulse = useCallback(
    (analyser) => {
      stopOrbVoicePulse();
      const glow = liveOrbGlowRef.current;
      if (!analyser || !glow) return;
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!isAITalkingRef.current || !isLiveActiveRef.current) {
          stopOrbVoicePulse();
          return;
        }
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.min(1, Math.sqrt(sum / buf.length) * 3.4);
        glow.style.transform = `scale(${(1.12 + rms * 0.28).toFixed(3)})`;
        glow.style.opacity = `${(0.86 + rms * 0.14).toFixed(3)}`;
        livePulseRafIdRef.current = requestAnimationFrame(tick);
      };
      livePulseRafIdRef.current = requestAnimationFrame(tick);
    },
    [stopOrbVoicePulse]
  );

  const stopAudioPlayback = useCallback(() => {
    livePlaybackSessionRef.current += 1;
    lastAIEndAtRef.current = Date.now();
    stopOrbVoicePulse();
    if (activeAudioSourcesRef.current.length) {
      for (const src of activeAudioSourcesRef.current) {
        try {
          src.onended = null;
          src.stop();
          src.disconnect();
        } catch {}
      }
      activeAudioSourcesRef.current = [];
    }
    try {
      currentAudioSourceRef.current?.stop();
    } catch {}
    currentAudioSourceRef.current = null;

    const player = livePlayerRef.current;
    if (player) {
      player.pause();
      player.currentTime = 0;
      player.onended = null;
      player.onerror = null;
    }
    if (currentBlobUrlRef.current) {
      URL.revokeObjectURL(currentBlobUrlRef.current);
      currentBlobUrlRef.current = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    isAITalkingRef.current = false;
  }, [stopOrbVoicePulse]);

  const resolveLiveTurnLanguage = useCallback(
    (transcript, sttMeta = null) => {
      const activeLang = lastLiveTurnLangRef.current || currentLanguageRef.current || 'en';
      if (liveLangModeRef.current === 'te' || liveLangModeRef.current === 'en') {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return liveLangModeRef.current;
      }

      const sig = analyzeLanguageSignal(transcript, true, sttMeta, activeLang, liveLangModeRef.current);
      const acCode = String(sttMeta?.languageCode || '')
        .toLowerCase()
        .split('-')[0]
        .replace(/^od$/, 'or');
      const acProb = Number(sttMeta?.languageProbability || 0);
      const wordCount = transcript.trim().split(/\s+/).length;

      if (
        sig.strength !== 'explicit' &&
        sig.strength !== 'neutral' &&
        sig.strength !== 'weak_noise' &&
        sig.lang !== activeLang &&
        ((acCode === sig.lang && acProb >= 0.7 && wordCount >= 2) || (sig.strength === 'moderate' && wordCount >= 4))
      ) {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return sig.lang;
      }
      if (sig.strength === 'explicit') {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return sig.lang;
      }
      if (sig.strength === 'neutral' || sig.strength === 'weak_noise') {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return activeLang;
      }
      if (sig.lang === activeLang) {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return activeLang;
      }
      if (sig.strength === 'strong' || (!lastLiveTurnLangRef.current && sig.strength === 'moderate')) {
        livePendingLangRef.current = null;
        livePendingCountRef.current = 0;
        return sig.lang;
      }
      if (sig.strength === 'moderate') {
        if (livePendingLangRef.current === sig.lang) {
          livePendingCountRef.current += 1;
        } else {
          livePendingLangRef.current = sig.lang;
          livePendingCountRef.current = 1;
        }
        if (livePendingCountRef.current >= 2) {
          livePendingLangRef.current = null;
          livePendingCountRef.current = 0;
          return sig.lang;
        }
        return activeLang;
      }
      livePendingLangRef.current = null;
      livePendingCountRef.current = 0;
      return activeLang;
    },
    [currentLanguageRef]
  );

  // Forward declarations via refs to break circular async callback dependencies cleanly
  const startContinuousListeningRef = useRef(null);

  const scheduleListenRestart = useCallback((delay = RESTART_LISTEN_DELAY_MS) => {
    lastAIEndAtRef.current = Date.now();
    if (!isLiveActiveRef.current) return;
    setTimeout(() => {
      if (isLiveActiveRef.current && !isAITalkingRef.current) startContinuousListeningRef.current?.();
    }, delay);
  }, []);

  const fallbackBrowserSpeech = useCallback(
    (text, lang = currentLanguageRef.current) => {
      return new Promise((resolve) => {
        const done = () => {
          isAITalkingRef.current = false;
          scheduleListenRestart();
          resolve();
        };
        if ('speechSynthesis' in window) {
          const localeMap = {
            en: 'en-IN',
            te: 'te-IN',
            hi: 'hi-IN',
            mr: 'mr-IN',
            ta: 'ta-IN',
            ml: 'ml-IN',
            kn: 'kn-IN',
            bn: 'bn-IN',
            gu: 'gu-IN',
            pa: 'pa-IN',
            or: 'or-IN',
            es: 'es-ES',
            fr: 'fr-FR',
            de: 'de-DE',
            ar: 'ar-SA',
            ja: 'ja-JP',
            ko: 'ko-KR',
            zh: 'zh-CN'
          };
          const u = new SpeechSynthesisUtterance(text);
          u.lang = localeMap[lang] || 'en-IN';
          isAITalkingRef.current = true;
          pauseMicForAI();
          updateLiveDisplay('speaking', 'SPEAKING', `"${text}"`);
          u.onend = u.onerror = done;
          window.speechSynthesis.speak(u);
        } else {
          done();
        }
      });
    },
    [currentLanguageRef, pauseMicForAI, scheduleListenRestart, updateLiveDisplay]
  );

  const playAudioBuffersSequentialWithElement = useCallback(
    async (items, displayText, signal) => {
      stopAudioPlayback();
      const mySession = livePlaybackSessionRef.current;
      isAITalkingRef.current = true;
      pauseMicForAI();
      updateLiveDisplay('speaking', 'SPEAKING', `"${displayText}"`);

      const player = livePlayerRef.current;
      for (const item of items) {
        if (mySession !== livePlaybackSessionRef.current || !isLiveActiveRef.current || (signal && signal.aborted)) return;
        await new Promise(async (resolve) => {
          let done = false;
          const finish = () => {
            if (done) return;
            done = true;
            if (currentBlobUrlRef.current) {
              URL.revokeObjectURL(currentBlobUrlRef.current);
              currentBlobUrlRef.current = null;
            }
            resolve();
          };
          try {
            if (!player) {
              finish();
              return;
            }
            currentBlobUrlRef.current = URL.createObjectURL(
              new Blob([item.arrayBuffer], { type: item.mimeType || 'audio/mpeg' })
            );
            player.src = currentBlobUrlRef.current;
            player.onended = finish;
            player.onerror = finish;
            await player.play();
          } catch (err) {
            console.warn('Live element playback error:', err);
            finish();
          }
        });
      }

      if (mySession === livePlaybackSessionRef.current) {
        isAITalkingRef.current = false;
        scheduleListenRestart();
      }
    },
    [pauseMicForAI, scheduleListenRestart, stopAudioPlayback, updateLiveDisplay]
  );

  const playPipelinedChunksWebAudio = useCallback(
    async (chunkPromises, firstAudio, displayText, signal) => {
      const ctx = getPlaybackAudioContext();
      if (!ctx || typeof ctx.decodeAudioData !== 'function') return false;

      stopAudioPlayback();
      const mySession = livePlaybackSessionRef.current;
      isAITalkingRef.current = true;
      pauseMicForAI();
      updateLiveDisplay('speaking', 'SPEAKING', `"${displayText}"`);
      if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

      const destNode = ensureLivePlaybackNodes(ctx);
      startOrbVoicePulse(liveAnalyserNodeRef.current);

      let nextScheduleTime = ctx.currentTime + 0.01;
      let lastSource = null;
      let scheduledCount = 0;

      for (let i = 0; i < chunkPromises.length; i++) {
        if (mySession !== livePlaybackSessionRef.current || !isLiveActiveRef.current || (signal && signal.aborted)) {
          return true;
        }
        let item = null;
        try {
          item = i === 0 ? firstAudio : await chunkPromises[i];
        } catch (err) {
          if (err?.name === 'AbortError') return true;
          console.warn(`[Live] Chunk ${i + 1} fetch error:`, err);
          continue;
        }
        if (mySession !== livePlaybackSessionRef.current || !isLiveActiveRef.current || (signal && signal.aborted)) {
          return true;
        }
        if (!item || !item.arrayBuffer) continue;

        try {
          const decoded = await ctx.decodeAudioData(item.arrayBuffer.slice(0));
          if (mySession !== livePlaybackSessionRef.current || !isLiveActiveRef.current || (signal && signal.aborted)) {
            return true;
          }

          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(destNode);
          const startAt = Math.max(ctx.currentTime + 0.01, nextScheduleTime);
          src.start(startAt);
          nextScheduleTime = startAt + decoded.duration;
          activeAudioSourcesRef.current.push(src);
          lastSource = src;
          scheduledCount++;
        } catch (err) {
          console.warn(`[Live] Chunk ${i + 1} decode error:`, err);
          if (scheduledCount === 0) {
            stopAudioPlayback();
            return false;
          }
        }
      }

      if (!scheduledCount || !lastSource) {
        stopAudioPlayback();
        return false;
      }

      await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          if (mySession === livePlaybackSessionRef.current) {
            stopOrbVoicePulse();
            activeAudioSourcesRef.current = [];
            isAITalkingRef.current = false;
            scheduleListenRestart();
          }
          resolve();
        };
        lastSource.onended = finish;
        const remainMs = Math.max(150, Math.ceil((nextScheduleTime - ctx.currentTime) * 1000) + 150);
        setTimeout(finish, remainMs);
      });
      return true;
    },
    [
      ensureLivePlaybackNodes,
      getPlaybackAudioContext,
      pauseMicForAI,
      scheduleListenRestart,
      startOrbVoicePulse,
      stopAudioPlayback,
      stopOrbVoicePulse,
      updateLiveDisplay
    ]
  );

  const speakAIResponse = useCallback(
    async (text, signal = null, hintLang = null) => {
      if (!isLiveActiveRef.current) return;
      const cleanText = sanitizeForSpeech(text);
      if (!cleanText) {
        startContinuousListeningRef.current?.();
        return;
      }

      const baseLang = hintLang || lastLiveTurnLangRef.current || currentLanguageRef.current || 'en';
      const scriptCounts = {
        te: (cleanText.match(/[\u0C00-\u0C7F]/g) || []).length,
        hi: (cleanText.match(/[\u0900-\u097F]/g) || []).length,
        ta: (cleanText.match(/[\u0B80-\u0BFF]/g) || []).length,
        ml: (cleanText.match(/[\u0D00-\u0D7F]/g) || []).length,
        kn: (cleanText.match(/[\u0C80-\u0CFF]/g) || []).length,
        bn: (cleanText.match(/[\u0980-\u09FF]/g) || []).length,
        gu: (cleanText.match(/[\u0A80-\u0AFF]/g) || []).length,
        pa: (cleanText.match(/[\u0A00-\u0A7F]/g) || []).length,
        or: (cleanText.match(/[\u0B00-\u0B7F]/g) || []).length
      };
      let bestIndic = null;
      let bestIndicCount = 0;
      for (const [code, cnt] of Object.entries(scriptCounts)) {
        if (cnt > bestIndicCount) {
          bestIndicCount = cnt;
          bestIndic = code;
        }
      }
      const latinAlphaCount = (cleanText.match(/[a-zA-Z]/g) || []).length;
      let resolvedLang = baseLang;
      if (bestIndicCount >= 3 && (bestIndicCount >= latinAlphaCount * 0.25 || latinAlphaCount < 10)) {
        resolvedLang = bestIndic === 'hi' && baseLang === 'mr' ? 'mr' : bestIndic;
      } else if (bestIndicCount >= 2 && latinAlphaCount < 6) {
        resolvedLang = bestIndic === 'hi' && baseLang === 'mr' ? 'mr' : bestIndic;
      } else {
        const replySig = analyzeLanguageSignal(cleanText, false, null, baseLang, liveLangModeRef.current);
        if (['es', 'fr', 'de', 'te', 'hi', 'ta', 'kn', 'ml'].includes(replySig.lang) && replySig.strength !== 'weak') {
          resolvedLang = replySig.lang;
        } else if (
          ['te', 'hi', 'mr', 'ta', 'ml', 'kn', 'bn', 'gu', 'pa', 'or'].includes(baseLang) &&
          bestIndicCount === 0 &&
          latinAlphaCount >= 3 &&
          replySig.lang === 'en'
        ) {
          resolvedLang = 'en';
        }
      }

      const targetLangMap = {
        en: 'en-IN',
        hi: 'hi-IN',
        mr: 'mr-IN',
        te: 'te-IN',
        ta: 'ta-IN',
        ml: 'ml-IN',
        kn: 'kn-IN',
        bn: 'bn-IN',
        gu: 'gu-IN',
        pa: 'pa-IN',
        or: 'od-IN'
      };
      const targetLang = targetLangMap[resolvedLang] || 'en-IN';
      const isRegionalV3 = ['ta', 'ml', 'kn', 'mr', 'bn', 'gu', 'pa', 'or'].includes(resolvedLang);
      const sarvamModel = isRegionalV3 ? 'bulbul:v3' : 'bulbul:v4-flash';
      const speaker = isRegionalV3
        ? 'kavitha'
        : resolvedLang === 'en'
          ? 'simran_en_conversation'
          : resolvedLang === 'hi'
            ? 'kavya_hi_conversational'
            : 'kavitha_te_conversation';
      const useElevenLabs =
        ['en', 'hi', 'es', 'fr', 'de'].includes(resolvedLang) && !/[\u0C00-\u0C7F\u0980-\u0DFF]/.test(cleanText);

      const chunks = splitSpeechChunks(cleanText);
      const ttsT0 = performance.now();
      const chunkPromises = chunks.map((ch) =>
        fetchTtsChunkAudio(ch, targetLang, speaker, useElevenLabs, signal, sarvamModel)
      );

      try {
        const firstAudio = await chunkPromises[0];
        console.log(
          `[Live] TTS chunk-1 (${firstAudio?.provider || 'none'}, lang=${resolvedLang}, ${chunks.length} chunks): ${(
            performance.now() - ttsT0
          ).toFixed(0)}ms`
        );
        if ((signal && signal.aborted) || !isLiveActiveRef.current) return;

        if (!firstAudio) {
          await fallbackBrowserSpeech(cleanText, resolvedLang);
          return;
        }

        const playedViaWebAudio = await playPipelinedChunksWebAudio(chunkPromises, firstAudio, cleanText, signal);
        if (!playedViaWebAudio && !(signal && signal.aborted) && isLiveActiveRef.current) {
          const resolvedItems = (await Promise.all(chunkPromises.map((p) => p.catch(() => null)))).filter(
            (x) => x && x.arrayBuffer
          );
          if (resolvedItems.length > 0) {
            await playAudioBuffersSequentialWithElement(resolvedItems, cleanText, signal);
          } else {
            await fallbackBrowserSpeech(cleanText, resolvedLang);
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError' || !isLiveActiveRef.current) return;
        console.warn('[Live] TTS pipeline fallback:', err);
        await fallbackBrowserSpeech(cleanText, resolvedLang);
      }
    },
    [
      currentLanguageRef,
      fallbackBrowserSpeech,
      playAudioBuffersSequentialWithElement,
      playPipelinedChunksWebAudio
    ]
  );

  const createLiveSpeaker = useCallback(
    (signal, hintLang) => {
      const ctx = getPlaybackAudioContext();
      stopAudioPlayback();
      const mySession = livePlaybackSessionRef.current;
      let buf = '';
      let voice = null;
      let count = 0;
      let cancelled = false;
      let began = false;
      const spoken = new Set();
      let nextTime = 0;
      let lastSource = null;
      let scheduled = 0;
      let chain = Promise.resolve();
      const dead = () =>
        cancelled || mySession !== livePlaybackSessionRef.current || !isLiveActiveRef.current || (signal && signal.aborted);

      function begin() {
        if (began) return;
        began = true;
        isAITalkingRef.current = true;
        pauseMicForAI();
        updateLiveDisplay('speaking', 'SPEAKING', '');
        startOrbVoicePulse(ensureLivePlaybackNodes(ctx));
        nextTime = ctx.currentTime + 0.02;
      }

      function emit(seg) {
        const clean = sanitizeForSpeech(seg);
        if (!clean || !ctx || dead()) return;
        const spokenKey = clean.toLowerCase().replace(/\s+/g, ' ');
        if (spoken.has(spokenKey)) return;
        spoken.add(spokenKey);
        if (!voice) voice = resolveTtsVoice(clean, hintLang);
        const v = voice;
        // TTS request fires immediately (parallel); playback is chained in order below
        const p = fetchTtsChunkAudio(clean, v.targetLang, v.speaker, v.useEl, signal, v.model).catch(() => null);
        chain = chain.then(async () => {
          const item = await p;
          if (!item || !item.arrayBuffer || dead()) return;
          let decoded;
          try {
            decoded = await ctx.decodeAudioData(item.arrayBuffer.slice(0));
          } catch {
            return;
          }
          if (dead()) return;
          if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
          begin();
          const src = ctx.createBufferSource();
          src.buffer = decoded;
          src.connect(ensureLivePlaybackNodes(ctx));
          const startAt = Math.max(ctx.currentTime + 0.01, nextTime);
          src.start(startAt);
          nextTime = startAt + decoded.duration;
          activeAudioSourcesRef.current.push(src);
          lastSource = src;
          scheduled++;
        });
      }

      // Earlier first-chunk cut = voice starts sooner
      function drain(final) {
        while (true) {
          const minLen = count === 0 ? 14 : 40;
          const re = /[.!?\u0964\u2026]+["')\]]*(?=\s)/g;
          let m;
          let cut = -1;
          while ((m = re.exec(buf))) {
            const end = m.index + m[0].length;
            if (end >= minLen) {
              cut = end;
              break;
            }
          }
          if (cut < 0 && !final && count === 0) {
            if (buf.length >= 40) {
              const c = buf.lastIndexOf(',');
              if (c >= 18) cut = c + 1;
            }
            if (cut < 0 && buf.length >= 90) {
              const sp = buf.lastIndexOf(' ');
              if (sp >= 40) cut = sp;
            }
          }
          if (cut < 0) break;
          emit(buf.slice(0, cut));
          buf = buf.slice(cut).replace(/^\s+/, '');
          count++;
        }
        if (final && buf.trim()) {
          emit(buf);
          buf = '';
          count++;
        }
      }

      return {
        push(d) {
          buf += d;
          drain(false);
        },
        end() {
          drain(true);
        },
        cancel() {
          cancelled = true;
        },
        async finish(fullText) {
          await chain;
          if (dead()) return;
          if (!scheduled || !lastSource) {
            stopAudioPlayback();
            await fallbackBrowserSpeech(sanitizeForSpeech(fullText), hintLang);
            return;
          }
          await new Promise((resolve) => {
            let settled = false;
            const done = () => {
              if (settled) return;
              settled = true;
              if (mySession === livePlaybackSessionRef.current) {
                stopOrbVoicePulse();
                activeAudioSourcesRef.current = [];
                isAITalkingRef.current = false;
                scheduleListenRestart(RESTART_LISTEN_DELAY_MS);
              }
              resolve();
            };
            lastSource.onended = done;
            setTimeout(done, Math.max(150, Math.ceil((nextTime - ctx.currentTime) * 1000) + 150));
          });
        }
      };
    },
    [
      ensureLivePlaybackNodes,
      fallbackBrowserSpeech,
      getPlaybackAudioContext,
      pauseMicForAI,
      scheduleListenRestart,
      startOrbVoicePulse,
      stopAudioPlayback,
      stopOrbVoicePulse,
      updateLiveDisplay
    ]
  );

  const processLiveUserVoice = useCallback(
    async (userVoiceText, signal = null, turnLang = null, prevLang = null, sttMeta = null) => {
      const roundTripT0 = performance.now();
      const previousTurnLang = prevLang || lastLiveTurnLangRef.current || currentLanguageRef.current || 'en';
      const resolvedTurnLang = turnLang || resolveLiveTurnLanguage(userVoiceText, sttMeta);
      currentLanguageRef.current = resolvedTurnLang;
      lastLiveTurnLangRef.current = resolvedTurnLang;

      updateLiveDisplay('thinking', 'THINKING', `"${userVoiceText}"`);
      conversationHistoryRef.current.push({ role: 'user', content: userVoiceText });
      appendUserMessage(userVoiceText);

      const targetLangName = LANG_NAME_MAP[resolvedTurnLang] || 'the user language';
      const liveSystemPrompt = buildLiveSystemPrompt({
        resolvedTurnLang,
        previousTurnLang,
        targetLangName,
        langDirective: getLangDirective(resolvedTurnLang)
      });

      const turnHistory =
        resolvedTurnLang !== previousTurnLang
          ? conversationHistoryRef.current.slice(-1)
          : conversationHistoryRef.current.slice(-LIVE_HISTORY_TURNS);

      try {
        const llmT0 = performance.now();
        const speaker = createLiveSpeaker(signal, resolvedTurnLang);
        let aiText = '';
        let firstTokenLogged = false;
        try {
          aiText = await streamLiveChatModel(
            'qwen/qwen3.8-27b',
            'none',
            420,
            liveSystemPrompt,
            turnHistory,
            signal,
            resolvedTurnLang,
            previousTurnLang,
            sttMeta,
            (d) => {
              if (!firstTokenLogged) {
                firstTokenLogged = true;
                console.log(`[Live] LLM first token: ${(performance.now() - llmT0).toFixed(0)}ms`);
              }
              speaker.push(d);
            }
          );
        } catch (e) {
          if (e?.name === 'AbortError') throw e;
          aiText = '';
        }
        aiText = cleanTeluguOutput(aiText);
        const streamed = Boolean(aiText);
        if (streamed) speaker.end();
        else speaker.cancel();

        if (!aiText && !(signal && signal.aborted)) {
          aiText = await callLiveChatModel(
            'qwen/qwen3.8-27b',
            'none',
            280,
            liveSystemPrompt,
            turnHistory,
            signal,
            resolvedTurnLang,
            previousTurnLang,
            sttMeta
          ).catch(() => '');
        }
        if (!aiText && !(signal && signal.aborted)) {
          aiText = await callLiveChatModel(
            'openai/gpt-oss-120b',
            'low',
            550,
            liveSystemPrompt,
            turnHistory,
            signal,
            resolvedTurnLang,
            previousTurnLang,
            sttMeta
          );
        }
        if (aiText && !streamed && isLiveReplyLanguageMismatch(aiText, resolvedTurnLang) && !(signal && signal.aborted)) {
          const retryPrompt = `CRITICAL: Reply ONLY in ${targetLangName} (${getLangDirective(
            resolvedTurnLang
          )}). Output 1-2 warm spoken sentences with zero markdown.`;
          const retried = await callLiveChatModel(
            'openai/gpt-oss-120b',
            'low',
            550,
            retryPrompt,
            [{ role: 'user', content: userVoiceText }],
            signal,
            resolvedTurnLang,
            previousTurnLang,
            sttMeta
          ).catch(() => '');
          if (retried && !isLiveReplyLanguageMismatch(retried, resolvedTurnLang)) {
            aiText = retried;
          }
        }
        if ((signal && signal.aborted) || !isLiveActiveRef.current) return;
        if (!aiText) {
          const fallbackReplies = {
            en: 'Hey, say that again?',
            te: 'మళ్ళీ ఒకసారి చెప్తారా అండి?',
            hi: 'जी, फिर से कहिएगा?',
            ta: 'மறுபடியும் சொல்லுங்க?',
            es: '¿Puedes repetir eso, por favor?',
            fr: "Tu peux répéter, s'il te plaît ?",
            de: 'Kannst du das bitte wiederholen?'
          };
          aiText = fallbackReplies[resolvedTurnLang] || 'Hey, say that again?';
        }

        console.log(`[Live] LLM: ${(performance.now() - llmT0).toFixed(0)}ms`);
        conversationHistoryRef.current.push({ role: 'assistant', content: aiText });
        appendCompletedAIMessage(aiText);
        console.log(`[Live] STT+LLM total before TTS: ${(performance.now() - roundTripT0).toFixed(0)}ms`);

        if (streamed) await speaker.finish(aiText);
        else await speakAIResponse(aiText, signal, resolvedTurnLang);
      } catch (err) {
        if (err?.name === 'AbortError' || !isLiveActiveRef.current) return;
        console.warn('[Live] LLM error:', err);
        if (isLiveActiveRef.current) setTimeout(() => startContinuousListeningRef.current?.(), 300);
      }
    },
    [
      appendCompletedAIMessage,
      appendUserMessage,
      conversationHistoryRef,
      createLiveSpeaker,
      currentLanguageRef,
      resolveLiveTurnLanguage,
      speakAIResponse,
      updateLiveDisplay
    ]
  );

  const processWavWithSTT = useCallback(
    async (wavBlob) => {
      if (!isLiveActiveRef.current) return;
      if (liveTurnAbortCtrlRef.current) {
        try {
          liveTurnAbortCtrlRef.current.abort();
        } catch {}
      }
      liveTurnAbortCtrlRef.current = new AbortController();
      const signal = liveTurnAbortCtrlRef.current.signal;

      updateLiveDisplay(
        'thinking',
        'THINKING',
        currentLanguageRef.current === 'te' ? TELUGU_LIVE_STATUS_TEXT.thinking : 'Thinking...'
      );
      try {
        const sttT0 = performance.now();
        const sttResult = await fetchSTTWithMeta(wavBlob, liveLangModeRef.current, false, signal);
        const transcript = (sttResult?.text || '').trim();
        console.log(
          `[Live] STT (${sttResult?.languageCode || 'auto'} ${sttResult?.languageProbability || ''}): ${(
            performance.now() - sttT0
          ).toFixed(0)}ms`
        );
        if (signal.aborted || !isLiveActiveRef.current) return;
        if (!transcript || /^[\s.,!?…\-–—~"'`।]+$/u.test(transcript)) {
          startContinuousListeningRef.current?.();
          return;
        }
        const prevLang = lastLiveTurnLangRef.current || currentLanguageRef.current || 'en';
        const turnLang = resolveLiveTurnLanguage(transcript, sttResult);
        currentLanguageRef.current = turnLang;
        lastLiveTurnLangRef.current = turnLang;
        console.log(
          `[Live] Language resolved: prev=${prevLang} -> turn=${turnLang} (pending=${livePendingLangRef.current}:${livePendingCountRef.current})`
        );
        await processLiveUserVoice(transcript, signal, turnLang, prevLang, sttResult);
      } catch (err) {
        if (err?.name === 'AbortError' || !isLiveActiveRef.current) return;
        showErrorToast('Voice error. Retrying...');
        if (isLiveActiveRef.current) setTimeout(() => startContinuousListeningRef.current?.(), 300);
      }
    },
    [currentLanguageRef, processLiveUserVoice, resolveLiveTurnLanguage, showErrorToast, updateLiveDisplay]
  );

  // User started talking while AI was speaking/thinking: cut AI off and keep capturing the user
  const triggerBargeIn = useCallback(
    (now) => {
      if (liveTurnAbortCtrlRef.current) {
        try {
          liveTurnAbortCtrlRef.current.abort();
        } catch {}
        liveTurnAbortCtrlRef.current = null;
      }
      stopAudioPlayback();
      isProcessingTurnRef.current = false;
      bargeMsRef.current = 0;

      pcmChunksRef.current = [...preSpeechBufferRef.current];
      preSpeechBufferRef.current = [];
      speechStartedRef.current = true;
      speechStartTimeRef.current = now - 250;
      lastSpeechTimeRef.current = now;
      activeSpeechFramesRef.current = 6;
      lastSpeechChunkIdxRef.current = pcmChunksRef.current.length;
      updateLiveDisplay(
        'listening',
        'LISTENING',
        currentLanguageRef.current === 'te' ? TELUGU_LIVE_STATUS_TEXT.listeningActive : 'Listening...'
      );
    },
    [currentLanguageRef, stopAudioPlayback, updateLiveDisplay]
  );

  const startContinuousListening = useCallback(async () => {
    if (!isLiveActiveRef.current || isAITalkingRef.current) return;
    // User is already mid-sentence (barge-in) - never wipe what we are capturing
    if (speechStartedRef.current && !isProcessingTurnRef.current) return;

    isProcessingTurnRef.current = false;
    pcmChunksRef.current = [];
    preSpeechBufferRef.current = [];
    speechStartedRef.current = false;
    activeSpeechFramesRef.current = 0;
    lastSpeechChunkIdxRef.current = 0;
    bargeMsRef.current = 0;

    if (!mediaStreamRef.current || mediaStreamRef.current.getTracks().every((t) => t.readyState === 'ended')) {
      try {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
        });
      } catch {
        showErrorToast('Microphone permission denied.');
        updateLiveDisplay('listening', 'MIC BLOCKED', 'Please allow microphone access.');
        return;
      }
    } else {
      mediaStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
    }

    if (!recorderCtxRef.current || recorderCtxRef.current.state === 'closed') {
      const recCtx = createAudioContext();
      const micSrc = recCtx.createMediaStreamSource(mediaStreamRef.current);
      const proc = recCtx.createScriptProcessor(FRAME_SIZE, 1, 1);
      const gain = recCtx.createGain();
      gain.gain.value = 0;
      micSrc.connect(proc);
      proc.connect(gain);
      gain.connect(recCtx.destination);
      recorderCtxRef.current = recCtx;
      micSourceNodeRef.current = micSrc;
      processorNodeRef.current = proc;
      silentGainNodeRef.current = gain;
    } else if (recorderCtxRef.current.state === 'suspended') {
      await recorderCtxRef.current.resume().catch(() => {});
    }

    updateLiveDisplay(
      'listening',
      'LISTENING',
      currentLanguageRef.current === 'te' ? TELUGU_LIVE_STATUS_TEXT.listeningIdle : 'Listening...'
    );

    processorNodeRef.current.onaudioprocess = (event) => {
      if (!isLiveActiveRef.current) return;

      const copy = new Float32Array(event.inputBuffer.getChannelData(0));
      let sum = 0;
      for (let i = 0; i < copy.length; i++) sum += copy[i] * copy[i];
      const rms = Math.sqrt(sum / copy.length);
      const now = Date.now();
      const sr = recorderCtxRef.current?.sampleRate || 48000;
      const frameMs = (copy.length / sr) * 1000;

      const aiBusy = isAITalkingRef.current;
      const thinking = isProcessingTurnRef.current && !aiBusy;

      /* ---- AI is speaking or thinking: only watch for barge-in ---- */
      if (aiBusy || thinking) {
        if (!BARGE_IN_ENABLED) return;

        // keep a rolling buffer so the start of the user's words is not lost
        preSpeechBufferRef.current.push(copy);
        const maxFrames = Math.ceil(650 / frameMs);
        while (preSpeechBufferRef.current.length > maxFrames) preSpeechBufferRef.current.shift();

        if (aiBusy && now - aiSpeechStartedAtRef.current < BARGE_IN_GRACE_MS) {
          bargeMsRef.current = 0;
          return;
        }

        const thr = aiBusy
          ? Math.max(BARGE_IN_MIN_RMS, liveNoiseFloorRef.current * 6)
          : Math.max(0.02, liveNoiseFloorRef.current * 3.5);
        if (rms > thr) bargeMsRef.current += frameMs;
        else bargeMsRef.current = Math.max(0, bargeMsRef.current - frameMs * 0.5);

        const needMs = aiBusy ? BARGE_IN_SPEAKING_MS : BARGE_IN_THINKING_MS;
        if (bargeMsRef.current >= needMs) triggerBargeIn(now);
        return;
      }

      /* ---- Normal listening ---- */
      const threshold = Math.max(0.015, Math.min(0.034, liveNoiseFloorRef.current * 2.5));

      if (rms > threshold) {
        if (!speechStartedRef.current) {
          // ignore the tiny echo tail right after AI audio stops
          if (now - lastAIEndAtRef.current < AFTER_AI_COOLDOWN_MS) return;
          speechStartedRef.current = true;
          speechStartTimeRef.current = now;
          activeSpeechFramesRef.current = 0;
          pcmChunksRef.current = [...preSpeechBufferRef.current];
          preSpeechBufferRef.current = [];
          updateLiveDisplay(
            'listening',
            'LISTENING',
            currentLanguageRef.current === 'te' ? TELUGU_LIVE_STATUS_TEXT.listeningActive : 'Listening...'
          );
        }
        activeSpeechFramesRef.current += 1;
        lastSpeechTimeRef.current = now;
        pcmChunksRef.current.push(copy);
        lastSpeechChunkIdxRef.current = pcmChunksRef.current.length;
      } else if (speechStartedRef.current) {
        pcmChunksRef.current.push(copy);
        const speechDur = now - speechStartTimeRef.current;
        const silenceHangMs = speechDur < 1800 ? SILENCE_HANG_SHORT_MS : SILENCE_HANG_LONG_MS;
        if (now - lastSpeechTimeRef.current > silenceHangMs || speechDur > MAX_UTTERANCE_MS) {
          isProcessingTurnRef.current = true;
          bargeMsRef.current = 0;
          const trimEnd = Math.min(pcmChunksRef.current.length, lastSpeechChunkIdxRef.current + 2);
          const captured = pcmChunksRef.current.slice(0, Math.max(1, trimEnd));
          const voicedFrames = activeSpeechFramesRef.current;
          pcmChunksRef.current = [];
          preSpeechBufferRef.current = [];
          speechStartedRef.current = false;
          activeSpeechFramesRef.current = 0;
          const totalDurSec = captured.reduce((a, c) => a + c.length, 0) / sr;
          const voicedDurationMs = voicedFrames * frameMs;
          if (totalDurSec < 0.25 || voicedFrames < 3 || voicedDurationMs < 140) {
            isProcessingTurnRef.current = false;
            return;
          }
          processWavWithSTT(encodePCMToWav16k(captured, sr));
        }
      } else {
        liveNoiseFloorRef.current = liveNoiseFloorRef.current * 0.92 + rms * 0.08;
        preSpeechBufferRef.current.push(copy);
        const maxPre = Math.ceil(220 / frameMs);
        while (preSpeechBufferRef.current.length > maxPre) preSpeechBufferRef.current.shift();
      }
    };
  }, [currentLanguageRef, processWavWithSTT, showErrorToast, triggerBargeIn, updateLiveDisplay]);

  useEffect(() => {
    startContinuousListeningRef.current = startContinuousListening;
  }, [startContinuousListening]);

  const openLiveMode = useCallback(async () => {
    onBeforeOpen?.();
    ensurePlaybackUnlocked();
    fetch(API_ENDPOINTS.HEALTH).catch(() => {});
    warmNakshatraLocation().catch(() => {});
    isLiveActiveRef.current = true;
    isAITalkingRef.current = false;
    isProcessingTurnRef.current = false;
    speechStartedRef.current = false;
    lastLiveTurnLangRef.current = null;
    livePendingLangRef.current = null;
    livePendingCountRef.current = 0;
    setIsLiveActive(true);
    updateLiveDisplay(
      'listening',
      'CONNECTING...',
      currentLanguageRef.current === 'te' ? TELUGU_LIVE_STATUS_TEXT.connecting : 'Connecting...'
    );
    await startContinuousListening();
  }, [currentLanguageRef, ensurePlaybackUnlocked, onBeforeOpen, startContinuousListening, updateLiveDisplay]);

  const closeLiveMode = useCallback(() => {
    isLiveActiveRef.current = false;
    isProcessingTurnRef.current = false;
    speechStartedRef.current = false;
    livePendingLangRef.current = null;
    livePendingCountRef.current = 0;
    if (liveTurnAbortCtrlRef.current) {
      try {
        liveTurnAbortCtrlRef.current.abort();
      } catch {}
      liveTurnAbortCtrlRef.current = null;
    }
    setIsLiveActive(false);
    stopAudioPlayback();
    try {
      if (processorNodeRef.current) processorNodeRef.current.onaudioprocess = null;
      processorNodeRef.current?.disconnect();
      micSourceNodeRef.current?.disconnect();
      silentGainNodeRef.current?.disconnect();
      recorderCtxRef.current?.close();
    } catch {}
    processorNodeRef.current = null;
    micSourceNodeRef.current = null;
    silentGainNodeRef.current = null;
    recorderCtxRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, [stopAudioPlayback]);

  const interruptAI = useCallback(() => {
    if (isAITalkingRef.current || isProcessingTurnRef.current) {
      if (liveTurnAbortCtrlRef.current) {
        try {
          liveTurnAbortCtrlRef.current.abort();
        } catch {}
        liveTurnAbortCtrlRef.current = null;
      }
      stopAudioPlayback();
      isProcessingTurnRef.current = false;
      speechStartedRef.current = false;
      startContinuousListening();
    }
  }, [startContinuousListening, stopAudioPlayback]);

  const handleOrbTap = useCallback(() => {
    if (tapBlinkTimerRef.current) clearTimeout(tapBlinkTimerRef.current);
    setTapBlink(false);
    requestAnimationFrame(() => {
      setTapBlink(true);
      tapBlinkTimerRef.current = setTimeout(() => setTapBlink(false), 260);
    });
    interruptAI();
  }, [interruptAI]);

  const cycleLiveLangMode = useCallback(() => {
    setLiveLangMode((prev) => {
      const next = prev === 'auto' ? 'te' : prev === 'te' ? 'en' : 'auto';
      liveLangModeRef.current = next;
      if (next === 'te' || next === 'en') currentLanguageRef.current = next;
      return next;
    });
  }, [currentLanguageRef]);

  useEffect(() => {
    if (!isLiveActive) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && isLiveActiveRef.current) closeLiveMode();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeLiveMode, isLiveActive]);

  // Mobile: when user returns to the tab, wake audio contexts so the call keeps working
  useEffect(() => {
    if (!isLiveActive) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || !isLiveActiveRef.current) return;
      playbackAudioCtxRef.current?.resume?.().catch(() => {});
      recorderCtxRef.current?.resume?.().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isLiveActive]);

  useEffect(() => {
    return () => {
      if (tapBlinkTimerRef.current) clearTimeout(tapBlinkTimerRef.current);
      closeLiveMode();
    };
  }, [closeLiveMode]);

  return {
    isLiveActive,
    isLiveActiveRef,
    liveState,
    liveStatusText,
    liveTranscript,
    tapBlink,
    liveLangMode,
    liveOrbGlowRef,
    livePlayerRef,
    openLiveMode,
    closeLiveMode,
    handleOrbTap,
    interruptAI,
    ensurePlaybackUnlocked,
    cycleLiveLangMode
  };
}
