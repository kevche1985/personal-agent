import { createHash } from 'crypto';

export function splitTextIntoChunks(text, { maxChunkChars = 18000, overlapChars = 800 } = {}) {
  const input = (text || '').toString();
  if (!input) return [];

  const stride = Math.max(1, maxChunkChars - overlapChars);
  const chunks = [];

  for (let i = 0; i < input.length; i += stride) {
    chunks.push(input.slice(i, i + maxChunkChars));
  }

  return chunks;
}

export function stableShortHash(value) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 6);
}

export function sanitizeMerchantForClassification(merchant, maxLen = 80) {
  const s = String(merchant || '').replace(/\s+/g, ' ').trim();
  if (!s) return 'Unknown';
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 9)}…#${stableShortHash(s)}`;
}

export function isLikelyTextBasedPdf(parsedText, numPages) {
  const pages = Math.max(1, Number(numPages || 1));
  const t = String(parsedText || '');
  return t.length >= 50 * pages;
}

