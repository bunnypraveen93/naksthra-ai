/**
 * Encodes Float32 PCM chunks from AudioContext into a 16 kHz mono 16-bit WAV Blob.
 */
export function encodePCMToWav16k(chunks, inputSampleRate) {
  const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
  const merged = new Float32Array(totalLen);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }

  const targetRate = 16000;
  const ratio = inputSampleRate / targetRate;
  const newLength = Math.max(1, Math.round(merged.length / ratio));
  const samples = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const start = Math.round(i * ratio);
    const end = Math.min(merged.length, Math.round((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j];
    samples[i] = end > start ? sum / (end - start) : 0;
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (p, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(p + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, targetRate, true);
  view.setUint32(28, targetRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let idx = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    idx += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function base64ToArrayBuffer(b64) {
  const clean = b64.replace(/^data:audio\/\w+;base64,/, '').replace(/[\r\n\s]/g, '');
  const bin = window.atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
