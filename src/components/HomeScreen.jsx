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
