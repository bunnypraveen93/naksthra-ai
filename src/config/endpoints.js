export const WORKER_BASE = 'https://small-leaf-d4fb.bunnypraveen939.workers.dev';

export const API_ENDPOINTS = {
  HEALTH: `${WORKER_BASE}/health`,
  GROQ_CHAT: `${WORKER_BASE}/groq`,
  MY_LOCATION: `${WORKER_BASE}/my-location`,
  GROQ_STT: `${WORKER_BASE}/groq-stt`,
  SARVAM_STT: `${WORKER_BASE}/sarvam-stt`,
  SARVAM_TTS: `${WORKER_BASE}/sarvam`,
  ELEVENLABS_TTS: `${WORKER_BASE}/elevenlabs`
};
