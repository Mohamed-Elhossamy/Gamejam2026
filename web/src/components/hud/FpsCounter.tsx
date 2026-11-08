import { useEffect, useState } from 'react';

// Decorative display, not measured frame timing.
export default function FpsCounter() {
  const [fps, setFps] = useState(() => 60 + Math.floor(Math.random() * 61));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setFps((previous) => Math.max(60, Math.min(120, previous + Math.floor(Math.random() * 17) - 8)));
    }, 750);
    return () => window.clearInterval(interval);
  }, []);

  return <span className="lx-fps" data-testid="fps-counter">fps: {fps}</span>;
}
