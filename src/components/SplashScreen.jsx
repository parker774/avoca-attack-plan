import { useState, useEffect, useCallback, useMemo } from 'react';
import './SplashScreen.css';

// Generate stars with random positions
function makeStars(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 60,
    dur: 2 + Math.random() * 3,
    delay: Math.random() * 4,
    size: Math.random() > 0.8 ? 3 : 2,
  }));
}

// Generate dust particles
function makeDust(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: 20 + Math.random() * 60,
    size: 2 + Math.random() * 5,
    dur: 2 + Math.random() * 3,
    delay: 1 + Math.random() * 2,
    dx: -40 + Math.random() * 80,
    dy: -20 - Math.random() * 40,
  }));
}

// CSS flag stripes rendered in JSX for crisp rendering
function AmericanFlag({ className }) {
  return (
    <div className={`flag-wrapper ${className || ''}`}>
      <svg viewBox="0 0 190 100" className="flag-svg" xmlns="http://www.w3.org/2000/svg">
        {/* Red and white stripes */}
        {[0,1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
          <rect key={i} x="0" y={i * (100/13)} width="190" height={100/13}
            fill={i % 2 === 0 ? '#B22234' : '#fff'} />
        ))}
        {/* Blue canton */}
        <rect x="0" y="0" width="76" height={100 * 7/13} fill="#3C3B6E" />
        {/* Stars — simplified 5 rows */}
        {[
          // Row 1 — 6 stars
          ...[0,1,2,3,4,5].map(c => ({ cx: 6 + c * 13, cy: 5 })),
          // Row 2 — 5 stars
          ...[0,1,2,3,4].map(c => ({ cx: 12.5 + c * 13, cy: 14 })),
          // Row 3 — 6 stars
          ...[0,1,2,3,4,5].map(c => ({ cx: 6 + c * 13, cy: 23 })),
          // Row 4 — 5 stars
          ...[0,1,2,3,4].map(c => ({ cx: 12.5 + c * 13, cy: 32 })),
          // Row 5 — 6 stars
          ...[0,1,2,3,4,5].map(c => ({ cx: 6 + c * 13, cy: 41 })),
          // Row 6 — 5 stars
          ...[0,1,2,3,4].map(c => ({ cx: 12.5 + c * 13, cy: 50 })),
        ].map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r="2" fill="#fff" />
        ))}
      </svg>
    </div>
  );
}

export default function SplashScreen({ onComplete }) {
  const [phase, setPhase] = useState('intro'); // intro → draw → flash → title → ready
  const [exiting, setExiting] = useState(false);

  const stars = useMemo(() => makeStars(40), []);
  const dust = useMemo(() => makeDust(20), []);

  // Animation timeline
  useEffect(() => {
    const timers = [];
    // Draw at 2.2s
    timers.push(setTimeout(() => setPhase('draw'), 2200));
    // Flash at 2.35s
    timers.push(setTimeout(() => setPhase('flash'), 2350));
    // Title at 2.6s
    timers.push(setTimeout(() => setPhase('title'), 2600));
    // Ready at 3.8s
    timers.push(setTimeout(() => setPhase('ready'), 3800));
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleClick = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onComplete(), 600);
  }, [exiting, onComplete]);

  // Allow skipping at any phase
  const handleSkip = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => onComplete(), 300);
  }, [exiting, onComplete]);

  const isDrawn = phase === 'draw' || phase === 'flash' || phase === 'title' || phase === 'ready';
  const isFlash = phase === 'flash' || phase === 'title' || phase === 'ready';
  const isTitle = phase === 'title' || phase === 'ready';
  const isReady = phase === 'ready';

  return (
    <div
      className={`splash ${isFlash ? 'shaking' : ''} ${exiting ? 'exiting' : ''}`}
      onClick={handleSkip}
    >
      {/* Night sky */}
      <div className="splash-sky" />

      {/* Stars */}
      <div className="splash-stars">
        {stars.map(s => (
          <div
            key={s.id}
            className="star"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              '--dur': `${s.dur}s`,
              '--delay': `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Big American Flag — background hero element */}
      <AmericanFlag className={`splash-flag ${isTitle ? 'visible' : ''}`} />

      {/* Desert ground */}
      <div className="splash-ground">
        <div className="cactus cactus-1" />
        <div className="cactus cactus-2" />
      </div>

      {/* Tumbleweed */}
      <div className="tumbleweed" />

      {/* Dust particles */}
      {dust.map(d => (
        <div
          key={d.id}
          className="dust-particle"
          style={{
            left: `${d.left}%`,
            '--size': `${d.size}px`,
            '--dur': `${d.dur}s`,
            '--delay': `${d.delay}s`,
            '--dx': `${d.dx}px`,
            '--dy': `${d.dy}px`,
          }}
        />
      ))}

      {/* Left gunslinger */}
      <div className="gunslinger gunslinger-left">
        <div className="gs-hat" />
        <div className="gs-head" />
        <div className="gs-body" />
        <div className="gs-duster" />
        <div className={`gs-arm ${isDrawn ? 'drawn' : ''}`} />
        <div className="gs-legs" />
      </div>

      {/* Right gunslinger */}
      <div className="gunslinger gunslinger-right">
        <div className="gs-hat" />
        <div className="gs-head" />
        <div className="gs-body" />
        <div className="gs-duster" />
        <div className={`gs-arm ${isDrawn ? 'drawn' : ''}`} />
        <div className="gs-legs" />
      </div>

      {/* Gun flash */}
      <div className={`gunflash ${isFlash ? 'fire' : ''}`} />

      {/* Title */}
      <div className={`splash-title ${isTitle ? 'revealed' : ''}`}>
        THE WILD WEST
      </div>

      <div className={`splash-subtitle ${isTitle ? 'visible' : ''}`}>
        Avoca Sales Command
      </div>

      {/* CTA */}
      <div className={`splash-cta ${isReady ? 'visible' : ''}`}>
        CLICK TO RIDE OUT
      </div>
    </div>
  );
}
