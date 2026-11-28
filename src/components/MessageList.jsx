import React from 'react';
import { MessageItem } from './MessageItem';

export function MessageList({ messages, currentLanguageRef, onContinue }) {
  return (
    <div className="chat-container" id="chatContainer">
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} currentLanguageRef={currentLanguageRef} onContinue={onContinue} />
      ))}
    </div>
  );
}
