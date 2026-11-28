import React from 'react';

export function TopBar({ onToggleMenu, isChatActive, onNewChat }) {
  return (
    <header className="top-bar">
      <div className="top-left-group">
        <button type="button" className="menu-btn" onClick={onToggleMenu} title="Open Menu" aria-label="Open Menu">
          <i className="fa-solid fa-bars-staggered" aria-hidden="true" />
        </button>
        <div className="top-brand">
          <img src="images/ic_launcher.png" alt="Nakshatra" />
          <span className="top-brand-text">
            Nakshatra <span className="gradient-text">AI</span>
          </span>
        </div>
      </div>

      {isChatActive && (
        <button
          type="button"
          className="top-new-chat-btn"
          onClick={onNewChat}
          title="New Chat"
          aria-label="New Chat"
        >
          <i className="fa-regular fa-pen-to-square" aria-hidden="true" />
        </button>
      )}
    </header>
  );
}
