import React from 'react';

export function Sidebar({ isOpen, onClose, onNewChat, recentChats, activeChatId, onSelectChat }) {
  return (
    <>
      <div
        className={isOpen ? 'sidebar-overlay show' : 'sidebar-overlay'}
        id="sidebarOverlay"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={isOpen ? 'sidebar open' : 'sidebar'} id="sidebar" aria-label="Navigation Sidebar">
        <div className="sidebar-top-header">
          <div className="sidebar-brand">
            <img
              src="images/ic_launcher.png"
              alt="Logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <span>Nakshatra AI</span>
          </div>
          <button type="button" className="close-menu-btn" onClick={onClose} aria-label="Close Menu">
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <button type="button" className="new-chat-btn" onClick={onNewChat}>
          <i className="fa-regular fa-pen-to-square" aria-hidden="true" />
          <span>New chat</span>
        </button>

        <div className="recent-label">Recent</div>
        <div className="recent-list" id="recentList">
          {recentChats.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === activeChatId ? 'menu-item active' : 'menu-item'}
              onClick={() => onSelectChat?.(item.id)}
            >
              <i className="fa-regular fa-message" aria-hidden="true" />
              <span className="menu-item-title">{item.title}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button type="button" className="menu-item" onClick={() => alert('Settings coming soon!')}>
            <i className="fa-solid fa-gear" aria-hidden="true" />
            <span>Settings</span>
          </button>
          <a href="index.html" className="menu-item">
            <i className="fa-solid fa-arrow-left" aria-hidden="true" />
            <span>Back to Website</span>
          </a>
        </div>
      </aside>
    </>
  );
}
