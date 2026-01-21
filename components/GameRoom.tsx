
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { GameState, GameTurn, GameStatus } from '../types';
import { INITIAL_TIME_LIMIT, SYSTEM_PROMPT, ICONS, SAMPLE_RATE_INPUT, SAMPLE_RATE_OUTPUT } from '../constants';
import { createBlob, decode, decodeAudioData } from '../services/audioUtils';
import Visualizer from './Visualizer';

const GameRoom: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    highScore: parseInt(localStorage.getItem('remember_high_score') || '0'),
    currentLetter: '',
    history: [],
    status: 'idle',
    timeLeft: INITIAL_TIME_LIMIT,
  });

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isGlitching, setIsGlitching] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'));
  const audioContextIn = useRef<AudioContext | null>(null);
  const audioContextOut = useRef<AudioContext | null>(null);
  const nextStartTime = useRef(0);
  const sources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const timerInterval = useRef<number | null>(null);
  const frameInterval = useRef<number | null>(null);
  const sessionRef = useRef<any>(null);

  const generateRandomLetter = useCallback(() => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return letters[Math.floor(Math.random() * letters.length)];
  }, []);

  // Update the AI about a state change (like a new random letter)
  const syncAiState = useCallback((letter: string) => {
    if (sessionRef.current) {
       // We send a hidden text part to the AI to update its context
       sessionRef.current.sendRealtimeInput({
         parts: [{ text: `[SYSTEM: The current target letter is now ${letter.toUpperCase()}. The user must say a word starting with this letter.]` }]
       });
    }
  }, []);

  const triggerShuffle = useCallback(() => {
    setIsGlitching(true);
    const newLetter = generateRandomLetter();
    
    // Visual feedback for the shuffle
    setTimeout(() => {
      setGameState(prev => ({
        ...prev,
        currentLetter: newLetter,
        timeLeft: INITIAL_TIME_LIMIT
      }));
      syncAiState(newLetter);
      setIsGlitching(false);
    }, 400);
  }, [generateRandomLetter, syncAiState]);

  const cleanupResources = useCallback(() => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (frameInterval.current) clearInterval(frameInterval.current);
    
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    if (audioContextIn.current) {
      audioContextIn.current.close().catch(() => {});
      audioContextIn.current = null;
    }
    if (audioContextOut.current) {
      audioContextOut.current.close().catch(() => {});
      audioContextOut.current = null;
    }

    sources.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sources.current.clear();
    nextStartTime.current = 0;

    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch(e) {}
      sessionRef.current = null;
    }
  }, [stream]);

  const stopGame = useCallback((reason: string) => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    if (frameInterval.current) clearInterval(frameInterval.current);
    
    setGameState(prev => ({ ...prev, status: 'gameover' }));
    
    setGameState(prev => {
      if (prev.score > prev.highScore) {
        localStorage.setItem('remember_high_score', prev.score.toString());
        return { ...prev, highScore: prev.score };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    if (gameState.status === 'playing') {
      timerInterval.current = window.setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            stopGame('Time ran out!');
            return { ...prev, timeLeft: 0 };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerInterval.current) clearInterval(timerInterval.current);
    }
    return () => { if (timerInterval.current) clearInterval(timerInterval.current); };
  }, [gameState.status, stopGame]);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const startGame = async () => {
    try {
      cleanupResources();
      setPermissionError(null);
      
      const initialLetter = generateRandomLetter();
      setGameState(prev => ({ 
        ...prev, 
        status: 'connecting', 
        score: 0, 
        history: [], 
        currentLetter: initialLetter, 
        timeLeft: INITIAL_TIME_LIMIT 
      }));

      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      setStream(mediaStream);

      audioContextIn.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_INPUT });
      audioContextOut.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_OUTPUT });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          systemInstruction: SYSTEM_PROMPT,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setGameState(prev => ({ ...prev, status: 'playing' }));
            syncAiState(initialLetter);

            const source = audioContextIn.current!.createMediaStreamSource(mediaStream);
            const scriptProcessor = audioContextIn.current!.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContextIn.current!.destination);

            frameInterval.current = window.setInterval(() => {
              if (!videoRef.current || !canvasRef.current) return;
              const canvas = canvasRef.current;
              const ctx = canvas.getContext('2d');
              if (!ctx) return;
              canvas.width = 320;
              canvas.height = 240;
              ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              const base64Data = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64Data, mimeType: 'image/jpeg' } });
              });
            }, 1000);
          },
          onmessage: async (message: LiveServerMessage) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextOut.current) {
              const ctx = audioContextOut.current;
              if (ctx.state === 'suspended') await ctx.resume();
              nextStartTime.current = Math.max(nextStartTime.current, ctx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), ctx, SAMPLE_RATE_OUTPUT, 1);
              const source = ctx.createBufferSource();
              source.buffer = buffer;
              source.connect(ctx.destination);
              source.start(nextStartTime.current);
              nextStartTime.current += buffer.duration;
              sources.current.add(source);
              source.onended = () => sources.current.delete(source);
            }

            // Handle Speech Detection UI
            if (message.serverContent?.inputTranscription) {
              setIsUserSpeaking(true);
              const text = message.serverContent.inputTranscription.text.trim().toLowerCase();
              const match = text.match(/[a-z]{2,}/); // Only match words at least 2 chars long
              if (match) processTurn('user', match[0]);
              // Reset speaking state after a short delay
              setTimeout(() => setIsUserSpeaking(false), 1000);
            }

            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text.trim().toLowerCase();
              const match = text.match(/[a-z]{2,}/);
              if (match) processTurn('ai', match[0]);
            }

            if (message.serverContent?.interrupted) {
              sources.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sources.current.clear();
              nextStartTime.current = 0;
            }
          },
          onclose: () => {
            setGameState(prev => ({ ...prev, status: 'idle' }));
          },
          onerror: (e) => {
            console.error('Session error:', e);
            setGameState(prev => ({ ...prev, status: 'idle' }));
          }
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('Permission/Start error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Camera/Microphone access denied.');
      } else {
        setPermissionError(`System error: ${err.message}`);
      }
      setGameState(prev => ({ ...prev, status: 'idle' }));
      cleanupResources();
    }
  };

  const processTurn = (player: 'user' | 'ai', word: string) => {
    setGameState(prev => {
      // Avoid processing the same word twice in quick succession (debouncing)
      if (prev.history.length > 0 && prev.history[prev.history.length-1].word === word) return prev;

      // Extract last char for the chain
      const lastChar = word[word.length - 1].toUpperCase();
      
      return {
        ...prev,
        history: [...prev.history, { player, word, timestamp: Date.now() }],
        currentLetter: lastChar,
        timeLeft: INITIAL_TIME_LIMIT,
        score: player === 'user' ? prev.score + 10 : prev.score,
      };
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl relative">
      {/* Game Header */}
      <div className="p-6 bg-slate-800 border-b border-slate-700 flex justify-between items-center z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-2xl animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.6)]">
            {ICONS.Brain}
          </div>
          <div>
            <h2 className="text-xl font-orbitron font-bold tracking-wider text-blue-400 uppercase">Remember</h2>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${gameState.status === 'playing' ? 'bg-green-500 animate-ping' : 'bg-slate-600'}`}></span>
              Neural Chain {gameState.status === 'playing' ? 'Locked' : 'Standby'}
            </p>
          </div>
        </div>
        
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Score</p>
            <p className="text-2xl font-orbitron text-white">{gameState.score}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-slate-500 font-bold">Record</p>
            <p className="text-2xl font-orbitron text-yellow-500">{gameState.highScore}</p>
          </div>
        </div>
      </div>

      {/* Main Game Stage */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 overflow-hidden">
        
        {/* Interactive Video Background */}
        <div className="absolute inset-0 z-0 bg-slate-950">
           <video 
             ref={videoRef} 
             autoPlay 
             playsInline 
             muted 
             className="w-full h-full object-cover opacity-20 grayscale contrast-150"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-slate-900 opacity-90"></div>
           <div className="absolute inset-0 border-[1px] border-blue-500/10 pointer-events-none"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center space-y-6 w-full max-w-md">
          {/* Circular Countdown Timer */}
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="80" cy="80" r="74" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800/40" />
              <circle
                cx="80" cy="80" r="74"
                stroke="currentColor" strokeWidth="6" fill="transparent"
                strokeDasharray={2 * Math.PI * 74}
                strokeDashoffset={2 * Math.PI * 74 * (1 - gameState.timeLeft / INITIAL_TIME_LIMIT)}
                className={`transition-all duration-1000 ease-linear ${gameState.timeLeft <= 2 ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]'}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-6xl font-orbitron font-bold transition-all ${gameState.timeLeft <= 2 ? 'text-red-500 scale-110' : 'text-white'}`}>
                {gameState.timeLeft}
              </span>
            </div>
          </div>

          {/* Current Game Parameters */}
          <div className="w-full grid grid-cols-2 gap-4">
              <div className={`text-center bg-slate-900/80 backdrop-blur-xl border-2 transition-all duration-300 rounded-3xl p-5 shadow-2xl ${isGlitching ? 'border-purple-500 scale-95' : 'border-blue-500/40'}`}>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1">Target</p>
                <div className={`text-6xl font-orbitron text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.6)] ${isGlitching ? 'animate-pulse opacity-50' : ''}`}>
                  {gameState.currentLetter || '?'}
                </div>
              </div>
              <div className="text-center bg-slate-900/80 backdrop-blur-xl border border-slate-700/40 rounded-3xl p-5 shadow-2xl flex flex-col justify-center">
                <button 
                  onClick={triggerShuffle}
                  disabled={gameState.status !== 'playing' || isGlitching}
                  className="group flex flex-col items-center justify-center space-y-1 hover:text-purple-400 transition-colors disabled:opacity-30"
                >
                  <div className={`text-2xl text-purple-500 ${isGlitching ? 'animate-spin' : 'group-hover:animate-spin-slow'}`}>
                    {ICONS.Shuffle}
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Neural Shuffle</p>
                </button>
              </div>
          </div>

          {/* User Interaction Trigger */}
          <div className="w-full">
            {gameState.status === 'idle' || gameState.status === 'gameover' ? (
              <div className="space-y-4">
                {permissionError && (
                  <div className="p-4 bg-red-900/60 backdrop-blur-md border border-red-500/50 rounded-xl text-red-100 text-[10px] text-center uppercase tracking-widest">
                    <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                    {permissionError}
                  </div>
                )}
                <button 
                  onClick={startGame}
                  className="w-full py-5 bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-600 hover:to-blue-500 text-white font-orbitron font-bold rounded-2xl transition-all active:scale-95 shadow-[0_0_30px_rgba(37,99,235,0.3)] flex items-center justify-center gap-4 uppercase tracking-[0.3em] text-xs"
                >
                  {ICONS.Bolt}
                  {gameState.status === 'gameover' ? 'Re-Establish Link' : 'Initialize Chain'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className={`w-full p-3 bg-slate-900/40 backdrop-blur-xl border transition-colors rounded-2xl ${isUserSpeaking ? 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'border-slate-700/50'}`}>
                   <Visualizer stream={stream} isActive={gameState.status === 'playing'} color={isUserSpeaking ? "#60a5fa" : "#3b82f6"} />
                </div>
                <div className={`flex items-center gap-3 text-[9px] font-black tracking-[0.4em] uppercase transition-colors ${isUserSpeaking ? 'text-blue-400' : 'text-slate-500'}`}>
                  <div className={`w-2 h-2 rounded-full shadow-[0_0_10px_#3b82f6] ${isUserSpeaking ? 'bg-blue-400 animate-ping' : 'bg-blue-600'}`}></div>
                  {isUserSpeaking ? 'Speech Response Detected' : 'Awaiting Input'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Transcription Log */}
      <div className="h-36 bg-slate-950/80 border-t border-slate-800 p-5 overflow-y-auto font-mono text-[10px] z-10">
        <div className="flex items-center gap-2 text-slate-600 mb-3 border-b border-slate-900 pb-2">
          {ICONS.History} <span className="uppercase font-bold tracking-widest">Neural History</span>
        </div>
        <div className="space-y-2">
          {gameState.history.length === 0 && <p className="text-slate-800 italic uppercase tracking-widest">Awaiting signal...</p>}
          {gameState.history.slice().reverse().map((turn, i) => (
            <div key={turn.timestamp} className={`flex items-center gap-3 animate-in fade-in slide-in-from-left-2 duration-300 ${turn.player === 'user' ? 'text-blue-400' : 'text-purple-400'}`}>
              <span className="text-slate-800 font-black">{turn.player === 'user' ? 'USR' : 'AI'}</span>
              <span className="tracking-widest font-orbitron text-xs uppercase">{turn.word}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Game Over Modal */}
      {gameState.status === 'gameover' && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-10 z-50 animate-in zoom-in duration-300">
          <div className="text-red-600 text-7xl mb-6 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">{ICONS.Trophy}</div>
          <h2 className="text-4xl font-orbitron font-bold text-white mb-2 tracking-tighter">CHAIN BROKEN</h2>
          <div className="bg-slate-900/50 p-5 rounded-3xl border border-slate-800 mb-10 text-center w-full max-w-[200px] shadow-2xl">
            <p className="text-slate-500 text-[9px] uppercase font-black tracking-widest mb-1">Final Score</p>
            <p className="text-4xl font-orbitron text-blue-500 font-bold">{gameState.score}</p>
          </div>
          <button 
            onClick={startGame}
            className="px-12 py-4 bg-blue-600 hover:bg-blue-500 text-white font-orbitron font-bold rounded-2xl transition-all active:scale-95 shadow-xl shadow-blue-900/40 uppercase tracking-widest text-xs"
          >
            Reconnect
          </button>
        </div>
      )}

      {/* Loading State */}
      {gameState.status === 'connecting' && (
        <div className="absolute inset-0 bg-slate-900/98 backdrop-blur-md flex flex-col items-center justify-center p-8 z-50">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-[4px] border-blue-500/10 rounded-full"></div>
            <div className="absolute inset-0 border-[4px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-blue-400 font-orbitron font-bold animate-pulse tracking-[0.4em] text-[10px] uppercase">Syncing Synapses...</p>
        </div>
      )}
    </div>
  );
};

export default GameRoom;
