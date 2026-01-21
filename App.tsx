
import React, { useState } from 'react';
import GameRoom from './components/GameRoom';
import { ICONS } from './constants';
import { geminiService } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'game' | 'studio' | 'explorer'>('game');
  const [loading, setLoading] = useState(false);
  const [studioResult, setStudioResult] = useState<{type: 'image' | 'video', url: string} | null>(null);
  const [prompt, setPrompt] = useState('');

  const handleGenerateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const url = await geminiService.generateImage(prompt);
      setStudioResult({ type: 'image', url });
    } catch (err) {
      alert("Failed to generate image. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const url = await geminiService.generateVideo(prompt);
      setStudioResult({ type: 'video', url });
    } catch (err) {
      alert("Failed to generate video. Veo is in preview.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between bg-slate-900/50 backdrop-blur-xl p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="text-blue-500 text-2xl drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">
            {ICONS.Brain}
          </div>
          <h1 className="text-xl font-orbitron font-bold text-white tracking-widest">REMEMBER <span className="text-blue-500 italic">v1.0</span></h1>
        </div>

        <div className="hidden md:flex bg-slate-950 rounded-xl p-1 border border-slate-800">
          <button 
            onClick={() => setActiveTab('game')}
            className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${activeTab === 'game' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {ICONS.Timer} GAME
          </button>
          <button 
            onClick={() => setActiveTab('studio')}
            className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${activeTab === 'studio' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {ICONS.Sparkles} CREATIVE
          </button>
          <button 
            onClick={() => setActiveTab('explorer')}
            className={`px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2 ${activeTab === 'explorer' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {ICONS.Search} EXPLORE
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-slate-700 bg-[url('https://picsum.photos/seed/user/100')] bg-cover"></div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-8 h-[750px]">
          {activeTab === 'game' && <GameRoom />}
          {activeTab === 'studio' && (
            <div className="bg-slate-900 rounded-2xl h-full border border-slate-800 p-8 flex flex-col space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <h2 className="text-2xl font-orbitron font-bold text-white flex items-center gap-3">
                  {ICONS.Sparkles} CREATIVE STUDIO
                </h2>
                <p className="text-slate-400">Use Nano Banana (Gemini 2.5 Flash Image) and Veo to visualize your game world.</p>
              </div>

              <div className="space-y-4">
                <textarea 
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your creative vision (e.g. 'A futuristic cyberpunk arena for a word game tournament' or 'A neon holographic brain icon')..."
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:border-blue-500 outline-none transition-all resize-none"
                />
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    disabled={loading}
                    onClick={handleGenerateImage}
                    className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : ICONS.Image} GENERATE IMAGE
                  </button>
                  <button 
                    disabled={loading}
                    onClick={handleGenerateVideo}
                    className="py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : ICONS.Video} GENERATE VIDEO
                  </button>
                </div>
              </div>

              {studioResult && (
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden relative group">
                  {studioResult.type === 'image' ? (
                    <img src={studioResult.url} alt="Generated Content" className="w-full h-full object-cover" />
                  ) : (
                    <video src={studioResult.url} controls autoPlay loop className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-slate-950 to-transparent">
                    <button 
                      onClick={() => setStudioResult(null)}
                      className="text-xs text-red-400 hover:text-red-300 font-bold uppercase"
                    >
                      Clear Result
                    </button>
                  </div>
                </div>
              )}

              {loading && !studioResult && (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl">
                  <i className="fa-solid fa-hurricane fa-spin text-4xl text-blue-500"></i>
                  <p className="font-orbitron font-bold animate-pulse">TRANSMUTING DATA INTO VISUALS...</p>
                  <p className="text-xs text-center max-w-xs">Veo and Nano Banana are processing your request. This may take up to 30 seconds.</p>
                </div>
              )}
            </div>
          )}
          {activeTab === 'explorer' && (
             <div className="bg-slate-900 rounded-2xl h-full border border-slate-800 p-8 flex flex-col items-center justify-center text-center space-y-6">
               <div className="w-24 h-24 bg-blue-900/30 rounded-full flex items-center justify-center text-4xl text-blue-500">
                {ICONS.Search}
               </div>
               <h2 className="text-2xl font-orbitron font-bold text-white">WORD EXPLORER</h2>
               <p className="text-slate-400 max-w-md">The explorer uses Gemini 3 Flash with Search Grounding to find definitions and origins of words used in your game.</p>
               <div className="w-full max-w-md p-4 bg-slate-800 rounded-xl border border-blue-500/30 text-slate-300 italic">
                "Coming soon: Discover the secrets of every word you say."
               </div>
             </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
            <h3 className="text-sm font-orbitron font-bold text-slate-400 mb-4 uppercase flex items-center gap-2">
              {ICONS.Brain} How to Play
            </h3>
            <ul className="space-y-4 text-sm text-slate-300">
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">01</span>
                <span>Wait for the system to initialize the connection.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">02</span>
                <span>Say a word. AI responds with a word starting with your last letter.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded bg-red-600 flex items-center justify-center text-[10px] font-bold shrink-0">03</span>
                <span>You have <strong>3 SECONDS</strong> to respond or you are disqualified.</span>
              </li>
              <li className="flex gap-3">
                <span className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center text-[10px] font-bold shrink-0">04</span>
                <span>Build the longest chain to climb the leaderboard!</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 text-8xl -rotate-12">{ICONS.Trophy}</div>
            <h3 className="text-sm font-orbitron font-bold text-slate-400 mb-4 uppercase">Global Ranks</h3>
            <div className="space-y-4">
              {[
                { name: "CYBER_PUNK", score: 840, color: "text-yellow-500" },
                { name: "VOICE_MASTER", score: 720, color: "text-slate-400" },
                { name: "WORD_WIZARD", score: 650, color: "text-amber-600" },
                { name: "PLAYER_01", score: 410, color: "text-slate-500" },
              ].map((rank, i) => (
                <div key={i} className="flex justify-between items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`font-bold w-4 ${rank.color}`}>{i+1}</span>
                    <span className="font-orbitron text-xs tracking-tighter">{rank.name}</span>
                  </div>
                  <span className="text-white font-bold">{rank.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-[10px] uppercase font-bold text-slate-600 tracking-widest">
        <div className="flex gap-6">
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> Gemini Live Connected</span>
          <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Nano Banana Pro Online</span>
        </div>
        <div>
          &copy; 2025 REMEMBER PROTOCOL // AI GENERATED EXPERIENCES
        </div>
      </footer>
    </div>
  );
};

export default App;
