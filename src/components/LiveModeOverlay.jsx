import React from 'react';

export function LiveModeOverlay({
  isLiveActive,
  liveState,
  liveStatusText,
  liveTranscript,
  tapBlink,
  liveOrbGlowRef,
  livePlayerRef,
  onClose,
  onOrbTap,
  onInterrupt
}) {
  const modalClasses = ['live-modal'];
  if (isLiveActive) modalClasses.push('active');
  if (liveState) modalClasses.push(liveState);

  return (
    <>
      <audio ref={livePlayerRef} id="liveAudioPlayer" playsInline preload="auto" style={{ display: 'none' }} />

      <div
        className={modalClasses.join(' ')}
        id="liveModal"
        role="dialog"
        aria-modal="true"
        aria-label="Nakshatra AI Live Mode"
      >
        <div className="live-ambient-bg" aria-hidden="true" />
        <div className="live-header">
          <div className="top-brand">
            <img src="images/ic_launcher.png" alt="Nakshatra" />
            <span className="top-brand-text">
              Nakshatra <span className="gradient-text">AI</span>
            </span>
          </div>
          <button
            type="button"
            className="live-close-btn"
            id="liveCloseBtn"
            onClick={onClose}
            title="Close Live Mode"
            aria-label="Close Live Mode"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </div>

        <div className="live-center-stage">
          <div className="live-orb-container">
            <div ref={liveOrbGlowRef} className="live-orb-glow" aria-hidden="true" />
            <div className="live-wave" aria-hidden="true" />
            <div className="live-wave wave-secondary" aria-hidden="true" />
            <div
              className={tapBlink ? 'live-orb-core tap-blink' : 'live-orb-core'}
              id="liveOrbCore"
              onClick={onOrbTap}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOrbTap();
                }
              }}
              title="Tap to interact or interrupt when speaking"
              role="button"
              tabIndex={0}
              aria-label="Nakshatra Live Voice Orb"
            >
              <div className="live-orb-aurora aurora-cyan" aria-hidden="true" />
              <div className="live-orb-aurora aurora-violet" aria-hidden="true" />
              <div className="live-orb-eyes" aria-hidden="true">
                <span className="live-orb-eye" />
                <span className="live-orb-eye" />
              </div>
              <div className="live-orb-aurora aurora-highlight" aria-hidden="true" />
              <div className="live-orb-glass" aria-hidden="true" />
            </div>
          </div>

          <div className="live-status-container">
            <div className="live-state-text" id="liveStateText" role="status" aria-live="polite">
              {liveStatusText}
            </div>
            <div className="live-transcript-box" id="liveTranscript">
              {liveTranscript}
            </div>
          </div>
        </div>

        <div className="live-controls">
          <button
            type="button"
            className="live-interrupt-pill"
            id="liveInterruptBtn"
            onClick={onInterrupt}
            title="Interrupt AI"
          >
            <i className="fa-solid fa-hand" aria-hidden="true" />
            <span>Tap to interrupt</span>
          </button>
        </div>
      </div>
    </>
  );
}
