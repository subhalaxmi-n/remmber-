
export type GameStatus = 'idle' | 'playing' | 'gameover' | 'connecting';

export interface GameState {
  score: number;
  highScore: number;
  currentLetter: string;
  history: GameTurn[];
  status: GameStatus;
  timeLeft: number;
}

export interface GameTurn {
  player: 'user' | 'ai';
  word: string;
  timestamp: number;
}

export interface AudioConfig {
  sampleRate: number;
}
