import React, { useEffect, useRef } from 'react';
import { HomeScreen } from './HomeScreen';
import { MessageList } from './MessageList';

export function ChatContainer({ isChatActive, greetingVariant, messages, currentLanguageRef, onContinue }) {
  const mainRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const scrollRafRef = useRef(null);

  // Passive scroll listener: respects manual upward scrolling on mobile without fighting touch momentum
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const updateStickiness = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      isNearBottomRef.current = distFromBottom < 140;
    };

    el.addEventListener('scroll', updateStickiness, { passive: true });
    return () => el.removeEventListener('scroll', updateStickiness);
  }, []);

  // Auto-scroll when a new message is added or active reply grows (only if user hasn't scrolled up)
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !isChatActive) {
      prevCountRef.current = messages.length;
      isNearBottomRef.current = true;
      return;
    }

    const isNewMessageAdded = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    const lastMsg = messages[messages.length - 1];
    const isUserSent = lastMsg?.role === 'user' || lastMsg?.isLoading;

    if (isNewMessageAdded && isUserSent) {
      isNearBottomRef.current = true;
    }

    if (!isNearBottomRef.current) return;

    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      if (!mainRef.current) return;
      mainRef.current.scrollTop = mainRef.current.scrollHeight;
    });

    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [isChatActive, messages]);

  return (
    <main className="main-content" id="mainContent" ref={mainRef}>
      {!isChatActive ? (
        <HomeScreen greetingVariant={greetingVariant} />
      ) : (
        <MessageList messages={messages} currentLanguageRef={currentLanguageRef} onContinue={onContinue} />
      )}
    </main>
  );
}
