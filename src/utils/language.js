export function analyzeLanguageSignal(
  text,
  isVoiceInput = false,
  sttMeta = null,
  prevLang = 'en',
  liveLangMode = 'auto'
) {
  const fallbackLang = prevLang || 'en';
  if (!text || typeof text !== 'string') {
    return { lang: fallbackLang, strength: 'neutral', isBackchannel: true };
  }
  const t = text.trim();
  if (!t || /^[\s.,!?…\-–—~"'`।]+$/u.test(t)) {
    return { lang: fallbackLang, strength: 'neutral', isBackchannel: true };
  }
  if (isVoiceInput && liveLangMode === 'te') {
    return { lang: 'te', strength: 'explicit', isBackchannel: false };
  }
  if (isVoiceInput && liveLangMode === 'en') {
    return { lang: 'en', strength: 'explicit', isBackchannel: false };
  }

  const lower = t.toLowerCase();
  const normalized = lower.replace(/^[\s.,!?'"~…\-–—।]+|[\s.,!?'"~…\-–—।]+$/gu, '').replace(/\s+/g, ' ');

  // 1. Explicit language switch requests (ignore meta-questions like "how do you say X in Telugu")
  const isMetaLangQuestion = /\b(?:how\s+do\s+you\s+say|how\s+to\s+say|what\s+is\s+the\s+word|why\s+do\s+people|do\s+people\s+speak)\b/i.test(
    lower
  );
  const reqLang = {
    telugu: 'te',
    english: 'en',
    hindi: 'hi',
    tamil: 'ta',
    kannada: 'kn',
    malayalam: 'ml',
    marathi: 'mr',
    bengali: 'bn',
    gujarati: 'gu',
    punjabi: 'pa',
    odia: 'or',
    spanish: 'es',
    french: 'fr',
    german: 'de'
  };
  const explicitSwitchEn =
    !isMetaLangQuestion &&
    (/^(?:please\s+|pls\s+|can\s+you\s+|could\s+you\s+|let'?s\s+|now\s+|ok(?:ay)?\s+|hey\s+|nakshatra\s+)*(?:speak|talk|reply|respond|answer|chat|explain|continue|switch)\s+(?:(?:to\s+me|with\s+me|with|to)\s+)?(?:in\s+)?(telugu|english|hindi|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|spanish|french|german)\b/i.test(
      lower
    ) ||
      /\b(?:switch\s+to|talk\s+to\s+me\s+in|speak\s+to\s+me\s+in|reply\s+in|respond\s+in|answer\s+in|speak\s+in|talk\s+in|continue\s+in)\s+(telugu|english|hindi|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|spanish|french|german)\b/i.test(
        lower
      ) ||
      /^(?:speak\s+|talk\s+|reply\s+)?(?:in\s+)?(telugu|english|hindi|tamil|kannada|malayalam|marathi|bengali|gujarati|punjabi|odia|spanish|french|german)\s*(?:lo|mein|me|la|please|pls)?[.!?\s]*$/i.test(
        lower
      ));
  if (explicitSwitchEn) {
    for (const [kw, code] of Object.entries(reqLang)) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(lower)) {
        return { lang: code, strength: 'explicit', isBackchannel: false };
      }
    }
  }
  if (
    /\b(?:telugu\s*(?:lo|mein|me|la)\s*(?:cheppu|cheppandi|matladu|matladandi|cheptha|matladukundam|bolo|boliye|batao|bataiye|baat\s*(?:karo|kariye|kijiye)|samjhao|pesu|pesunga|sollu|sollunga)|తెలుగు\s*లో\s*(?:చెప్పు|చెప్పండి|మాట్లాడు|మాట్లాడండి|చెప్తారా|మాట్లాడుకుందాం))\b/iu.test(
      t
    ) ||
    /^(?:తెలుగు|తెలుగులో|తెలుగు\s*లో)[.!?\s]*$/u.test(t)
  ) {
    return { lang: 'te', strength: 'explicit', isBackchannel: false };
  }
  if (
    /\b(?:english\s*(?:lo|mein|me|la)\s*(?:cheppu|cheppandi|matladu|matladandi|matladukundam|bolo|boliye|batao|bataiye|baat\s*(?:karo|kariye|kijiye)|samjhao|pesu|pesunga|sollu|sollunga)|ఇంగ్లీష్\s*లో\s*(?:చెప్పు|చెప్పండి|మాట్లాడు|మాట్లాడండి)|(?:इंग्लिश|इंगलिश)\s*में\s*(?:बोलो|बोलिए|बताओ|बताइए|बात\s*(?:करो|करिए|कीजिए)|समझाओ))\b/iu.test(
      t
    ) ||
    /^(?:ఇంగ్లీష్|ఇంగ్లీష్\s*లో|इंग्लिश|इंगलिश)(?:\s*(?:please|pls|లో|में))?[.!?\s]*$/iu.test(t)
  ) {
    return { lang: 'en', strength: 'explicit', isBackchannel: false };
  }
  if (
    /\b(?:hindi\s*(?:lo|mein|me|la)\s*(?:bolo|boliye|batao|bataiye|baat\s*(?:karo|kariye|kijiye)|samjhao|cheppu|cheppandi|matladu|matladandi)|हिंदी\s*में\s*(?:बोलो|बोलिए|बताओ|बताइए|बात\s*(?:करो|करिए|कीजिए)|समझाओ))\b/iu.test(
      t
    ) ||
    /^(?:हिंदी|हिंदी\s*में)(?:\s*(?:please|pls))?[.!?\s]*$/iu.test(t)
  ) {
    return { lang: 'hi', strength: 'explicit', isBackchannel: false };
  }
  if (
    /\b(?:tamil\s*(?:la|il|lo|mein|me)\s*(?:pesu|pesunga|sollu|sollunga|bolo|boliye|baat\s*(?:karo|kariye|kijiye)|cheppu|cheppandi)|தமிழ்ல\s*(?:பேசு|பேசுங்க|சொல்லு|சொல்லுங்க))\b/iu.test(
      t
    )
  ) {
    return { lang: 'ta', strength: 'explicit', isBackchannel: false };
  }

  // 2. Universal short backchannels / fillers (Latin & Sarvam-transliterated Indic English fillers)
  const singleBackchannel =
    /^(?:ok|okay|k|kk|oh|ooh|ah|aah|uh|um|umm|uhh|h+m+|m+m+|yes|yeah|yep|yup|ya|yet|no|nope|nah|hi|hey|hello|hii+|heyy+|bye|byee+|nice|cool|super|good|great|fine|right|alright|all\s+right|sure|wow|really|please|pls|sorry|thanks|thank\s+you|thank\s+u|tx|thx|got\s+it|i\s+see|wait|hold\s+on|hang\s+on|one\s+sec|one\s+second|one\s+minute|just\s+a\s+sec|go\s+ahead|go\s+on|carry\s+on|continue|what|why|how|when|where|who|pardon|excuse\s+me|say\s+again|come\s+again|tell\s+me|true|same|correct|exactly|awesome|wonderful|amazing|nothing|never\s+mind|no\s+problem|no\s+worries|sounds\s+good|all\s+good|gotcha|uh\s+huh|mm\s+hmm)$/i;
  const comboBackchannel =
    /^(?:ok|okay|k|oh|ooh|ah|uh|um|umm|h+m+|yes|yeah|yep|yup|ya|yet|no|nope|nah|hi|hey|hello|alright|all\s+right|sure|well|so|actually|really)(?:[\s,]+(?:ok|okay|thanks|thank\s+you|thank\s+u|nice|cool|good|great|super|fine|right|sure|what|why|how|really|please|pls|sorry|bye|wait|wait\s+a\s+(?:sec|second|minute|moment)|one\s+(?:sec|second|minute|moment)|hold\s+on|go\s+ahead|go\s+on|tell\s+me|got\s+it|i\s+see|no\s+problem|no\s+worries|never\s+mind|all\s+good|sounds\s+good|hello|hi|sir|bro|buddy))+$/i;
  const politeFiller =
    /^(?:thank\s+you(?:\s+(?:so|very)\s+much)?|thanks(?:\s+a\s+lot)?|wait\s+(?:a|one)\s+(?:sec|second|minute|moment)|(?:one|just\s+a)\s+(?:sec|second|minute|moment)(?:\s+wait)?|say\s+(?:that\s+)?again|come\s+again|what\s+(?:is\s+it|was\s+that|happened|did\s+you\s+say)|is\s+that\s+so|oh\s+(?:really|my\s+god|i\s+see)|so\s+(?:nice|cool|good|great)|sounds\s+(?:good|great|fun|nice|cool)|that'?s\s+(?:nice|cool|good|great|fine|true|awesome|interesting|ok|okay)|it'?s\s+(?:ok|okay|fine|good|alright)|good\s+(?:morning|afternoon|evening|night)|see\s+you(?:\s+later)?|take\s+care)$/i;
  const indicTranslitFillerTe =
    /^(?:ఓకే|ఒకే|హలో|హాయ్|హే|హేయ్|ఎస్|యెస్|యా|నో|థాంక్స్|థ్యాంక్స్|థాంక్యూ|థ్యాంక్యూ|సారీ|గుడ్|నైస్|సూపర్|గ్రేట్|బాయ్|వాట్|వెయిట్|ప్లీజ్|రైట్|కంటిన్యూ|గాట్\s*ఇట్|నో\s*ప్రాబ్లం|గుడ్\s*మార్నింగ్|గుడ్\s*నైట్|ఆల్\s*రైట్|హమ్+|ఆ+|ఓ+)(?:[\s,]+(?:ఓకే|ఒకే|థాంక్స్|థ్యాంక్స్|థాంక్యూ|థ్యాంక్యూ|సార్|అండి|బాయ్|ప్లీజ్|వాట్|యెస్|నో|నైస్|గుడ్))*$/u;
  const indicTranslitFillerHi =
    /^(?:ओके|ओ\s*के|हेलो|हैलो|हाय|हे|यस|या|नो|थैंक्स|थैंक\s*यू|थैंक्यू|सॉरी|गुड|नाइस|सुपर|ग्रेट|बाय|वाट|व्हाट|वेट|प्लीज|प्लीज़|राइट|ऑल\s*राइट|गुड\s*मॉर्निंग|गुड\s*नाइट|नो\s*प्रॉब्लम|हम्म+|ओ+|आ+)(?:[\s,।]+(?:ओके|थैंक्स|थैंक\s*यू|जी|सर|प्लीज|बाय|नाइस|गुड))*$/u;

  if (
    singleBackchannel.test(normalized) ||
    comboBackchannel.test(normalized) ||
    politeFiller.test(normalized) ||
    indicTranslitFillerTe.test(t.replace(/[\s.,!?…\-–—]+$/u, '').trim()) ||
    indicTranslitFillerHi.test(t.replace(/[\s.,!?…\-–—।]+$/u, '').trim())
  ) {
    return { lang: fallbackLang, strength: 'neutral', isBackchannel: true };
  }

  const acousticCode = sttMeta?.languageCode ? String(sttMeta.languageCode).toLowerCase().split('-')[0] : '';
  const acousticProb = Number(sttMeta?.languageProbability || 0);

  const englishWordMatches =
    lower.match(
      /\b(i|i'm|i've|i'll|i'd|you|you're|you've|we|we're|they|they're|he|she|it|it's|that's|what's|there's|here's|don't|can't|won't|didn't|doesn't|isn't|aren't|the|a|an|is|are|am|was|were|be|been|being|have|has|had|do|does|did|can|could|would|should|will|shall|may|might|must|what|why|how|when|where|who|which|whose|whom|this|that|these|those|its|your|yours|my|mine|me|our|their|him|her|them|us|and|or|but|if|then|because|so|for|with|from|into|about|after|before|between|under|over|above|below|not|no|yes|explain|tell|speak|talk|show|give|make|take|know|think|want|need|like|love|help|play|open|read|write|check|find|start|stop|keep|stay|listen|watch|look|feel|seem|sound|sounds|mean|means|say|said|ask|answer|try|use|work|working|time|today|tomorrow|yesterday|now|here|there|story|joke|fact|weather|music|movie|food|water|ocean|space|moon|earth|sun|star|stars|science|history|news|price|score|cricket|coffee|tea|please|thanks|thank|sorry|morning|evening|night|actually|honestly|really|very|much|more|most|some|any|all|every|many|few|just|also|even|still|already|awesome|wonderful|amazing|fantastic|interesting|maybe|nothing|something|everything|everyone|someone|always|never|welcome|problem|idea|life|world|people|thing|things|way|good|great|bad|new|old|first|last|next|fun|right|wrong|true|false|fine|nice|cool|super|little|big|small|long|short|high|low|easy|hard|fast|slow|best|better)\b/g
    ) || [];
  const englishGrammarMatches =
    lower.match(
      /\b(i|i'm|i've|i'll|i'd|you|you're|we|they|he|she|it|it's|that's|what's|don't|can't|won't|didn't|doesn't|isn't|aren't|the|a|an|is|are|am|was|were|be|been|have|has|had|do|does|did|will|would|can|could|should|what|why|how|when|where|who|which|this|that|these|those|and|or|but|if|because|for|with|from|into|about|not|my|your|our|their)\b/g
    ) || [];
  const latinCount = (t.match(/[a-zA-Z]/g) || []).length;
  const latinWords = t.match(/[a-zA-Z]+(?:'[a-zA-Z]+)?/g) || [];

  // 3. Native Unicode script detection across Indic & global scripts
  const scriptCounts = {
    te: (t.match(/[\u0C00-\u0C7F]/g) || []).length,
    hi: (t.match(/[\u0900-\u097F]/g) || []).length,
    ta: (t.match(/[\u0B80-\u0BFF]/g) || []).length,
    ml: (t.match(/[\u0D00-\u0D7F]/g) || []).length,
    kn: (t.match(/[\u0C80-\u0CFF]/g) || []).length,
    bn: (t.match(/[\u0980-\u09FF]/g) || []).length,
    gu: (t.match(/[\u0A80-\u0AFF]/g) || []).length,
    pa: (t.match(/[\u0A00-\u0A7F]/g) || []).length,
    or: (t.match(/[\u0B00-\u0B7F]/g) || []).length
  };
  let bestScript = null;
  let bestCount = 0;
  for (const [code, cnt] of Object.entries(scriptCounts)) {
    if (cnt > bestCount) {
      bestCount = cnt;
      bestScript = code;
    }
  }

  if (bestCount >= 2 || (bestCount >= 1 && !/[a-zA-Z]{3,}/.test(t))) {
    const scriptCode = bestScript === 'hi' && acousticCode === 'mr' ? 'mr' : bestScript;
    const indicTokens = t.split(/\s+/).filter((tok) => /[\u0900-\u0DFF]/.test(tok));
    const isEnglishMatrixWithQuotedIndic =
      latinCount > bestCount * 2.2 && indicTokens.length <= 1 && englishWordMatches.length >= 2;

    if (!isEnglishMatrixWithQuotedIndic) {
      if (scriptCode === fallbackLang || !isVoiceInput) {
        return { lang: scriptCode, strength: 'strong', isBackchannel: false };
      }
      const hasIndicGrammar = {
        te: /(?:ఎలా|ఏంటి|ఏమిటి|ఏం|ఉన్నా|ఉంది|ఉన్నది|బాగు|నేను|మీరు|నువ్వు|నాకు|నీకు|మనం|చెప్పు|చెప్పండి|చెప్పవా|చేస్తున్నా|తిన్నా|కావాలి|వద్దు|లేదు|అవును|సరే|ఎందుకు|ఎక్కడ|ఎప్పుడు|ఎవరు|ఎంత|అయింది|ఇక్కడ|అక్కడ|గురించి|ఇప్పుడు|కదా|చూడు|చూడండి|వినండి|తెలుసా|తెలియదు|మాట్లాడు|మాట్లాడండి|ఈరోజు|రేపు|నిన్న|కొంచెం|చాలా|మంచి|అంత|ఇంత|కథ|నమస్తే|నమస్కారం|ధన్యవాదాలు)/u,
        hi: /(?:कैसे|कैसी|क्यों|क्या|कहाँ|कब|कौन|कितना|मैं|आप|तुम|हम|मेरा|मेरी|तुम्हारा|आपका|मुझे|तुम्हें|हूँ|है|हैं|था|थी|थे|बताओ|बताइए|बोलो|बोलिए|करो|कीजिए|रहा|रही|रहे|नहीं|हाँ|जी|अच्छा|ठीक|बहुत|थोड़ा|आज|कल|नमस्ते|धन्यवाद|शुक्रिया|चाहिए|समझ)/u,
        ta: /(?:எப்படி|இருக்கீங்க|என்ன|நான்|நீங்கள்|சொல்லுங்க|சொல்லு|வணக்கம்|நன்றி|இல்லை|ஆமா|வேணும்|ரொம்ப|ஏன்|எங்க)/u,
        kn: /(?:ಹೇಗಿದ್ದೀರಾ|ಏನು|ನಾನು|ನೀವು|ಹೇಳಿ|ನಮಸ್ಕಾರ|ಧನ್ಯವಾದ|ಇಲ್ಲ|ಹೌದು|ಬೇಕು|ತುಂಬಾ|ಯಾಕೆ|ಎಲ್ಲಿ)/u,
        ml: /(?:എങ്ങനെയുണ്ട്|എന്താണ്|ഞാൻ|നിങ്ങൾ|പറയൂ|നമസ്കാരം|നന്ദി|ഇല്ല|അതെ|വേണം|വളരെ)/u
      };
      const hasGrammar = hasIndicGrammar[scriptCode]?.test(t) || false;

      if (sttMeta) {
        if (
          indicTokens.length >= 3 ||
          (indicTokens.length >= 2 && acousticProb >= 0.6) ||
          (hasGrammar && acousticProb >= 0.55) ||
          (bestCount >= 10 && acousticProb >= 0.72)
        ) {
          return { lang: scriptCode, strength: 'strong', isBackchannel: false };
        }
        if (hasGrammar || (indicTokens.length >= 2 && acousticProb >= 0.55)) {
          return { lang: scriptCode, strength: 'moderate', isBackchannel: false };
        }
        if (acousticProb > 0 && acousticProb < 0.55) {
          return { lang: scriptCode, strength: 'weak_noise', isBackchannel: false };
        }
        return { lang: scriptCode, strength: 'weak', isBackchannel: false };
      }
      if (indicTokens.length >= 2 || hasGrammar || bestCount >= 6) {
        return { lang: scriptCode, strength: 'strong', isBackchannel: false };
      }
      return { lang: scriptCode, strength: 'weak', isBackchannel: false };
    }
  }

  if (/[\u0600-\u06FF]{2,}/.test(t)) {
    return { lang: 'ar', strength: (t.match(/[\u0600-\u06FF]/g) || []).length >= 4 ? 'strong' : 'moderate', isBackchannel: false };
  }
  if (/[\u3040-\u30FF]{2,}/.test(t)) {
    return { lang: 'ja', strength: (t.match(/[\u3040-\u30FF]/g) || []).length >= 4 ? 'strong' : 'moderate', isBackchannel: false };
  }
  if (/[\uAC00-\uD7AF]{2,}/.test(t)) {
    return { lang: 'ko', strength: (t.match(/[\uAC00-\uD7AF]/g) || []).length >= 4 ? 'strong' : 'moderate', isBackchannel: false };
  }
  if (/[\u4E00-\u9FFF]{2,}/.test(t)) {
    return { lang: 'zh', strength: (t.match(/[\u4E00-\u9FFF]/g) || []).length >= 4 ? 'strong' : 'moderate', isBackchannel: false };
  }

  // 4. Unambiguous Romanized Indic vocabulary & multi-word phrases
  const tenglishMatches =
    lower.match(
      /\b(nuvvu|nenu|naaku|naku|neeku|meeru|manam|unnav|unna|unnaru|unnava|unnanu|unnam|unnara|unnadhi|undhi|undi|unnayi|enti|emiti|emaina|emundi|emledu|inkenti|inkem|cheppu|cheppandi|cheppava|cheppaledu|cheppakandi|cheyi|cheyandi|cheyyali|cheyali|cheptha|chepthava|chepthunna|chesava|chesaru|chesanu|chesara|cheddam|chesthunnav|chestunnav|chesthunna|chestunna|chesthunnam|chestunnaru|thinnava|tinnava|tinnav|thinnav|thinnanu|tinnanu|thinnara|tinnara|bagunnava|bagunnav|bagunnara|bagunnanu|bagundi|bagundhi|baagunnava|baagunnav|baagunnara|baagunnanu|baagundi|baagundhi|kavali|kaavali|vaddu|vaddhu|ledu|ledhu|enduku|endukante|ekkada|ekkadiki|eppudu|eppudaina|evaru|evarandi|entha|ayindi|ayyindi|avuthundi|avutundi|avthundi|ikkada|akkada|ikkadiki|akkadiki|gurinchi|ippudu|ippude|appudu|sare|sarele|avuna|avunu|aunu|ayyo|kadha|kada|chudu|chudandi|chuddam|chusanu|chusava|chusaru|chusthunna|chustunna|vinu|vinandi|vintunna|vinnava|vinnanu|telusa|teliyadu|thelusa|theliyadu|matladu|matladandi|matladukundam|eroju|repu|ninna|konchem|chala|manchi|manchidi|parledu|parvaledu|thappakunda|tappakunda|antha|intha|vishayam|vishesham|visheshalu|sangathi|sangatulu|sahayam|bhojanam|neellu|kuda|kaani|aithe|ayithe|lekapothe|kaakapothe|kakapothe|vachindi|vachava|vacharu|vastava|vellali|vellanu|vellava|vellaru|vastunna|vasthunna|vasthunnava|vastunnava|velthunna|veltunna|antunna|kaadu|kadu|podam|veldam|inkoka|anduke|andukani|malli|nijama|nijame|namaskaram|ivvu|ivvandi|teesko|teeskondi|theesko|theeskondi|santosham|kashtam|ishtam)\b/g
    ) || [];
  const tenglishPhrases =
    lower.match(
      /(?:^|\s)(?:em\s+(?:undi|undhi|ledu|ledhu|ayindi|ayyindi|chesthunnav|chestunnav|chesthunna|chestunna|cheyali|cheyyali|kavali|kaavali|sangathi|vishesham|visheshalu|le|ra|andi|cheppu|cheppandi|jarigindi|untundi|avuthundi|avutundi)|ela\s+(?:unnav|unnaru|unnava|undi|undhi|ayindi|ayyindi|cheyali|cheyyali|cheppu|cheppandi|vundhi|vundi|cheppali|veldam|vellali)|(?:adi|idi|mari|oka)\s+(?:kuda|kaadu|kadu|bagundi|baagundi|manchidi|ledu|undi|undhi|enti|emiti|cheppu|cheppandi))\b/g
    ) || [];
  const teTotalHits = tenglishMatches.length + tenglishPhrases.length;
  if (teTotalHits >= 1) {
    if (fallbackLang === 'te' || !isVoiceInput || teTotalHits >= 2 || tenglishPhrases.length >= 1 || englishWordMatches.length <= 1) {
      return { lang: 'te', strength: 'strong', isBackchannel: false };
    }
    return { lang: 'te', strength: 'moderate', isBackchannel: false };
  }

  const hinglishMatches =
    lower.match(
      /\b(kaise|kaisa|kaisi|kyun|kyon|batao|bataiye|theek|thik|nahi|nahin|haan|hanji|accha|achha|bahot|bahut|yaar|thakan|samajh|mujhe|tumhe|aapka|aapko|mera|meri|mere|humara|hamara|chahiye|kahan|kaha|kya|karo|kijiye|karna|hoga|raha|rahi|rahe|bhai|dost|zindagi|waqt|samay|aaj|shukriya|dhanyavad|maaf|zaroor|bilkul|sach|jhooth|kuch)\b/g
    ) || [];
  if (hinglishMatches.length >= 1) {
    if (fallbackLang === 'hi' || !isVoiceInput || hinglishMatches.length >= 2 || englishWordMatches.length <= 1) {
      return { lang: 'hi', strength: 'strong', isBackchannel: false };
    }
    return { lang: 'hi', strength: 'moderate', isBackchannel: false };
  }
  if (/\bnamaste\b/i.test(lower)) {
    return { lang: 'hi', strength: fallbackLang === 'hi' ? 'strong' : 'moderate', isBackchannel: false };
  }

  const tanglishMatches =
    lower.match(
      /\b(eppadi|epdi|irukinga|irukken|irukku|iruka|vanakkam|sollunga|sollu|enna|ennanga|romba|nandri|pannunga|pannu|panna|vaanga|ponga|theriyum|theriyadu|theriyadhu|nalla|inga|anga|eppothu|eppo|edhuku|yaaru)\b/g
    ) || [];
  if (tanglishMatches.length >= 1) {
    return {
      lang: 'ta',
      strength: fallbackLang === 'ta' || !isVoiceInput || tanglishMatches.length >= 2 || englishWordMatches.length <= 1 ? 'strong' : 'moderate',
      isBackchannel: false
    };
  }

  const kanglishMatches =
    lower.match(/\b(hegiddira|hegidiya|chennagiddini|chennagide|yaake|elli|yavaga|maadi|helu|heli|gottilla|gottu|banni|hogi|dhanyavada)\b/g) || [];
  if (kanglishMatches.length >= 1) {
    return {
      lang: 'kn',
      strength: fallbackLang === 'kn' || !isVoiceInput || kanglishMatches.length >= 2 ? 'strong' : 'moderate',
      isBackchannel: false
    };
  }

  const manglishMatches =
    lower.match(/\b(sukhamaano|sukhamano|engane|enthokke|njan|ningal|ariyaam|ariyilla|parayu|parayoo|cheyyu|cheyyoo|nanni)\b/g) || [];
  if (manglishMatches.length >= 1) {
    return {
      lang: 'ml',
      strength: fallbackLang === 'ml' || !isVoiceInput || manglishMatches.length >= 2 ? 'strong' : 'moderate',
      isBackchannel: false
    };
  }

  // 5. Common global Latin languages
  const esMatches =
    lower.match(
      /\b(hola|gracias|buenos|buenas|como estas|cómo estás|por favor|que tal|qué tal|donde|dónde|español|espanol|hablar|quiero|necesito|amigo|muy bien)\b/g
    ) || [];
  if (esMatches.length >= 1) {
    return {
      lang: 'es',
      strength:
        fallbackLang === 'es' ||
        !isVoiceInput ||
        esMatches.length >= 2 ||
        /\b(hola|gracias|buenos|buenas|cómo estás|como estas|por favor)\b/i.test(lower)
          ? 'strong'
          : 'moderate',
      isBackchannel: false
    };
  }
  const frMatches =
    lower.match(
      /\b(bonjour|bonsoir|merci|comment ca va|comment ça va|salut|s'il vous plait|s'il vous plaît|pourquoi|aujourd'hui|français|francais|parler|très bien|tres bien)\b/g
    ) || [];
  if (frMatches.length >= 1) {
    return {
      lang: 'fr',
      strength:
        fallbackLang === 'fr' ||
        !isVoiceInput ||
        frMatches.length >= 2 ||
        /\b(bonjour|bonsoir|merci|comment ça va|comment ca va|aujourd'hui)\b/i.test(lower)
          ? 'strong'
          : 'moderate',
      isBackchannel: false
    };
  }
  const deMatches =
    lower.match(/\b(hallo|danke|guten|wie geht|bitte|warum|heute|deutsch|sprechen|sehr gut)\b/g) || [];
  if (deMatches.length >= 1) {
    return {
      lang: 'de',
      strength:
        fallbackLang === 'de' ||
        !isVoiceInput ||
        deMatches.length >= 2 ||
        /\b(danke|guten morgen|guten tag|wie geht)\b/i.test(lower)
          ? 'strong'
          : 'moderate',
      isBackchannel: false
    };
  }

  // 6. Standard English evaluation
  if (englishWordMatches.length >= 1) {
    if (!isVoiceInput || fallbackLang === 'en') {
      return { lang: 'en', strength: 'strong', isBackchannel: false };
    }
    if (
      englishWordMatches.length >= 4 &&
      englishGrammarMatches.length >= 2 &&
      (!sttMeta || !acousticCode || acousticCode === 'en' || acousticProb < 0.75)
    ) {
      return { lang: 'en', strength: 'strong', isBackchannel: false };
    }
    if (englishWordMatches.length >= 3 || (latinWords.length >= 4 && englishGrammarMatches.length >= 2)) {
      return { lang: 'en', strength: 'moderate', isBackchannel: false };
    }
    return { lang: 'en', strength: 'weak', isBackchannel: false };
  }

  // 7. Fallback for unrecognized Latin / acoustic STT LID
  if (/^[a-zA-Z0-9\s.,!?'"~@#$%^&*()_\-+=/<>:;]+$/.test(t)) {
    if (isVoiceInput && fallbackLang !== 'en') {
      if (
        ['te', 'hi', 'mr', 'ta', 'ml', 'kn', 'bn', 'gu', 'pa', 'or'].includes(acousticCode) &&
        acousticCode !== fallbackLang &&
        acousticProb >= 0.9 &&
        latinWords.length >= 3
      ) {
        return { lang: acousticCode, strength: 'moderate', isBackchannel: false };
      }
      return { lang: fallbackLang, strength: 'neutral', isBackchannel: false };
    }
    if (
      ['te', 'hi', 'mr', 'ta', 'ml', 'kn', 'bn', 'gu', 'pa', 'or'].includes(acousticCode) &&
      acousticProb >= (isVoiceInput ? 0.92 : 0.85) &&
      latinWords.length >= 2
    ) {
      return { lang: acousticCode, strength: isVoiceInput ? 'moderate' : 'strong', isBackchannel: false };
    }
    return { lang: 'en', strength: isVoiceInput ? 'weak' : 'strong', isBackchannel: false };
  }

  return { lang: fallbackLang, strength: 'neutral', isBackchannel: false };
}

export function detectLanguage(text, isVoiceInput = false, sttMeta = null, prevLang = 'en', lastLiveTurnLang = null, liveLangMode = 'auto') {
  const sig = analyzeLanguageSignal(text, isVoiceInput, sttMeta, prevLang, liveLangMode);
  if (!isVoiceInput) {
    return sig.strength === 'neutral' || sig.strength === 'weak' || sig.strength === 'weak_noise'
      ? prevLang || 'en'
      : sig.lang;
  }
  if (sig.strength === 'explicit' || sig.strength === 'strong') return sig.lang;
  if (!lastLiveTurnLang && sig.strength === 'moderate') return sig.lang;
  return prevLang || 'en';
}

export function getLangDirective(lang) {
  const map = {
    en: 'Reply 100% in natural, fluent English.',
    hi: 'Reply in natural conversational Hindi (Devanagari script).',
    mr: 'Reply in natural conversational Marathi (Devanagari script).',
    ta: 'Reply in natural conversational Tamil.',
    ml: 'Reply in natural conversational Malayalam.',
    kn: 'Reply in natural conversational Kannada.',
    bn: 'Reply in natural conversational Bengali.',
    gu: 'Reply in natural conversational Gujarati.',
    pa: 'Reply in natural conversational Punjabi.',
    or: 'Reply in natural conversational Odia.',
    te: 'Reply in fluent, natural spoken Telugu (తెలుగు లిపి).',
    es: 'Reply in natural conversational Spanish.',
    fr: 'Reply in natural conversational French.',
    de: 'Reply in natural conversational German.'
  };
  return 'CRITICAL LANGUAGE DIRECTIVE: ' + (map[lang] || "Reply naturally in the exact language of the user's latest message.");
}

export function isLiveReplyLanguageMismatch(replyText, targetLang) {
  const t = String(replyText || '').trim();
  if (!t || !targetLang) return false;
  const latinWords = t.match(/[a-zA-Z]+/g) || [];
  const scriptRegexMap = {
    te: /[\u0C00-\u0C7F]/g,
    hi: /[\u0900-\u097F]/g,
    mr: /[\u0900-\u097F]/g,
    ta: /[\u0B80-\u0BFF]/g,
    kn: /[\u0C80-\u0CFF]/g,
    ml: /[\u0D00-\u0D7F]/g,
    bn: /[\u0980-\u09FF]/g,
    gu: /[\u0A80-\u0AFF]/g,
    pa: /[\u0A00-\u0A7F]/g,
    or: /[\u0B00-\u0B7F]/g
  };
  if (scriptRegexMap[targetLang]) {
    const targetCount = (t.match(scriptRegexMap[targetLang]) || []).length;
    return targetCount === 0 && latinWords.length >= 2;
  }
  if (targetLang === 'en') {
    const nonLatinCount = (t.match(/[\u0900-\u0DFF\u0600-\u06FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/g) || []).length;
    return (nonLatinCount >= 4 && latinWords.length < 4) || nonLatinCount > latinWords.length * 3;
  }
  return false;
}

export function resolveTtsVoice(txt, hintLang) {
  const base = hintLang || 'en';
  const ranges = {
    te: /[\u0C00-\u0C7F]/g,
    hi: /[\u0900-\u097F]/g,
    ta: /[\u0B80-\u0BFF]/g,
    ml: /[\u0D00-\u0D7F]/g,
    kn: /[\u0C80-\u0CFF]/g,
    bn: /[\u0980-\u09FF]/g,
    gu: /[\u0A80-\u0AFF]/g,
    pa: /[\u0A00-\u0A7F]/g,
    or: /[\u0B00-\u0B7F]/g
  };
  let best = null;
  let bestN = 0;
  for (const [c, re] of Object.entries(ranges)) {
    const n = (txt.match(re) || []).length;
    if (n > bestN) {
      bestN = n;
      best = c;
    }
  }
  const latin = (txt.match(/[a-zA-Z]/g) || []).length;
  const indicLangs = ['te', 'hi', 'mr', 'ta', 'ml', 'kn', 'bn', 'gu', 'pa', 'or'];
  let lang = base;
  if (bestN >= 2) lang = best === 'hi' && base === 'mr' ? 'mr' : best;
  else if (bestN === 0 && latin >= 3 && indicLangs.includes(base)) lang = 'en';
  const langMap = {
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
  const regional = ['ta', 'ml', 'kn', 'mr', 'bn', 'gu', 'pa', 'or'].includes(lang);
  return {
    lang,
    targetLang: langMap[lang] || 'en-IN',
    model: regional ? 'bulbul:v3' : 'bulbul:v4-flash',
    speaker: regional
      ? 'kavitha'
      : lang === 'en'
        ? 'simran_en_conversation'
        : lang === 'hi'
          ? 'kavya_hi_conversational'
          : 'kavitha_te_conversation',
    useEl: false
  };
}
