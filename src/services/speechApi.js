import { API_ENDPOINTS } from '../config/endpoints';
import { base64ToArrayBuffer } from '../utils/audioWav';

export async function fetchSTTWithMeta(wavBlob, mode = 'auto', allowFallback = false, signal = null) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 14000);
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  const cleanSttNoise = (txt, isWhisper = false) => {
    const t = (txt || '').trim();
    if (!t || /^[\s.,!?…\-–—~"'`।]+$/u.test(t)) return '';
    if (
      isWhisper &&
      /^(thank you|thanks|thanks for watching|bye|you|subtitle[s]?|amara\.org)[.!\s]*$/i.test(t) &&
      wavBlob.size < 22000
    ) {
      return '';
    }
    if (wavBlob.size < 14000 && t.length === 1 && !/^[iaok]$/i.test(t) && !/[\u0900-\u0DFF]/.test(t)) return '';
    return t;
  };

  try {
    if (mode === 'en') {
      const fd = new FormData();
      fd.append('file', wavBlob, 'recording.wav');
      fd.append('model', 'whisper-large-v3-turbo');
      fd.append('language', 'en');
      const res = await fetch(API_ENDPOINTS.GROQ_STT, { method: 'POST', body: fd, signal: controller.signal });
      if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
      return {
        text: cleanSttNoise((await res.json()).text, true),
        languageCode: 'en-IN',
        languageProbability: 1.0
      };
    }

    const fd = new FormData();
    fd.append('file', wavBlob, 'recording.wav');
    fd.append('model', 'saaras:v3');
    fd.append('mode', 'codemix');
    fd.append('language_code', mode === 'te' ? 'te-IN' : 'unknown');
    const res = await fetch(API_ENDPOINTS.SARVAM_STT, { method: 'POST', body: fd, signal: controller.signal });
    if (res.ok) {
      const data = await res.json();
      const txt = cleanSttNoise(data.transcript || data.text || '', false);
      if (txt || !allowFallback) {
        return {
          text: txt,
          languageCode: data.language_code || null,
          languageProbability: data.language_probability || 0
        };
      }
    } else if (!allowFallback) {
      throw new Error(`STT HTTP ${res.status}`);
    }

    const fallbackFd = new FormData();
    fallbackFd.append('file', wavBlob, 'recording.wav');
    fallbackFd.append('model', 'whisper-large-v3-turbo');
    const fbRes = await fetch(API_ENDPOINTS.GROQ_STT, { method: 'POST', body: fallbackFd, signal: controller.signal });
    if (!fbRes.ok) throw new Error(`STT HTTP ${fbRes.status}`);
    return {
      text: cleanSttNoise((await fbRes.json()).text, true),
      languageCode: null,
      languageProbability: 0
    };
  } finally {
    clearTimeout(timeoutId);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export async function fetchSTTTranscript(wavBlob, mode = 'auto', allowFallback = false, signal = null) {
  const res = await fetchSTTWithMeta(wavBlob, mode, allowFallback, signal);
  return res?.text || '';
}

export async function fetchTtsChunkAudio(
  chunkText,
  targetLang,
  speaker,
  preferElevenLabs,
  signal,
  sarvamModel = 'bulbul:v4-flash'
) {
  if (preferElevenLabs) {
    try {
      const elRes = await fetch(`${API_ENDPOINTS.ELEVENLABS_TTS}?voice_id=EXAVITQu4vr4xnSDxMaL`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          text: chunkText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.3,
            similarity_boost: 0.78,
            style: 0.45,
            use_speaker_boost: true,
            speed: 0.97
          }
        })
      });
      if (elRes.ok) {
        const buf = await elRes.arrayBuffer();
        if (buf && buf.byteLength > 256) {
          return { arrayBuffer: buf, mimeType: 'audio/mpeg', provider: 'elevenlabs' };
        }
      }
    } catch (e) {
      if (e?.name === 'AbortError') throw e;
      console.warn('[Live] ElevenLabs fallback to Sarvam:', e?.message || e);
    }
  }

  const sRes = await fetch(API_ENDPOINTS.SARVAM_TTS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      text: chunkText,
      target_language_code: targetLang,
      model: sarvamModel,
      speaker,
      pace: 1.0,
      pitch: 0.0,
      loudness: 1.1,
      enable_preprocessing: true,
      speech_sample_rate: 24000,
      output_audio_codec: 'mp3'
    })
  });
  if (!sRes.ok) throw new Error(`Sarvam HTTP ${sRes.status}`);
  const ttsData = await sRes.json();
  const audioBase64 = ttsData.audios?.[0] || ttsData.audio || ttsData.audio_content;
  if (!audioBase64) return null;
  const buf = base64ToArrayBuffer(audioBase64);
  const bytes = new Uint8Array(buf);
  const mimeType =
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) || (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
      ? 'audio/mpeg'
      : 'audio/wav';
  return { arrayBuffer: buf, mimeType, base64Audio: audioBase64, provider: 'sarvam' };
}
