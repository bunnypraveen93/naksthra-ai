import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export const InputBar = forwardRef(function InputBar(
  { isChatActive, isSendingMessage, dictationState, onToggleDictation, onSendMessage, onOpenLiveMode },
  ref
) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);
  const plainEnterClearRef = useRef(false);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '26px';
    if (el.scrollHeight > 32) {
      el.style.height = Math.min(el.scrollHeight, 140) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  useImperativeHandle(
    ref,
    () => ({
      appendTranscript(transcript) {
        const clean = String(transcript || '').trim();
        if (!clean) return false;
        setValue((prev) => {
          const needsSpace = prev.length > 0 && !/\s$/.test(prev);
          return prev + (needsSpace ? ' ' : '') + clean;
        });
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            const len = el.value.length;
            el.setSelectionRange(len, len);
          }
        });
        return true;
      },
      clear() {
        setValue('');
      },
      focus() {
        textareaRef.current?.focus();
      }
    }),
    []
  );

  const hasText = value.trim().length > 0;
  const showSend = isChatActive || hasText;

  const submitCurrent = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      textareaRef.current?.focus();
      return;
    }
    if (isSendingMessage) return;
    setValue('');
    await onSendMessage(trimmed);
  }, [isSendingMessage, onSendMessage, value]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        plainEnterClearRef.current = true;
        requestAnimationFrame(() => {
          plainEnterClearRef.current = false;
        });
        submitCurrent();
      }
    },
    [submitCurrent]
  );

  const handleInputChange = useCallback((e) => {
    const nextVal = e.target.value;
    if (plainEnterClearRef.current && nextVal === '\n') {
      plainEnterClearRef.current = false;
      setValue('');
      return;
    }
    plainEnterClearRef.current = false;
    setValue(nextVal);
  }, []);

  const handlePrimaryAction = useCallback(() => {
    if (isChatActive || hasText) {
      submitCurrent();
    } else {
      onOpenLiveMode();
    }
  }, [hasText, isChatActive, onOpenLiveMode, submitCurrent]);

  const placeholder =
    dictationState === 'listening'
      ? 'Listening... Tap mic to finish'
      : dictationState === 'transcribing'
        ? 'Transcribing...'
        : 'Ask Nakshatra AI...';

  const micTitle =
    dictationState === 'listening'
      ? 'Stop Listening'
      : dictationState === 'transcribing'
        ? 'Transcribing...'
        : 'Speech to Text';

  const micClass =
    dictationState === 'listening'
      ? 'mic-toggle-btn listening'
      : dictationState === 'transcribing'
        ? 'mic-toggle-btn transcribing'
        : 'mic-toggle-btn';

  return (
    <footer className="bottom-bar">
      <div className="chat-box-wrapper">
        <textarea
          ref={textareaRef}
          id="chatInput"
          className="chat-input"
          rows={1}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        <div className="chat-input-actions">
          <button
            type="button"
            className={micClass}
            id="micToggleBtn"
            disabled={dictationState === 'transcribing'}
            onClick={onToggleDictation}
            title={micTitle}
            aria-label={micTitle}
          >
            <svg
              className="mic-icon-idle"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <svg className="mic-icon-stop" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="3" />
            </svg>
            <i className="fa-solid fa-spinner fa-spin mic-icon-spinner" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={hasText ? 'send-btn typing' : 'send-btn'}
            id="sendBtn"
            data-mode={showSend ? 'send' : 'live'}
            disabled={isSendingMessage}
            onClick={handlePrimaryAction}
            title={showSend ? 'Send Message' : 'Live Voice Mode'}
            aria-label={showSend ? 'Send Message' : 'Live Voice Mode'}
          >
            <svg
              className="btn-icon-wave"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="10" x2="4" y2="14" />
              <line x1="8" y1="6" x2="8" y2="18" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="16" y1="7" x2="16" y2="17" />
              <line x1="20" y1="10" x2="20" y2="14" />
            </svg>
            <svg
              className="btn-icon-send"
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
      <div className="bottom-disclaimer">Nakshatra AI can make mistakes. Verify important information.</div>
    </footer>
  );
});
