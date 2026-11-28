import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { closePartialCodeFence, renderMarkdownClean } from '../utils/markdown';

const SPEECH_LOCALE_MAP = {
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  ml: 'ml-IN',
  kn: 'kn-IN'
};

export const MessageItem = memo(function MessageItem({ message, currentLanguageRef, onContinue }) {
  const [copiedReply, setCopiedReply] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bubbleRef = useRef(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const displayedMarkdown = useMemo(() => {
    if (message.role !== 'assistant' || message.isLoading || message.isError) return '';
    return message.isTyping ? closePartialCodeFence(message.content) : message.content;
  }, [message.content, message.isError, message.isLoading, message.isTyping, message.role]);

  const renderedHtml = useMemo(() => {
    if (!displayedMarkdown) return '';
    return renderMarkdownClean(displayedMarkdown, { highlight: !message.isTyping });
  }, [displayedMarkdown, message.isTyping]);

  const handleBubbleClick = useCallback((e) => {
    const copyBtn = e.target.closest('.code-card-copy-btn');
    if (!copyBtn) return;
    const codeEl = copyBtn.closest('.code-card')?.querySelector('pre code');
    if (!codeEl) return;

    navigator.clipboard
      .writeText(codeEl.innerText)
      .then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> <span>Copied!</span>';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          if (copyBtn.isConnected) {
            copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> <span>Copy</span>';
            copyBtn.classList.remove('copied');
          }
        }, 2000);
      })
      .catch(() => {});
  }, []);

  const handleCopyReply = useCallback(() => {
    const textToCopy = bubbleRef.current?.innerText || message.content;
    if (!textToCopy) return;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopiedReply(true);
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
        copyTimerRef.current = setTimeout(() => setCopiedReply(false), 2000);
      })
      .catch(() => {});
  }, [message.content]);

  const handleSpeakReply = useCallback(() => {
    const text = bubbleRef.current?.innerText || message.content;
    if (!text || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = SPEECH_LOCALE_MAP[currentLanguageRef?.current] || 'en-US';
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utter);
  }, [currentLanguageRef, isSpeaking, message.content]);

  if (message.role === 'user') {
    return (
      <div className="msg-row user">
        <div className="msg-bubble">{message.content}</div>
      </div>
    );
  }

  return (
    <div className="msg-row ai">
      <div className="ai-content-wrap">
        {message.isLoading ? (
          <div className="msg-bubble">
            <div className="ai-dots-loader">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : message.isError ? (
          <div className="msg-bubble">
            <span style={{ color: '#ffffff' }}>{message.content}</span>
          </div>
        ) : (
          <div
            ref={bubbleRef}
            className="msg-bubble"
            onClick={handleBubbleClick}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        )}

        {!message.isLoading && !message.isTyping && !message.isError && message.isCutOff && (
          <button
            className="continue-pill-btn"
            type="button"
            disabled={message.isContinuing}
            onClick={() => onContinue(message.id, message.content)}
          >
            {message.isContinuing ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" /> Continuing...
              </>
            ) : message.continueRetry ? (
              <>
                <i className="fa-solid fa-rotate-right" aria-hidden="true" /> Retry Continue
              </>
            ) : (
              <>
                <i className="fa-solid fa-play" aria-hidden="true" /> Continue response
              </>
            )}
          </button>
        )}

        {!message.isLoading && !message.isTyping && !message.isError && (
          <div className="msg-actions-bar">
            <button className="msg-action-btn" type="button" onClick={handleCopyReply}>
              <i className={copiedReply ? 'fa-solid fa-check' : 'fa-regular fa-copy'} aria-hidden="true" />{' '}
              <span>{copiedReply ? 'Copied!' : 'Copy'}</span>
            </button>
            <button className="msg-action-btn" type="button" onClick={handleSpeakReply}>
              <i className={isSpeaking ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high'} aria-hidden="true" />{' '}
              <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
