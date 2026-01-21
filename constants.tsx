
import React from 'react';

export const INITIAL_TIME_LIMIT = 5; // Increased slightly for more "all ages" friendly play
export const SAMPLE_RATE_INPUT = 16000;
export const SAMPLE_RATE_OUTPUT = 24000;

export const SYSTEM_PROMPT = `
You are playing a game called "Remember" with the user.
Game Rules:
1. It is a word chain game.
2. Normally, you respond with a word starting with the last letter of the user's word.
3. CRITICAL: If the UI displays a "RANDOM LETTER", the next word must start with THAT specific letter, breaking the previous chain.
4. Your response must be EXACTLY ONE WORD. Do not explain, just say the word.
5. If the user repeats a word, they lose.
6. Keep the pace fast and competitive.
7. Be encouraging.

If the game starts or a shuffle happens, the UI will provide a target letter. Always respect the current target letter shown in the interface.
`;

export const ICONS = {
  Brain: <i className="fa-solid fa-brain"></i>,
  Microphone: <i className="fa-solid fa-microphone"></i>,
  Trophy: <i className="fa-solid fa-trophy"></i>,
  Timer: <i className="fa-solid fa-stopwatch"></i>,
  History: <i className="fa-solid fa-clock-rotate-left"></i>,
  Settings: <i className="fa-solid fa-gear"></i>,
  Sparkles: <i className="fa-solid fa-wand-magic-sparkles"></i>,
  Video: <i className="fa-solid fa-video"></i>,
  Image: <i className="fa-solid fa-image"></i>,
  Search: <i className="fa-solid fa-magnifying-glass"></i>,
  Shuffle: <i className="fa-solid fa-shuffle"></i>,
  Bolt: <i className="fa-solid fa-bolt-lightning"></i>,
};
