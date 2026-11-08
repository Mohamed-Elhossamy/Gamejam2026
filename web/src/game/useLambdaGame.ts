import { useEffect, useRef, useState } from 'react';
import type { GameView } from './contracts';
import { LambdaController } from './controller';
import { createRun } from './simulation';

export function useLambdaGame() {
  const [view, setView] = useState<GameView>({
    runNumber: 0,
    run: createRun(), question: null, loading: true, submitting: false,
    error: null, feedback: null, highScore: 0, storageAvailable: true, engineReady: false, bonus: null,
  });
  const controller = useRef<LambdaController | null>(null);
  if (!controller.current) controller.current = new LambdaController(setView);
  useEffect(() => {
    const game = controller.current!;
    game.mount();
    return () => game.destroy();
  }, []);
  return { view, actions: controller.current.actions };
}
