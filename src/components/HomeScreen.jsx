import React, { useEffect, useState } from 'react';
import { getTimeBasedGreeting } from '../config/prompts';

export function HomeScreen({ greetingVariant }) {
  const [greeting, setGreeting] = useState(() => getTimeBasedGreeting(new Date(), greetingVariant));

  useEffect(() => {
    setGreeting(getTimeBasedGreeting(new Date(), greetingVariant));

    const refresh = () => {
      if (!document.hidden) {
        setGreeting(getTimeBasedGreeting(new Date(), greetingVariant));
      }
    };

    document.addEventListener('visibilitychange', refresh);
    const interval = setInterval(() => {
      setGreeting(getTimeBasedGreeting(new Date(), greetingVariant));
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', refresh);
      clearInterval(interval);
    };
  }, [greetingVariant]);

  return (
    <div className="home-center" id="homeScreen">
      <div className="center-cosmic-glow" aria-hidden="true" />
      <div className="home-star-badge" aria-hidden="true">
        <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
          <defs>
            <linearGradient id="nakshatraStarGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="52%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
          <path
            d="M24 3C25.9 14.4 33.6 22.1 45 24C33.6 25.9 25.9 33.6 24 45C22.1 33.6 14.4 25.9 3 24C14.4 22.1 22.1 14.4 24 3Z"
            fill="url(#nakshatraStarGrad)"
          />
        </svg>
      </div>
      <div className="home-greeting">
        <h1 className="greeting-main" id="homeGreetingTitle">
          {greeting.title}
        </h1>
        <p className="greeting-sub" id="homeGreetingSub">
          {greeting.sub}
        </p>
      </div>
    </div>
  );
}
