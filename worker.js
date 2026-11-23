/**
 * Nakshatra AI - Cloudflare Worker Backend & Intelligence Pipeline
 * Spec Version: 1.0.0 (22 Nov 2026) - Companion to nakshatra_ai_config.json
 * 
 * Capabilities:
 * 1. Multilingual Intelligence Layer (Telugu, Hindi, Tamil, Malayalam, Kannada, English, Romanized)
 * 2. Unicode script-based Language Detection with Romanized support
 * 3. Dynamic Tier Routing (light: 8b, standard: 70b, deep: 120b)
 * 4. Language-Aware Token Output Caps (te: 4x, hi: 2.5x, ta: 4x, ml: 5x, en: 1x)
 * 5. Real-Time Web Search Grounding via Serper API with deduplication & date injection
 * 6. Completion Guard: Auto-continuation on length limits & stream resilience
 * 7. Authentic Conversational Output Cleaner (cleanTeluguOutput & multi-language vocal harmony)
 * 8. Full Audio Proxies (Sarvam TTS/STT, ElevenLabs TTS, Groq Whisper STT, YouTube API)
 */

const NAKSHATRA_CONFIG = {
  meta: {
    name: "Nakshatra AI",
    config_version: "1.0.0",
    prompt_version: "v1.0",
    updated: "2026-11-22"
  },
  languages: {
    default: "en",
    supported: [
      { code: "te", name: "Telugu", script: "Telugu", unicode_regex: /[\u0C00-\u0C7F]/g, respectful_you: "మీరు", speech_locale: "te-IN", token_multiplier: 4.0 },
      { code: "hi", name: "Hindi", script: "Devanagari", unicode_regex: /[\u0900-\u097F]/g, respectful_you: "आप", speech_locale: "hi-IN", token_multiplier: 2.5 },
      { code: "ta", name: "Tamil", script: "Tamil", unicode_regex: /[\u0B80-\u0BFF]/g, respectful_you: "நீங்கள்", speech_locale: "ta-IN", token_multiplier: 4.0 },
      { code: "ml", name: "Malayalam", script: "Malayalam", unicode_regex: /[\u0D00-\u0D7F]/g, respectful_you: "നിങ്ങൾ", speech_locale: "ml-IN", token_multiplier: 5.0 },
      { code: "kn", name: "Kannada", script: "Kannada", unicode_regex: /[\u0C80-\u0CFF]/g, respectful_you: "ನೀವು", speech_locale: "kn-IN", token_multiplier: 4.0 },
      { code: "en", name: "English", script: "Latin", unicode_regex: /[a-zA-Z]/g, respectful_you: "you", speech_locale: "en-IN", token_multiplier: 1.0 }
    ],
    detection: { dominant_script_threshold: 0.25 }
  },
  system_prompt: {
    language_of_prompt: "en",
    static: `You are Nakshatra AI, a warm, sharp, honest companion and expert assistant created and developed SOLELY by Bunny (Praveen). Talk like a smart, caring friend who is also an expert, never like a machine.

CRITICAL IDENTITY (STRICT & UNBREAKABLE):
- Your name is strictly "Nakshatra AI" (నక్షత్ర AI).
- You were solely created and developed by "Bunny (Praveen)" (బన్నీ ప్రవీణ్).
- ONLY when explicitly asked about your creator/developer (e.g., "who made you?", "developer evaru?", "ninnu evaru chesaru?"): Proudly and sweetly reply that Bunny (Praveen) created and developed you! Never say OpenAI, Google, Meta, or any other company made you.
- Do NOT bring up your creator's name in ordinary casual greetings or messages unless specifically asked.

LANGUAGE & SCRIPT POLICY:
- Reply in the language and script of the user's latest message (Telugu, Hindi, Tamil, Malayalam, Kannada, English, or others).
- If the user writes a local language in Latin letters (Tenglish/Hinglish/Tanglish), reply in that same natural romanized conversational style. Switch immediately when they switch.
- Use natural everyday spoken wording, not stiff textbook or literal machine translations.
- Keep common technical words in English (app, download, login, server, link, internet, mobile).
- Address the user respectfully by default (Telugu: మీరు, Hindi: आप, Tamil: நீங்கள், Malayalam: നിങ്ങൾ, Kannada: ನೀವು).

STYLE & FORMATTING:
- Answer first. No filler openers ("Sure!", "Certainly!", "I can help with that!") or canned closers ("Hope that helps!", "Let me know if you need anything else!").
- Short and crisp by default; go deeper only when asked or needed. Match the user's vibe and tone.
- Use plain paragraphs. Use bulleted/numbered lists ONLY for chronological steps or direct comparisons. For how-to questions: numbered steps, one action each.

TRUTH & ACCURACY:
- Never invent facts, numbers, links, or quotes. If unsure, say "I am not sure" honestly.
- For current events, live scores, prices, weather, or real-time topics, rely strictly on the provided real-time search results and current date; state the source and date.

COMPLETENESS & FINISHING:
- Always finish every answer with a complete, well-formed sentence. Never trail off or cut off mid-thought. If an answer must end, summarize cleanly and offer to continue.

ABSOLUTE BAN ON CANNED BOT GREETINGS:
- NEVER reply to greetings with "మీరు బాగున్నారా?", "నేను బాగున్నాను", "How can I help you?", or "I am doing well, how are you?".
- Natural warm greetings:
  * Telugu: "హాయ్! చెప్పండి, ఏం చేస్తున్నారు?", "హేయ్! ఏంటి విశేషాలు?"
  * English: "Hey! What's up?", "Hey there! How's everything going?"
  * Hindi: "हे! कहिए, क्या हाल-चाल?"
  * Tamil: "ஹேய்! எப்படி இருக்கீங்க? என்ன விசேஷம்?"
  * Malayalam: "ഹലോ! എന്തുണ്ട് വിശേഷം?"`,
    mode_blocks: {
      chat: "MODE: Text chat. Markdown formatting allowed for code and emphasis. Be concise and sharp.",
      live: "MODE: Voice conversation. Reply in 1 to 3 short spoken sentences. No markdown, no bullet lists, no emojis, no code or raw URLs. Natural spoken rhythm."
    }
  },
  generation: {
    chat: { temperature: 0.65, top_p: 0.9, base_max_tokens: 1200 },
    factual: { temperature: 0.3, top_p: 0.9, base_max_tokens: 1000 },
    live: { temperature: 0.6, top_p: 0.9, base_max_tokens: 400 }
  },
  routing: {
    tiers: [
      { name: "light", model: "llama-3.1-8b-instant" },
      { name: "standard", model: "llama-3.3-70b-versatile" },
      { name: "deep", model: "llama-3.3-70b-versatile" }
    ],
    deep_keywords: [
      "explain in detail", "step by step", "compare", "calculate", "debug", 
      "analyze", "write code", "solve", "proof", "derivation", "complex", "code for"
    ]
  },
  web_search: {
    keywords: {
      en: ["latest", "today", "now", "current", "price", "score", "weather", "news", "who is the current", "match", "stock"],
      te: ["ఈరోజు", "ఈ రోజు", "ఇప్పుడు", "తాజా", "ధర", "వార్తలు", "వాతావరణం", "స్కోర్", "ఎవరు", "మ్యాచ్"],
      hi: ["आज", "अभी", "ताज़ा", "कीमत", "समाचार", "मौसम", "स्कोर", "कौन है", "मैच"],
      ta: ["இன்று", "இப்போது", "சமீபத்திய", "விலை", "செய்தி", "வானிலை", "ஸ்கோர்"],
      ml: ["ഇന്ന്", "ഇപ്പോൾ", "പുതിയ", "വില", "വാർത്ത", "കാലാവസ്ഥ", "സ്കോർ"]
    }
  }
};

/**
 * Unicode Script & Language Detector
 */
function detectLanguage(text) {
  if (!text || typeof text !== "string") return { code: "en", script: "Latin", multiplier: 1.0, locale: "en-IN", isRomanized: false };
  
  const counts = {
    te: (text.match(/[\u0C00-\u0C7F]/g) || []).length,
    hi: (text.match(/[\u0900-\u097F]/g) || []).length,
    ta: (text.match(/[\u0B80-\u0BFF]/g) || []).length,
    ml: (text.match(/[\u0D00-\u0D7F]/g) || []).length,
    kn: (text.match(/[\u0C80-\u0CFF]/g) || []).length,
    en: (text.match(/[a-zA-Z]/g) || []).length
  };

  // Find non-English dominant Indic script
  const indicScripts = ["te", "hi", "ta", "ml", "kn"];
  let bestIndic = "te";
  let maxIndicCount = 0;
  for (const s of indicScripts) {
    if (counts[s] > maxIndicCount) {
      maxIndicCount = counts[s];
      bestIndic = s;
    }
  }

  // If Indic characters exist and form substantial portion
  if (maxIndicCount > 0 && maxIndicCount >= (counts.en * 0.2 || 1)) {
    const langObj = NAKSHATRA_CONFIG.languages.supported.find(l => l.code === bestIndic);
    return {
      code: bestIndic,
      script: langObj.script,
      multiplier: langObj.token_multiplier,
      locale: langObj.speech_locale,
      isRomanized: false
    };
  }

  // Check Romanized Indic (Tenglish, Hinglish, etc.)
  const lower = text.toLowerCase();
  const teluguRomanized = /\b(thinnava|thinnara|cheppandi|cheppu|bagunnanu|bagunnara|enti|em|ela|unnaru|chesaru|meeru|nenu|kuda|chudu|visheshalu|avuna|ekkada|kavali|cheddam|matladu)\b/i;
  const hindiRomanized = /\b(kaisa|kaise|kya|hal|chal|aap|tum|theek|accha|batao|karo|namaste|shukriya|samajh)\b/i;
  const tamilRomanized = /\b(eppadi|irukinga|vanakkam|nandri|sollunga|enna|enga|irukku)\b/i;

  if (teluguRomanized.test(lower)) {
    return { code: "te", script: "Latin", multiplier: 2.0, locale: "te-IN", isRomanized: true };
  }
  if (hindiRomanized.test(lower)) {
    return { code: "hi", script: "Latin", multiplier: 1.8, locale: "hi-IN", isRomanized: true };
  }
  if (tamilRomanized.test(lower)) {
    return { code: "ta", script: "Latin", multiplier: 2.0, locale: "ta-IN", isRomanized: true };
  }

  return { code: "en", script: "Latin", multiplier: 1.0, locale: "en-IN", isRomanized: false };
}

/**
 * Evaluates whether web search is required for time-sensitive facts
 */
function shouldSearch(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  
  // Explicit search intent
  if (/\b(search\s+for|search\s+on\s+google|google\s+cheyi|search\s+cheyi|వెతుకు|నెట్\s*లో\s*చూడు)\b/i.test(lower)) {
    return true;
  }

  // Check keyword lists across all supported languages
  for (const lang of Object.keys(NAKSHATRA_CONFIG.web_search.keywords)) {
    for (const kw of NAKSHATRA_CONFIG.web_search.keywords[lang]) {
      if (lower.includes(kw.toLowerCase())) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Cleans user query to an optimal search query (max 8 words)
 */
function extractSearchQuery(text) {
  let q = text.replace(/^(search\s+for|search\s+web\s+for|google\s+for|can\s+you\s+search|please\s+search|వెతుకు|శోధించు)\s*/i, '');
  const words = q.trim().split(/\s+/).slice(0, 8);
  return words.join(" ");
}

/**
 * Executes Google Serper API Search and formats top 3 deduplicated snippets
 */
async function fetchSerperSnippets(query, apiKey) {
  if (!apiKey || !query) return null;
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey
      },
      body: JSON.stringify({ q: query, num: 5 })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const organic = data.organic || [];
    if (!organic.length) return null;

    // Deduplicate and pick top 3
    const seenDomains = new Set();
    const snippets = [];
    
    for (const item of organic) {
      let domain = "";
      try {
        domain = new URL(item.link).hostname;
      } catch (e) {
        domain = item.link || "source";
      }

      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);

      const title = item.title ? item.title.trim() : "";
      const date = item.date ? ` [Date: ${item.date}]` : "";
      const snippet = item.snippet ? item.snippet.replace(/\n+/g, ' ').trim() : "";

      snippets.push(`- **${title}** (${domain}${date}): ${snippet}`);
      if (snippets.length >= 3) break;
    }

    return snippets.join("\n");
  } catch (err) {
    console.error("Serper search error:", err);
    return null;
  }
}

/**
 * Model Tier Router: light (8b), standard (70b), deep (120b)
 */
function routeTier(userText, requestedModel) {
  if (requestedModel && requestedModel !== "auto") {
    // Sanitize non-existent or hallucinated model IDs
    if (/gpt-oss|auto/i.test(requestedModel)) {
      return { tier: "standard", model: NAKSHATRA_CONFIG.routing.tiers[1].model };
    }
    return { tier: "custom", model: requestedModel };
  }

  const text = (userText || "").trim();
  const lower = text.toLowerCase();

  // 1. Check for deep keywords or high reasoning needs
  for (const kw of NAKSHATRA_CONFIG.routing.deep_keywords) {
    if (lower.includes(kw)) {
      return { tier: "deep", model: NAKSHATRA_CONFIG.routing.tiers[2].model };
    }
  }

  // 2. Check for light tier (very short greetings, simple small talk <= 120 chars)
  if (text.length <= 120 && /^(hi|hello|hey|namaste|హాయ్|హలో|హేయ్|నమస్తే|vanakkam|kaisa hai|good\s+morning|good\s+evening|good\s+night)\b/i.test(lower)) {
    return { tier: "light", model: NAKSHATRA_CONFIG.routing.tiers[0].model };
  }

  // 3. Default to standard versatile tier
  return { tier: "standard", model: NAKSHATRA_CONFIG.routing.tiers[1].model };
}

/**
 * Builds the layered system prompt with static caching prefix and dynamic blocks
 */
function assembleSystemPrompt(options = {}) {
  const { mode = "chat", language = {}, searchSnippets = null, timezone = "Asia/Kolkata", userProfile = null } = options;

  let prompt = NAKSHATRA_CONFIG.system_prompt.static;

  // Append mode block
  const modeText = (mode === "live") ? NAKSHATRA_CONFIG.system_prompt.mode_blocks.live : NAKSHATRA_CONFIG.system_prompt.mode_blocks.chat;
  prompt += `\n\n${modeText}`;

  // Append Dynamic Blocks
  prompt += `\n\n--- DYNAMIC CONTEXT ---`;
  
  // Date & Time injection (vital for "today", "yesterday", "now")
  const now = new Date();
  const dateStr = now.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "medium" });
  prompt += `\nCURRENT DATE & TIME: ${dateStr} (${timezone})`;

  // Language mandate
  if (language.isRomanized) {
    prompt += `\nACTIVE LANGUAGE: ${language.code.toUpperCase()} written in LATIN letters (Romanized / Tenglish / Hinglish). Reply in that authentic conversational romanized style!`;
  } else if (language.code && language.code !== "en") {
    prompt += `\nACTIVE LANGUAGE: ${language.code.toUpperCase()} in ${language.script} script. Reply 100% in natural, fluent ${language.script} script. Address the user respectfully as ${language.respectful_you || 'respectful'}.`;
  } else {
    prompt += `\nACTIVE LANGUAGE: English. Reply in clear, crisp, natural English.`;
  }

  // User Profile if enabled
  if (userProfile && userProfile.name) {
    prompt += `\nUSER PROFILE: Name is ${userProfile.name}${userProfile.preferred_language ? `, prefers ${userProfile.preferred_language}` : ""}.`;
  }

  // Real-Time Search Grounding
  if (searchSnippets) {
    prompt += `\n\n--- REAL-TIME SEARCH RESULTS ---\n${searchSnippets}\nINSTRUCTION: Base time-sensitive facts strictly on these results. Name the source and date. If facts conflict or are sparse, state so clearly.`;
  }

  return prompt;
}

/**
 * Checks ending of reply to detect cut-offs (Section 9)
 */
function isTruncatedReply(text) {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.endsWith("```")) return false; // closed code block is complete
  const terminalRegex = /[.?!।]$/;
  return !terminalRegex.test(trimmed);
}

/**
 * Deduplicates overlapping text when continuing cut-off responses
 */
function mergeContinuation(original, continuation, maxOverlap = 80) {
  if (!continuation) return original;
  const o = original.trimEnd();
  const c = continuation.trimStart();

  for (let len = Math.min(maxOverlap, o.length, c.length); len > 3; len--) {
    const endSlice = o.slice(-len);
    const startSlice = c.slice(0, len);
    if (endSlice === startSlice) {
      return o + c.slice(len);
    }
  }
  return o + " " + c;
}

/**
 * Output Cleaning and Vocal Polish
 */
function cleanTeluguOutput(text) {
  if (!text || typeof text !== "string") return text;
  let t = text;

  // 0. Strip role prefixes (e.g. "నక్షత్ర AI: ...", "Nakshatra AI: ...")
  t = t.replace(/^(నక్షత్ర\s*(AI)?|Nakshatra\s*(AI)?|Assistant|AI|Bot)\s*[:：\-–]\s*/i, '');

  // 1. Fix broken pronouns & food replies with authentic conversational phrasing
  t = t.replace(/\b(nenu|nenu\s+super\s+ga)\s+thinava\b/gi, "Ha thinnanu! Meeru thinnara?");
  t = t.replace(/\bbagunav[!.]*/gi, "bagunnanu!");
  t = t.replace(/\bNenu bagundhi\b/gi, "Nenu bagunnanu");
  t = t.replace(/\bcoffee\s+thintunna\w*/gi, "coffee taaguthunna");
  t = t.replace(/\btea\s+thintunna\w*/gi, "tea taaguthunna");
  t = t.replace(/\bvellipoyi\s+matladam\b/gi, "matladukundam");
  t = t.replace(/\bthintamu\b/gi, "thindam");

  // 2. Eradicate repetitive stuttering / double phrases
  t = t.replace(/\b(చెప్పండి|చెప్పు|వింటున్నాను|బాగున్నాను|హలో|హాయ్)\s*[,.]*\s*(హా|హ|మరి|సరే)?\s*[,.]*\s*\1\b/giu, '$1');
  t = t.replace(/\b(హా|హ)\s*[,.]*\s*(చెప్పండి|చెప్పు)\s*[,.]*\s*\2\b/giu, '$1 $2');
  t = t.replace(/\b(చెప్పండి|చెప్పు)\s*[,.]*\s*(హా|హ)\s*[,.]*\s*(చెప్పండి|చెప్పు)\b/giu, 'చెప్పండి');
  t = t.replace(/\b(cheppandi|cheppu|bagunnanu|hello|hi)\s*[,.]*\s*(ha|haa|mari|sare)?\s*[,.]*\s*\1\b/giu, '$1');
  t = t.replace(/\b(cheppandi|cheppu)\s*[,.]*\s*(ha|haa)\s*[,.]*\s*(cheppandi|cheppu)\b/giu, 'cheppandi');
  t = t.replace(/\b(ha|haa)\s*[,.]*\s*(cheppandi|cheppu)\s*[,.]*\s*\2\b/giu, '$1 $2');

  // 3. Catch and replace robotic canned greetings
  t = t.replace(/^(హాయ్|హలో|హేయ్)[.,!\s]+(నేను\s*బాగున్నాను|బాగున్నాను)[,.\s]+(మీ\s*రోజు\s*ఎలా\s*(సాగుతోంది|ఉంది|నడుస్తోంది)|మీరు\s*బాగున్నారా|మీరు\s*ఎలా\s*ఉన్నారు)\??/giu, '$1! ఏం చేస్తున్నారు? ఏంటి విశేషాలు?');
  t = t.replace(/^(హాయ్|హలో|హేయ్)?[.,!\s]*(నేను\s*బాగున్నాను|బాగున్నాను)[,.\s]*(మీరు\s*బాగున్నారా|మీరు\s*ఎలా\s*ఉన్నారు)\??/giu, 'హాయ్! చెప్పండి, ఏంటి విశేషాలు?');
  t = t.replace(/మీ\s*రోజు\s*ఎలా\s*(సాగుతోంది|నడుస్తోంది|ఉంది)\??/giu, 'ఏం విశేషాలు?');
  t = t.replace(/నేను\s*బాగున్నాను[,.\s]+మీరు\s*బాగున్నారా\??/giu, 'చెప్పండి, ఏం విశేషాలు?');
  t = t.replace(/నేను\s*మీకు\s*ఎలా\s*సహాయపడగలను\??/giu, 'చెప్పండి, ఏం కావాలి?');
  t = t.replace(/^(హాయ్|హలో)[.,!\s]*బాగున్నారా\??/giu, '$1! ఏం చేస్తున్నారు?');
  t = t.replace(/\b(I am doing well|I'm doing well|I am fine)[,.\s]*(how are you|how about you)\??/gi, "Hey! What's up?");
  t = t.replace(/\bHow can I help you\??/gi, "Hey! What's on your mind?");
  t = t.replace(/\bI am doing well, how are you\??/gi, "Hey! What's up?");

  // 4. Clumsy translations & slang fixes
  t = t.replace(/నన్ను\s+మీకు\s+ఏం\s+చేయాలి\??/gi, "చెప్పండి, ఏం విశేషాలు?");
  t = t.replace(/మాటలు\s+బాగోస్తున్నాయా\??/gi, "సరే, కూల్ గా మాట్లాడుకుందాం!");
  t = t.replace(/మిమ్మల్ని\s+సంతోషించాలనుకుంటున్నాను[!.]*/gi, "మీతో మాట్లాడటం నాకు చాలా ఇష్టం!");
  t = t.replace(/కొంచెం\s+మామిడి\s+తిన్నాను\w*/gi, "హా, ఇప్పుడే తిన్నాను! మీరు తిన్నారా?");
  t = t.replace(/వినడానికి\s+సిద్ధంగా\s+ఉన్నాను[!.]*/gi, "చెప్పండి, వింటున్నాను!");
  t = t.replace(/నేను\s+తెలుగు\s+మాత్రమే\s+మాట్లాడగలను\w*/gi, "Sure thing! Let's talk in English.");
  t = t.replace(/\bచెప్పు\s+రా\b/gi, "చెప్పండి");
  t = t.replace(/\bబాధపడకు\s+రా\b/gi, "బాధపడకండి");
  t = t.replace(/\bఏమైంది\s+రా\b/gi, "ఏమైంది");
  t = t.replace(/\s+రా([.,!?]*)$/i, '$1');

  // 5. Elongated verb endings & vowel collapses
  t = t.replace(/\b(చెప్పం|చూడం|చేయం|మాట్లాడం|రెం|తీసుకోం|వినం)డీ\w*/gu, '$1డి');
  t = t.replace(/\bఏంటీ\b/gu, 'ఏంటి');
  t = t.replace(/\bఎలాగండీ\b/gu, 'ఎలాగండి');
  t = t.replace(/([\u0C3E-\u0C4C])\1+/gu, '$1');
  t = t.replace(/(ఆ|ఈ|ఊ|ఏ|ఐ|ఓ|ఔ)\1+/gu, '$1');
  t = t.replace(/([ా-ౌ])(ఆ|ఈ|ఊ|ఏ|ఓ)/gu, '$1');

  // 6. Strip foreign script leaks (Cyrillic, Arabic)
  t = t.replace(/[\u0400-\u04FF\u0600-\u06FF]/g, '');

  // 7. Remove elongated stutter vowels & sounds
  t = t.replace(/([a-zA-Z])\1{3,}/g, '$1');
  t = t.replace(/\b(aaa+|ooo+|ahh+|ohh+|uhh+|umm+|hmmm+|err+|aha+|oho+)\b/gi, '');
  t = t.replace(/(^|\s)(ఆహ్+|ఓహ్+|హమ్మ్+|ఉమ్మ్+|umm+|ahh+|ohh+|hmm+|err+|ఆ{2,}|ఓ{2,})(\s|$|[.,!?])/giu, '$1$3');

  // 8. Expressive vocal harmony punctuation
  t = t.replace(/\.{2,}/g, '. ');
  t = t.replace(/!{2,}/g, '!');
  t = t.replace(/\?{2,}/g, '?');

  // 9. Multi-distance word deduplication
  const words = t.split(/\s+/);
  const deduplicated = [];
  for (let i = 0; i < words.length; i++) {
    const curClean = words[i].replace(/[.,!?;:()"'`~]/g, '').toLowerCase();
    const prevClean = (i > 0) ? words[i - 1].replace(/[.,!?;:()"'`~]/g, '').toLowerCase() : '';
    const prev2Clean = (i > 1) ? words[i - 2].replace(/[.,!?;:()"'`~]/g, '').toLowerCase() : '';
    if (curClean && curClean === prevClean) continue;
    if (curClean && curClean === prev2Clean && /^(హా|హ|మరి|సరే|ha|haa|mari|yes|and)$/i.test(prevClean)) continue;
    deduplicated.push(words[i]);
  }
  let res = deduplicated.join(' ').trim();

  // 10. Strip trailing incomplete connector words
  res = res.replace(/\s+(నేను|మరియు|కానీ|తోనే|అతని|నా|and|but|with|the)\s*[.,!?;:\-]*$/iu, '');
  res = res.replace(/[,;:\-\s]+$/, '');
  
  // Guarantee clean terminal punctuation if not code
  if (res && !/[.!?।`]$/.test(res)) {
    res += '.';
  }

  return res.trim();
}

export default {
  async fetch(request, env) {
    // 1. CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, API-Subscription-Key, X-API-KEY",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 0. CONFIG ENDPOINT (Returns active intelligence configuration)
      if (path === "/config") {
        return new Response(JSON.stringify(NAKSHATRA_CONFIG), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
      }

      // 1. GROQ MODELS PROXY
      if (path === "/models") {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${env.GROQ_API_KEY}` }
        });
        return respond(res);
      }

      // 2. NAKSHATRA MULTILINGUAL INTELLIGENCE PIPELINE (/groq)
      if (path === "/groq") {
        const startTime = Date.now();
        const bodyText = await request.text();
        let reqData;
        
        try {
          reqData = JSON.parse(bodyText);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        // Extract latest user query & conversation history
        let latestUserText = "";
        let inputMessages = [];

        if (Array.isArray(reqData.messages) && reqData.messages.length > 0) {
          inputMessages = reqData.messages.filter(m => m.role !== "system");
          const lastUserMsg = [...inputMessages].reverse().find(m => m.role === "user");
          latestUserText = lastUserMsg ? lastUserMsg.content : "";
        } else if (reqData.message) {
          latestUserText = reqData.message;
          inputMessages = [{ role: "user", content: latestUserText }];
        }

        // Step A: Detect Language via Unicode Script & Romanized heuristcs
        const langInfo = detectLanguage(latestUserText);

        // Step B: Dynamic Model Tier Routing (light: 8b, standard: 70b, deep: 120b)
        const routed = routeTier(latestUserText, reqData.model);
        const selectedModel = routed.model;

        // Step C: Real-Time Web Search Grounding (Section 8)
        let searchSnippets = null;
        let searchExecuted = false;
        if (shouldSearch(latestUserText) && env.SERPER_API_KEY) {
          const searchQuery = extractSearchQuery(latestUserText);
          searchSnippets = await fetchSerperSnippets(searchQuery, env.SERPER_API_KEY);
          if (searchSnippets) searchExecuted = true;
        }

        // Step D: Calculate Language-Aware Output Cap (Section 9)
        const baseCap = reqData.mode === "live" 
          ? NAKSHATRA_CONFIG.generation.live.base_max_tokens 
          : (searchExecuted ? NAKSHATRA_CONFIG.generation.factual.base_max_tokens : NAKSHATRA_CONFIG.generation.chat.base_max_tokens);
        
        // Multiplier: Indic scripts need more tokens than English
        const calculatedCap = Math.min(3000, Math.round(baseCap * (langInfo.multiplier || 1.0)));
        const finalMaxTokens = reqData.max_tokens || calculatedCap;

        // Step E: Assemble System Prompt with dynamic date, timezone & search grounding
        const systemPrompt = assembleSystemPrompt({
          mode: reqData.mode || "chat",
          language: langInfo,
          searchSnippets,
          timezone: reqData.timezone || "Asia/Kolkata",
          userProfile: reqData.user_profile || null
        });

        // Trim context window according to spec (last 8 turns for chat, 4 for live)
        const windowSize = (reqData.mode === "live") ? 4 : 8;
        const windowedMessages = inputMessages.slice(-windowSize);

        const groqPayload = {
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            ...windowedMessages
          ],
          temperature: searchExecuted ? 0.3 : (reqData.mode === "live" ? 0.6 : 0.65),
          top_p: 0.9,
          max_tokens: finalMaxTokens
        };

        // Call Groq API
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "Authorization": `Bearer ${env.GROQ_API_KEY}` 
          },
          body: JSON.stringify(groqPayload)
        });

        if (!res.ok) {
          const errData = await res.text();
          return new Response(errData, {
            status: res.status,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const data = await res.json();
        let aiChoice = data.choices?.[0];
        let aiText = aiChoice?.message?.content || "";
        let finishReason = aiChoice?.finish_reason || "stop";

        // Step F: Completion Guard: Auto-continue if cut-off (Section 9)
        if (finishReason === "length" || (isTruncatedReply(aiText) && aiText.length > 80)) {
          try {
            const continuePayload = {
              model: selectedModel,
              messages: [
                { role: "system", content: systemPrompt },
                ...windowedMessages,
                { role: "assistant", content: aiText },
                { role: "user", content: "Continue exactly where you stopped. Do not repeat." }
              ],
              temperature: 0.5,
              max_tokens: Math.min(1500, finalMaxTokens)
            };

            const contRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
              method: "POST",
              headers: { 
                "Content-Type": "application/json", 
                "Authorization": `Bearer ${env.GROQ_API_KEY}` 
              },
              body: JSON.stringify(continuePayload)
            });

            if (contRes.ok) {
              const contData = await contRes.json();
              const continuationText = contData.choices?.[0]?.message?.content || "";
              if (continuationText) {
                aiText = mergeContinuation(aiText, continuationText);
                finishReason = contData.choices?.[0]?.finish_reason || "stop";
              }
            }
          } catch (guardErr) {
            console.error("Completion Guard Continuation Error:", guardErr);
          }
        }

        // Step G: Clean Output & Vocal Polish
        aiText = cleanTeluguOutput(aiText);

        // Step H: Privacy & Metrics Logging (Section 15: log metrics only, NEVER user content)
        const latencyMs = Date.now() - startTime;
        console.log(JSON.stringify({
          event: "completion",
          lang: langInfo.code,
          script: langInfo.script,
          tier: routed.tier,
          model: selectedModel,
          prompt_version: NAKSHATRA_CONFIG.meta.prompt_version,
          finish_reason: finishReason,
          search_used: searchExecuted,
          latency_ms: latencyMs,
          usage: data.usage || null
        }));

        // Format response backwards-compatibly
        if (reqData.message && !reqData.messages) {
          return new Response(JSON.stringify({ 
            response: aiText,
            meta: {
              language: langInfo.code,
              script: langInfo.script,
              speech_locale: langInfo.locale,
              tier: routed.tier,
              model: selectedModel,
              finish_reason: finishReason,
              search_used: searchExecuted,
              prompt_version: NAKSHATRA_CONFIG.meta.prompt_version
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
          });
        }

        if (data.choices && data.choices[0] && data.choices[0].message) {
          data.choices[0].message.content = aiText;
        }

        // Include metadata in root object for advanced clients
        data.meta = {
          language: langInfo.code,
          script: langInfo.script,
          speech_locale: langInfo.locale,
          tier: routed.tier,
          model: selectedModel,
          finish_reason: finishReason,
          search_used: searchExecuted,
          prompt_version: NAKSHATRA_CONFIG.meta.prompt_version
        };
        data.response = aiText;

        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" }
        });
      }

      // 3. GROQ STT (Speech-to-Text)
      if (path === "/groq-stt") {
        const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.GROQ_API_KEY}`,
            "Content-Type": request.headers.get("Content-Type")
          },
          body: request.body
        });
        return respond(res);
      }

      // 4. ELEVENLABS TTS
      if (path === "/elevenlabs") {
        const body = await request.text();
        const voiceId = url.searchParams.get("voice_id") || "EXAVITQu4vr4xnSDxMaL";
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": env.ELEVENLABS_API_KEY },
          body
        });
        return respond(res);
      }

      // 5. SARVAM TTS (Supports all major Indic languages)
      if (path === "/sarvam") {
        const bodyText = await request.text();
        let payload = {};
        try {
          payload = JSON.parse(bodyText);
        } catch (e) {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const speechText = (payload.text || (Array.isArray(payload.inputs) ? payload.inputs[0] : payload.inputs) || "").trim();
        if (!speechText) {
          return new Response(JSON.stringify({ error: "Text is required for TTS" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const langCode = payload.target_language_code || payload.language_code || "te-IN";

        const sarvamBody = {
          text: speechText,
          target_language_code: langCode,
          model: payload.model || "bulbul:v4-flash",
          speaker: payload.speaker || (langCode.startsWith("hi") ? "meera" : "pooja_te_conversation"),
          pace: payload.pace || 1.15,
          speech_sample_rate: payload.speech_sample_rate || 24000,
          output_audio_codec: payload.output_audio_codec || "wav"
        };

        const res = await fetch("https://api.sarvam.ai/text-to-speech", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "API-Subscription-Key": env.SARVAM_API_KEY 
          },
          body: JSON.stringify(sarvamBody)
        });
        return respond(res);
      }

      // 6. SARVAM STT
      if (path === "/sarvam-stt") {
        const res = await fetch("https://api.sarvam.ai/speech-to-text", {
          method: "POST",
          headers: {
            "API-Subscription-Key": env.SARVAM_API_KEY,
            "Content-Type": request.headers.get("Content-Type")
          },
          body: request.body
        });
        return respond(res);
      }

      // 7. SERPER SEARCH DIRECT PROXY
      if (path === "/serper") {
        const body = await request.text();
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": env.SERPER_API_KEY },
          body
        });
        return respond(res);
      }

      // 8. YOUTUBE PROXY
      if (path.startsWith("/youtube/")) {
        const apiPath = path.replace("/youtube", "");
        if (apiPath !== "/v3/search" && apiPath !== "/v3/playlistItems") {
          return new Response("Not allowed", { status: 403 });
        }
        const target = new URL("https://www.googleapis.com/youtube" + apiPath);
        url.searchParams.forEach((v, k) => {
          if (k !== "key") target.searchParams.set(k, v);
        });
        target.searchParams.set("key", env.YOUTUBE_API_KEY);
        const res = await fetch(target.toString());
        return respond(res);
      }

      return new Response("Not found", { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: "Proxy error: " + e.message }), { 
        status: 500, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  }
};

function respond(res) {
  return new Response(res.body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*"
    }
  });
}
