import { useCallback, useEffect, useRef, useState } from 'react';
import { SYSTEM_PROMPT } from '../config/prompts';
import { continueChatCompletion, sendChatCompletion } from '../services/chatApi';
import { detectLanguage, getLangDirective } from '../utils/language';
import {
  classifyPromptComplexity,
  cleanTeluguOutput,
  isReplyCutOff,
  manageConversationHistory
} from '../utils/textCleaners';

let nextMsgCounter = 1;
function makeId(prefix = 'msg') {
  return `${prefix}-${Date.now()}-${nextMsgCounter++}`;
}

export function useChatSession({ showErrorToast, ensurePlaybackUnlocked }) {
  const [messages, setMessages] = useState([]);
  const [recentChats, setRecentChats] = useState([{ id: 'welcome', title: 'Welcome Chat' }]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [greetingVariant, setGreetingVariant] = useState(() => Math.floor(Math.random() * 3));

  const conversationHistoryRef = useRef([]);
  const currentLanguageRef = useRef('en');
  const activeChatSessionRef = useRef(0);
  const activeAbortRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingRafRef = useRef(null);
  const isSendingRef = useRef(false);
  const hasRecordedRecentRef = useRef(false);

  const isChatActive = messages.length > 0;

  const stopTypingAnimation = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingRafRef.current) {
      cancelAnimationFrame(typingRafRef.current);
      typingRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTypingAnimation();
      if (activeAbortRef.current) {
        try {
          activeAbortRef.current.abort();
        } catch {}
      }
    };
  }, [stopTypingAnimation]);

  const recordRecentIfFirst = useCallback((firstPromptText) => {
    if (hasRecordedRecentRef.current) return;
    hasRecordedRecentRef.current = true;
    const title = String(firstPromptText || '').trim().substring(0, 22);
    if (title) {
      setRecentChats((r) => [{ id: makeId('chat'), title }, ...r]);
    }
  }, []);

  const appendUserMessage = useCallback(
    (text) => {
      recordRecentIfFirst(text);
      const id = makeId('user');
      setMessages((prev) => [...prev, { id, role: 'user', content: text }]);
      return id;
    },
    [recordRecentIfFirst]
  );

  const appendCompletedAIMessage = useCallback((text) => {
    const id = makeId('ai');
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: 'assistant',
        content: text,
        fullContent: text,
        isLoading: false,
        isTyping: false,
        isCutOff: false,
        isContinuing: false,
        continueRetry: false,
        isError: false
      }
    ]);
    return id;
  }, []);

  const animateAIReplyReveal = useCallback(
    (aiMsgId, fullText, sessionId) => {
      return new Promise((resolve) => {
        stopTypingAnimation();
        const text = String(fullText || '');
        const reduceMotion =
          typeof window !== 'undefined' &&
          window.matchMedia &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tokens = text.match(/\S+\s*/g);

        if (reduceMotion || !tokens || tokens.length <= 2) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: text,
                    fullContent: text,
                    isLoading: false,
                    isTyping: false,
                    isCutOff: isReplyCutOff(text) && text.length > 60
                  }
                : m
            )
          );
          resolve();
          return;
        }

        const total = tokens.length;
        // Batch token reveals gently (~36-42ms) so mobile React/Markdown avoids DOM layout thrashing
        const step = total > 180 ? 7 : total > 75 ? 4 : 2;
        const intervalMs = total > 180 ? 34 : total > 75 ? 36 : 40;
        let idx = 0;

        const tick = () => {
          if (sessionId !== activeChatSessionRef.current) {
            resolve();
            return;
          }
          idx = Math.min(total, idx + step);
          const isDone = idx >= total;
          const slice = isDone ? text : tokens.slice(0, idx).join('');

          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? {
                    ...m,
                    content: slice,
                    fullContent: text,
                    isLoading: false,
                    isTyping: !isDone,
                    isCutOff: isDone ? isReplyCutOff(text) && text.length > 60 : false
                  }
                : m
            )
          );

          if (isDone) {
            resolve();
          } else {
            typingTimerRef.current = setTimeout(() => {
              typingRafRef.current = requestAnimationFrame(tick);
            }, intervalMs);
          }
        };

        typingRafRef.current = requestAnimationFrame(tick);
      });
    },
    [stopTypingAnimation]
  );

  const startNewChat = useCallback(() => {
    stopTypingAnimation();
    if (activeAbortRef.current) {
      try {
        activeAbortRef.current.abort();
      } catch {}
      activeAbortRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    activeChatSessionRef.current += 1;
    hasRecordedRecentRef.current = false;
    isSendingRef.current = false;
    setIsSendingMessage(false);
    setMessages([]);
    conversationHistoryRef.current = [];
    setGreetingVariant((v) => (v + 1) % 3);
  }, [stopTypingAnimation]);

  const sendMessage = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim();
      if (!text || isSendingRef.current) return false;

      isSendingRef.current = true;
      setIsSendingMessage(true);
      const sessionId = activeChatSessionRef.current;
      ensurePlaybackUnlocked?.();

      const userId = makeId('user');
      const aiMsgId = makeId('ai');
      recordRecentIfFirst(text);

      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', content: text },
        {
          id: aiMsgId,
          role: 'assistant',
          content: '',
          fullContent: '',
          isLoading: true,
          isTyping: false,
          isCutOff: false,
          isContinuing: false,
          continueRetry: false,
          isError: false
        }
      ]);

      conversationHistoryRef.current.push({ role: 'user', content: text });
      conversationHistoryRef.current = manageConversationHistory(conversationHistoryRef.current, 8);

      const controller = new AbortController();
      activeAbortRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const detected = detectLanguage(text, false, null, currentLanguageRef.current);
        if (detected) currentLanguageRef.current = detected;

        const complexity = classifyPromptComplexity(text);
        const isDeep = complexity.isDeep;
        const isHowTo = complexity.isHowTo;
        const deepNotes = [];
        if (isDeep) {
          deepNotes.push(
            `[CRITICAL LOGIC & PUZZLE CHECK]\n1. Re-read every premise literally for wordplay, trick constraints, or impossible setups.\n2. Test your answer against every condition before writing it.\n3. Verify all arithmetic and state uncertainty if any fact is unverified.`
          );
        }
        if (isHowTo) {
          deepNotes.push(
            `[HOW-TO & RECIPE STEP VERIFICATION]\n1. Check real-world step dependency order (prep -> cook -> finish) and ensure NO critical step or ingredient is skipped.\n2. Check practical culinary/technical accuracy (soaking times, heat settings, marination, pan prep — spread dosa batter with the back of a ladle in concentric spirals rather than swirling the pan, liquid ratios, drain steps, low-flame/tawa dum).\n3. Use numbered sequential steps (1., 2., 3.) with real action headings — NEVER print literal placeholder text like "Bold Lead-in" or mix Telugu+English letters in one word.`
          );
        }
        const deepGuard = deepNotes.length ? `\n\n${deepNotes.join('\n\n')}` : '';
        const combinedSystem = `${SYSTEM_PROMPT}\n\n${getLangDirective(currentLanguageRef.current)}${deepGuard}`;

        const data = await sendChatCompletion({
          messages: conversationHistoryRef.current.slice(-6),
          combinedSystem,
          isDeep,
          isHowTo,
          signal: controller.signal
        });

        if (sessionId !== activeChatSessionRef.current) return true;

        const fallback = currentLanguageRef.current === 'en' ? "Hey, what's on your mind?" : 'హాయ్! ఏంటి విశేషాలు?';
        let aiReply = cleanTeluguOutput(data.response || data.reply || data.choices?.[0]?.message?.content) || fallback;
        const userWasGreeting = /^(hi|hello|hey|namaste|హాయ్|హలో|హేయ్|నమస్తే|vanakkam|kaisa hai|ela unnav|bagunnava)\b[!.?\s]*$/i.test(
          text
        );
        if (!userWasGreeting && aiReply.length > 35) {
          aiReply = aiReply.replace(/^(?:hi|hello|hey|హాయ్|హలో|హేయ్)(?:\s+there)?[!.,:]+\s+/i, '').trim();
        }

        conversationHistoryRef.current.push({ role: 'assistant', content: aiReply });
        conversationHistoryRef.current = manageConversationHistory(conversationHistoryRef.current, 8);

        await animateAIReplyReveal(aiMsgId, aiReply, sessionId);
        return true;
      } catch (error) {
        console.error('Chat error:', error);
        if (sessionId !== activeChatSessionRef.current) return true;
        const errMsg =
          error?.name === 'AbortError'
            ? 'Request timed out. Please try again.'
            : error?.message || 'Server connection error. Please check your network.';
        showErrorToast(errMsg);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: errMsg,
                  fullContent: errMsg,
                  isLoading: false,
                  isTyping: false,
                  isCutOff: false,
                  isError: true
                }
              : m
          )
        );
        return true;
      } finally {
        clearTimeout(timeoutId);
        if (activeAbortRef.current === controller) activeAbortRef.current = null;
        if (sessionId === activeChatSessionRef.current) {
          isSendingRef.current = false;
          setIsSendingMessage(false);
        }
      }
    },
    [animateAIReplyReveal, ensurePlaybackUnlocked, recordRecentIfFirst, showErrorToast]
  );

  const continueMessage = useCallback(async (aiMsgId, currentReplyText) => {
    setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, isContinuing: true } : m)));
    try {
      const cont = await continueChatCompletion({
        historySlice: conversationHistoryRef.current.slice(-5),
        currentReplyText,
        currentLanguage: currentLanguageRef.current
      });
      if (cont) {
        const merged = currentReplyText.trimEnd() + '\n\n' + cont.trimStart();
        if (
          conversationHistoryRef.current.length &&
          conversationHistoryRef.current[conversationHistoryRef.current.length - 1].role === 'assistant'
        ) {
          conversationHistoryRef.current[conversationHistoryRef.current.length - 1].content = merged;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId
              ? {
                  ...m,
                  content: merged,
                  fullContent: merged,
                  isContinuing: false,
                  isCutOff: false
                }
              : m
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, isContinuing: false, isCutOff: false } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, isContinuing: false, continueRetry: true } : m))
      );
    }
  }, []);

  return {
    messages,
    recentChats,
    isSendingMessage,
    isChatActive,
    greetingVariant,
    conversationHistoryRef,
    currentLanguageRef,
    recordRecentIfFirst,
    appendUserMessage,
    appendCompletedAIMessage,
    startNewChat,
    sendMessage,
    continueMessage
  };
}
