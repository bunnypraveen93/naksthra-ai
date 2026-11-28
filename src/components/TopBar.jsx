import React from 'react';

export function TopBar({ onToggleMenu, onNewChat }) {
  return (
    <header className="top-bar">
      <div className="top-left-group">
        <button type="button" className="menu-btn" onClick={onToggleMenu} title="Open Menu" aria-label="Open Menu">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="15" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <div className="top-brand">
          <img src="images/ic_launcher.png" alt="Nakshatra" />
          <span className="top-brand-text">
            Nakshatra <span className="gradient-text">AI</span>
          </span>
        </div>
      </div>

      <button type="button" className="top-new-chat-btn" onClick={onNewChat} title="New Chat" aria-label="New Chat">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.375 2.625a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </button>
    </header>
  );
}
