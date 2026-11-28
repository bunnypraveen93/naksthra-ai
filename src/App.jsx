import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatContainer } from './components/ChatContainer';
import { InputBar } from './components/InputBar';
import { LiveModeOverlay } from './components/LiveModeOverlay';
import { Sidebar } from './components/Sidebar';
import { Toast } from './components/Toast';
import { TopBar } from './components/TopBar';
import { useChatSession } from './hooks/useChatSession';
import { useLiveMode } from './hooks/useLiveMode';
import { useToast } from './hooks/useToast';
import { useVoiceDictation } from './hooks/useVoiceDictation';
import { warmNakshatraLocation } from './services/locationService';
import { detectLanguage } from './utils/language';

export function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const inputBarRef = useRef(null);
  const liveBridgeRef = useRef({
    isLiveActiveRef: { current: false },
    closeLiveMode: () => {},
    ensurePlaybackUnlocked: () => {}
  });

  const { toast, showErrorToast } = useToast();

  useEffect(() => {
    warmNakshatraLocation();
  }, []);

  const ensurePlaybackUnlockedProxy = useCallback(() => {
    liveBridgeRef.current.ensurePlaybackUnlocked();
  }, []);

  const {
    messages,
    recentChats,
    activeChatId,
    isSendingMessage,
    isChatActive,
    greetingVariant,
    conversationHistoryRef,
    currentLanguageRef,
    appendUserMessage,
    appendCompletedAIMessage,
    startNewChat,
    selectRecentChat,
    sendMessage,
    continueMessage
  } = useChatSession({
    showErrorToast,
    ensurePlaybackUnlocked: ensurePlaybackUnlockedProxy
  });

  useEffect(() => {
    document.body.classList.toggle('chat-active', isChatActive);
    return () => document.body.classList.remove('chat-active');
  }, [isChatActive]);

  const handleDictatedTranscript = useCallback(
    (transcript) => {
      const ok = inputBarRef.current?.appendTranscript(transcript);
      if (!ok) return false;
      const detected = detectLanguage(transcript, false, null, currentLanguageRef.current);
      if (detected) currentLanguageRef.current = detected;
      return true;
    },
    [currentLanguageRef]
  );

  const { dictationState, toggleVoiceDictation, cancelVoiceDictation } = useVoiceDictation({
    currentLanguageRef,
    showErrorToast,
    onTranscript: handleDictatedTranscript,
    isLiveActiveRef: liveBridgeRef.current.isLiveActiveRef,
    closeLiveMode: () => liveBridgeRef.current.closeLiveMode()
  });

  const live = useLiveMode({
    conversationHistoryRef,
    currentLanguageRef,
    appendUserMessage,
    appendCompletedAIMessage,
    showErrorToast,
    onBeforeOpen: cancelVoiceDictation
  });

  liveBridgeRef.current.isLiveActiveRef = live.isLiveActiveRef;
  liveBridgeRef.current.closeLiveMode = live.closeLiveMode;
  liveBridgeRef.current.ensurePlaybackUnlocked = live.ensurePlaybackUnlocked;

  const handleSendMessage = useCallback(
    async (text) => {
      cancelVoiceDictation();
      await sendMessage(text);
    },
    [cancelVoiceDictation, sendMessage]
  );

  const handleNewChat = useCallback(() => {
    cancelVoiceDictation();
    startNewChat();
    inputBarRef.current?.clear();
    setSidebarOpen(false);
  }, [cancelVoiceDictation, startNewChat]);

  const handleSelectRecent = useCallback(
    (chatId) => {
      cancelVoiceDictation();
      selectRecentChat(chatId);
      setSidebarOpen(false);
    },
    [cancelVoiceDictation, selectRecentChat]
  );

  return (
    <div className="app-shell">
      <Toast message={toast.message} visible={toast.visible} />

      <TopBar
        onToggleMenu={() => setSidebarOpen((o) => !o)}
        isChatActive={isChatActive}
        onNewChat={handleNewChat}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onNewChat={handleNewChat}
        recentChats={recentChats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectRecent}
      />

      <ChatContainer
        isChatActive={isChatActive}
        greetingVariant={greetingVariant}
        messages={messages}
        currentLanguageRef={currentLanguageRef}
        onContinue={continueMessage}
      />

      <InputBar
        ref={inputBarRef}
        isChatActive={isChatActive}
        isSendingMessage={isSendingMessage}
        dictationState={dictationState}
        onToggleDictation={toggleVoiceDictation}
        onSendMessage={handleSendMessage}
        onOpenLiveMode={live.openLiveMode}
      />

      <LiveModeOverlay
        isLiveActive={live.isLiveActive}
        liveState={live.liveState}
        liveStatusText={live.liveStatusText}
        liveTranscript={live.liveTranscript}
        tapBlink={live.tapBlink}
        liveOrbGlowRef={live.liveOrbGlowRef}
        livePlayerRef={live.livePlayerRef}
        onClose={live.closeLiveMode}
        onOrbTap={live.handleOrbTap}
        onInterrupt={live.interruptAI}
      />
    </div>
  );
}

export default App;
