import { API_ENDPOINTS } from '../config/endpoints';
import { SYSTEM_PROMPT, getFewShotExamples } from '../config/prompts';
import { getLangDirective } from '../utils/language';
import { cleanTeluguOutput } from '../utils/textCleaners';
import {
  nakshatraClientLocation,
  getClientLocationPayload,
  getClientTimezone,
  warmNakshatraLocation
} from './locationService';

export async function sendChatCompletion({
  messages,
  combinedSystem,
  isDeep,
  isHowTo,
  signal
}) {
  await Promise.race([warmNakshatraLocation(), new Promise((r) => setTimeout(r, 350))]);

  const response = await fetch(API_ENDPOINTS.GROQ_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      mode: 'chat',
      reasoning_effort: isDeep ? 'high' : 'medium',
      temperature: isDeep ? 0.15 : isHowTo ? 0.2 : 0.4,
      max_tokens: isDeep || isHowTo ? 2400 : 1800,
      city: nakshatraClientLocation.city || null,
      location: getClientLocationPayload(),
      timezone: getClientTimezone(),
      messages: [{ role: 'system', content: combinedSystem }, ...messages]
    })
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => null);
    throw new Error(errBody?.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export async function continueChatCompletion({ historySlice, currentReplyText, currentLanguage }) {
  const res = await fetch(API_ENDPOINTS.GROQ_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      mode: 'chat',
      max_tokens: 2000,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${getLangDirective(currentLanguage)}` },
        ...historySlice,
        { role: 'assistant', content: currentReplyText },
        { role: 'user', content: 'Continue exactly where you stopped using the same clean headings and bullets. Do not repeat.' }
      ]
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return cleanTeluguOutput(data.response || data.reply || data.choices?.[0]?.message?.content || '');
}

export async function callLiveChatModel(
  model,
  effort,
  maxTokens,
  systemPrompt,
  historyMsgs,
  signal,
  turnLang,
  prevLang,
  sttMeta = null
) {
  const res = await fetch(API_ENDPOINTS.GROQ_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      mode: 'live',
      reasoning_effort: effort,
      temperature: 0.72,
      max_tokens: maxTokens,
      language: turnLang,
      prev_language: prevLang || turnLang,
      script_preference: 'native',
      city: nakshatraClientLocation.city || null,
      location: getClientLocationPayload(),
      stt_meta: sttMeta
        ? {
            languageCode: sttMeta.languageCode || null,
            languageProbability: Number(sttMeta.languageProbability || 0)
          }
        : null,
      timezone: getClientTimezone(),
      messages: [{ role: 'system', content: systemPrompt }, ...getFewShotExamples(turnLang, 'live'), ...historyMsgs]
    })
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return cleanTeluguOutput(data.response || data.choices?.[0]?.message?.content || '');
}

export async function streamLiveChatModel(
  model,
  effort,
  maxTokens,
  systemPrompt,
  historyMsgs,
  signal,
  turnLang,
  prevLang,
  sttMeta,
  onDelta
) {
  const res = await fetch(API_ENDPOINTS.GROQ_CHAT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model,
      mode: 'live',
      stream: true,
      reasoning_effort: effort,
      temperature: 0.72,
      max_tokens: maxTokens,
      language: turnLang,
      prev_language: prevLang || turnLang,
      script_preference: 'native',
      city: nakshatraClientLocation.city || null,
      location: getClientLocationPayload(),
      stt_meta: sttMeta
        ? {
            languageCode: sttMeta.languageCode || null,
            languageProbability: Number(sttMeta.languageProbability || 0)
          }
        : null,
      timezone: getClientTimezone(),
      messages: [{ role: 'system', content: systemPrompt }, ...getFewShotExamples(turnLang, 'live'), ...historyMsgs]
    })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json') || !res.body) {
    const jsonData = await res.json().catch(() => null);
    const full = cleanTeluguOutput(jsonData?.response || jsonData?.choices?.[0]?.message?.content || '');
    if (full) onDelta(full);
    return full;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let acc = '';
  let carry = '';
  let inThink = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const lines = carry.split('\n');
    carry = lines.pop();
    for (const ln of lines) {
      const s = ln.trim();
      if (!s.startsWith('data:')) continue;
      const p = s.slice(5).trim();
      if (p === '[DONE]') continue;
      try {
        let d = JSON.parse(p).choices?.[0]?.delta?.content || '';
        if (!d) continue;
        if (d.includes('<think>')) {
          inThink = true;
          d = d.split('<think>')[0];
        }
        if (inThink) {
          if (d.includes('</think>')) {
            inThink = false;
            d = d.split('</think>').slice(1).join('');
          } else continue;
        }
        if (d) {
          acc += d;
          onDelta(d);
        }
      } catch {}
    }
  }
  return cleanTeluguOutput(acc);
}
