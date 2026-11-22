/**
 * Game State Machine Definitions.
 */

export type GameMode = 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export interface GameStateMachine {
  current: GameMode;
  previous: GameMode;
  transition(to: GameMode): boolean;
  canTransition(to: GameMode): boolean;
}

export function createStateMachine(initial: GameMode = 'START'): GameStateMachine {
  let current: GameMode = initial;
  let previous: GameMode = initial;

  const validTransitions: Record<GameMode, GameMode[]> = {
    START: ['PLAYING'],
    PLAYING: ['PAUSED', 'GAMEOVER'],
    PAUSED: ['PLAYING', 'START'],
    GAMEOVER: ['PLAYING', 'START'],
  };

  return {
    get current() {
      return current;
    },
    get previous() {
      return previous;
    },
    canTransition(to: GameMode): boolean {
      return validTransitions[current].includes(to);
    },
    transition(to: GameMode): boolean {
      if (validTransitions[current].includes(to)) {
        previous = current;
        current = to;
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('ssr-gamestate-change', { detail: { state: to } }));
        }
        return true;
      }
      return false;
    },
  };
}
