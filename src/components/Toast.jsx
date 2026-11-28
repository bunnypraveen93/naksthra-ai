import React from 'react';

export function Toast({ message, visible }) {
  return (
    <div id="appToast" className={visible ? 'app-toast show' : 'app-toast'} role="alert" aria-live="assertive">
      {message}
    </div>
  );
}
