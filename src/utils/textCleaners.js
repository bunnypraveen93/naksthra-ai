export function escapeHtmlPlain(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function cleanTeluguOutput(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .split(/(```[\s\S]*?```)/g)
    .map((part) => {
      if (part.startsWith('```')) return part;
      let t = part.replace(/<think>[\s\S]*?<\/think>/gi, '');
      t = t.replace(/^(నక్షత్ర\s*(AI)?|Nakshatra\s*(AI)?|Assistant|AI|Bot)\s*[:：\-–]\s*/i, '');
      t = t.replace(/నేను\s*మీకు\s*ఎలా\s*సహాయపడగలను\??/gu, 'చెప్పండి, ఏంటి విశేషాలు?');
      t = t.replace(/\bI am doing well,\s*how are you\??/gi, "Hey! I'm doing great, how's it going?");
      t = t.replace(/\bHow can I help you\??/gi, "What's on your mind?");
      t = t.replace(/గhee/giu, 'నెయ్యి');
      t = t.replace(/వెన్న\s*\(\s*గీ\s*\)/gu, 'నెయ్యి');
      t = t.replace(/దహి\s*\(\s*నెయ్యి\s*\)/gu, 'పెరుగు లేదా నెయ్యి');
      t = t.replace(/దయి\b/gu, 'పెరుగు');
      t = t.replace(/రాయితీ\s*\(\s*రాయిత్\s*\)/gu, 'రైతా');
      t = t.replace(/రాయతా/gu, 'రైతా');
      t = t.replace(/మందమైన\s*బాటిల్/gu, 'మందపాటి గిన్నె');
      t = t.replace(/వెండి\s*పాన్/gu, 'పాన్');
      t = t.replace(/సేవించడం/gu, 'వడ్డించడం');
      t = t.replace(/[“"]?(?:దంప్|దుమ్|డంప్)[”"]?/gu, 'దమ్');
      t = t.replace(/(\d+\s*నిమిషాలు\s*)మరిగించండి(?=\s*(?:[.,\n]|$))/gu, '$1పక్కన ఉంచండి');
      t = t.replace(/\s*\((?:సుమారు\s*)?\d+\s*W\)/giu, '');
      t = t.replace(/([\u0C3E-\u0C4C])\1+/gu, '$1').replace(/[\u0400-\u04FF\u4E00-\u9FFF\u0600-\u06FF]/g, '');
      return t;
    })
    .join('')
    .trim();
}

export function sanitizeForSpeech(text) {
  let s = cleanTeluguOutput(text || '');
  if (!s) return '';
  const isTeluguText = /[\u0C00-\u0C7F]/.test(s);
  s = s
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
    .replace(/\[\d+\]/g, ' ')
    .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi, isTeluguText ? '$1 డిగ్రీల సెల్సియస్' : '$1 degrees Celsius')
    .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/gi, isTeluguText ? '$1 డిగ్రీల ఫారెన్‌హీట్' : '$1 degrees Fahrenheit')
    .replace(/₹\s*(\d[\d,]*(?:\.\d+)?)/g, isTeluguText ? '$1 రూపాయలు' : '$1 rupees')
    .replace(/\bRs\.?\s*(\d[\d,]*(?:\.\d+)?)/gi, isTeluguText ? '$1 రూపాయలు' : '$1 rupees')
    .replace(/\$\s*(\d[\d,]*(?:\.\d+)?)/g, isTeluguText ? '$1 డాలర్లు' : '$1 dollars')
    .replace(/(\d+(?:\.\d+)?)\s*%/g, '$1 percent')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[*_#`~>|]/g, ' ')
    .replace(/\(([^()]{1,60})\)/g, ', $1, ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\r?\n+/g, '. ')
    .replace(/\.{4,}/g, '...')
    .replace(/\s+([.,!?])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

export function splitSpeechChunks(cleanText) {
  const txt = String(cleanText || '').trim();
  if (!txt || txt.length <= 190) return txt ? [txt] : [];
  const rawParts = txt
    .split(/(?<=[.!?।])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (rawParts.length <= 1) return [txt];
  const merged = [];
  for (const part of rawParts) {
    if (merged.length > 0 && (merged[merged.length - 1].length < 48 || part.length < 32)) {
      merged[merged.length - 1] += ' ' + part;
    } else if (merged.length >= 2) {
      merged[merged.length - 1] += ' ' + part;
    } else {
      merged.push(part);
    }
  }
  return merged.length ? merged : [txt];
}

export function manageConversationHistory(history, maxTurns = 8) {
  return history.slice(-(maxTurns * 2));
}

export function isReplyCutOff(text) {
  if (!text) return false;
  const t = text.trim();
  if (t.endsWith('```')) return false;
  const lastLine = (t.split('\n').pop() || '').trim();
  if (/^(#{1,6}\s|-{3,}|\|)/.test(lastLine)) return false;
  return !/[.?!।…]$/.test(t.replace(/[*_`"' )\]>]+$/g, ''));
}

export function classifyPromptComplexity(text) {
  const t = (text || '').trim();
  const lower = t.toLowerCase();
  const hasDeepKeyword =
    /\b(puzzle|riddle|trick|logic|logical|paradox|brain\s*teaser|solve|calculate|compute|evaluate|prove|proof|derivation|compare|analyze|debug|algorithm|probability|pattern|sequence|missing\s+number|odd\s+one|truth|liar|knight|knave|how\s+many|ratio|percent|percentage|equation|find\s+x|step\s+by\s+step|verify|fact\s+check|difference\s+between|write\s+code|podupu)\b/i.test(
      lower
    ) || /(పొడుపు|తర్కం|లెక్క|సమాధానం|ఎంత|తేడా|పోల్చు|కోడ్)/.test(t);
  const hasHowToOrRecipe =
    /\b(how\s+to|recipe|cook|make|prepare|bake|fry|brew|boil|roast|build|setup|set\s+up|configure|fix|troubleshoot|instructions|method|process|biryani|briyani|dosa|curry|masala)\b/i.test(
      lower
    ) ||
    /(ఎలా\s*వండాలి|ఎలా\s*చేయాలి|తయారీ|విధానం|వంట|బిర్యానీ|రెసిపీ|కైసే\s*బనాయే|कैसे\s*बनाएं|कैसे\s*पकाएं|ela\s+cheyyali|ela\s+vandali)/.test(
      t
    );
  const hasMultiConstraint =
    /\b(if|suppose|assuming|all\s+\w+\s+are|none\s+of|either|neither|only\s+one|twice|half|times\s+as|heavier|lighter|older|younger|weigh|door|hat|coin|box|train|speed|distance|clock|angle)\b/i.test(
      lower
    );
  const hasCode = /(```|\bfunction\b|\bclass\b|\bconst\b|\bdef\b|\bSELECT\b|\bTypeError\b|\bException\b)/i.test(t);
  const hasMathNumbers =
    (t.match(/\d+(?:\.\d+)?/g) || []).length >= 2 && /[?+\-*/=^%]|\b(total|sum|cost|left|remaining|find|many|much)\b/i.test(lower);
  return {
    isDeep: hasDeepKeyword || hasMultiConstraint || hasCode || hasMathNumbers || t.length > 180,
    isHowTo: hasHowToOrRecipe
  };
}
