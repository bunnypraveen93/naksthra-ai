import { marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/atom-one-dark.css';
import { escapeHtmlPlain } from './textCleaners';

marked.setOptions({ breaks: true, gfm: true });

export function normalizeMarkdownForRender(text) {
  if (!text || typeof text !== 'string') return '';
  const codeBlocks = [];
  let normalized = text.replace(/\r\n/g, '\n').replace(/(```[\s\S]*?```)/g, (match) => {
    const id = `__NKS_CODE_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return id;
  });

  normalized = normalized.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');
  normalized = normalized.replace(/^(\s*)[•◦▪▸‣●]\s+/gm, '$1- ');
  normalized = normalized.replace(/^\*\*([^*\n]{2,65}):?\*\*\s*$/gm, '### $1');

  const lines = normalized.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const prev = out.length > 0 ? out[out.length - 1] : '';
    const isHeading = /^\s*#{1,6}\s+/.test(cur);
    const isListItem = /^\s*(?:[-*+]|\d+\.)\s+/.test(cur);
    const prevIsBlank = !prev.trim();
    const prevIsHeading = /^\s*#{1,6}\s+/.test(prev);
    const prevIsListItem = /^\s*(?:[-*+]|\d+\.)\s+/.test(prev);

    if (i > 0 && !prevIsBlank) {
      if (isHeading || (isListItem && !prevIsListItem && !prevIsHeading) || (prevIsHeading && cur.trim())) {
        out.push('');
      }
    }
    out.push(cur);
  }

  normalized = out.join('\n').replace(/\n{3,}/g, '\n\n');
  normalized = normalized.replace(/__NKS_CODE_(\d+)__/g, (_, idx) => codeBlocks[Number(idx)] ?? '');
  return normalized.trim();
}

export function closePartialCodeFence(text) {
  const fenceCount = (text.match(/```/g) || []).length;
  return fenceCount % 2 === 1 ? text + '\n```' : text;
}

export function renderMarkdownClean(text, options = {}) {
  if (!text) return '';
  const shouldHighlight = options.highlight !== false;
  try {
    const normalized = normalizeMarkdownForRender(text);
    const rawHtml = marked.parse(normalized);
    const safeHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });

    const temp = document.createElement('div');
    temp.innerHTML = safeHtml;

    temp.querySelectorAll('table').forEach((table) => {
      const wrap = document.createElement('div');
      wrap.className = 'table-scroll-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });

    temp.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      } else if (!href.startsWith('#')) {
        a.removeAttribute('href');
      }
    });

    temp.querySelectorAll('pre').forEach((pre) => {
      const code = pre.querySelector('code');
      let lang = 'code';
      if (code) {
        const langClass = Array.from(code.classList).find((c) => c.startsWith('language-'));
        if (langClass) lang = langClass.replace('language-', '');
        if (shouldHighlight) {
          try {
            hljs.highlightElement(code);
          } catch {}
        }
      }
      const card = document.createElement('div');
      card.className = 'code-card';
      card.innerHTML = `<div class="code-card-header"><span>${escapeHtmlPlain(
        lang
      )}</span><button class="code-card-copy-btn" type="button"><i class="fa-regular fa-copy"></i> <span>Copy</span></button></div>`;
      pre.parentNode.insertBefore(card, pre);
      card.appendChild(pre);
    });

    return temp.innerHTML;
  } catch {
    return `<p>${escapeHtmlPlain(text).replace(/\n/g, '<br>')}</p>`;
  }
}
