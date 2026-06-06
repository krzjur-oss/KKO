import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Network, Play, Settings, User, Cpu, Sparkles, LogOut, 
  HelpCircle, ChevronRight, Apple, Smartphone, Info, RefreshCw, Layers
} from 'lucide-react';
import { GameType, Player, SavedGame, GameLog } from './types';
import { initRummyGame } from './games/rummy';
import { initMakaoGame } from './games/makao';
import { initTysiacGame } from './games/tysiac';
import CardTable from './components/CardTable';
import P2PSync from './components/P2PSync';
import ScoreBoard from './components/ScoreBoard';
import HowToPlayModal from './components/HowToPlayModal';

// Font configuration
import './index.css';

export default function App() {
  // Stan konfiguracji lobby
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('karciany_player_name') || 'Gracz 1';
  });
  const [selectedGame, setSelectedGame] = useState<GameType>('remik');
  const [playMode, setPlayMode] = useState<'solo' | 'pass' | 'p2p'>('solo');
  const [botCount, setBotCount] = useState(2); // 2 oponentów botowych (razem 3 graczy)
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  
  // Stan aktywnej gry
  const [gameStarted, setGameStarted] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<any>(null);
  const [logs, setLogs] = useState<GameLog[]>([]);
  
  // Stała historia gier zapasowa w localStorage
  const [savedGames, setSavedGames] = useState<SavedGame[]>(() => {
    try {
      const hist = localStorage.getItem('saved_card_games_history');
      return hist ? JSON.parse(hist) : [];
    } catch {
      return [];
    }
  });

  // Obsługa instalacji PWA
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Sprawdzenie czy zainstalowano (lub stand-alone)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const triggerPwaInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('Użytkownik zainstalował PWA KarcianeOffline');
    }
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  // Dodaj wpis do krupiera / logów
  const addLog = (message: string, name?: string, type: GameLog['type'] = 'info') => {
    const newLog: GameLog = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      message,
      playerName: name,
      type,
    };
    setLogs(prev => [...prev, newLog]);
  };

  // Stały zapis nazwy usera
  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    localStorage.setItem('karciany_player_name', name);
  };

  // Uruchomienie nowej rozgrywki na żądanie
  const handleStartGame = () => {
    setLogs([]);
    const names = [playerName];
    
    if (playMode === 'solo') {
      for (let i = 1; i <= botCount; i++) {
        names.push(`Bot ${i}`);
      }
    } else if (playMode === 'pass') {
      for (let i = 1; i <= botCount; i++) {
        names.push(`Rywal ${i}`);
      }
    } else {
      // Dla trybu P2P na start dodajemy bota dla testów, resztę zsynchronizuje rówieśnik
      names.push('Oponent P2P');
      names.push('Bot Pomocniczy');
    }

    addLog(`Rozpoczynanie nowej gry: ${selectedGame.toUpperCase()} w trybie ${playMode.toUpperCase()}...`, undefined, 'info');

    if (selectedGame === 'remik') {
      const state = initRummyGame(names, playMode === 'solo' ? 1 : names.length);
      setPlayers(state.players);
      setGameState(state);
      addLog('Rozdano karty dla Remika. Twój cel to tworzenie grup i sekwencji do wyłożenia.', undefined, 'info');
    } else if (selectedGame === 'makao') {
      const state = initMakaoGame(names, playMode === 'solo' ? 1 : names.length);
      setPlayers(state.players);
      setGameState(state);
      addLog('Karty do Makao rozdane! Pamiętaj o specjalnych funkcjach 2, 3, 4, Waleta i Asa.', undefined, 'info');
    } else if (selectedGame === 'tysiac') {
      // Tysiąc zawsze gra w 3 osoby
      const state = initTysiacGame([playerName, 'Bot 1', 'Bot 2'], playMode === 'solo' ? 1 : 3);
      setPlayers(state.players);
      setGameState(state);
      addLog('Tysiąc (1000): Rozdano po 7 kart. 3 karty leżą zakryte w musiku. Rozpoczyna się licytacja!', undefined, 'info');
    }

    setGameStarted(true);
  };

  // Odbiór zmian wyników z synchronizacji LAN/P2P
  const handleP2PSyncScores = (incomingPayload: any) => {
    if (!incomingPayload) return;
    
    // Zaktualizuj wyniki lokalnych graczy na bazie nadesłanych
    setPlayers(prev => {
      const updated = prev.map(p => {
        const found = incomingPayload.playersScores?.find((is: any) => is.name === p.name);
        if (found) {
          return { ...p, score: found.score };
        }
        return p;
      });
      return updated;
    });

    addLog(`Otrzymano aktualizację wyników z sieci P2P!`, 'Sieć P2P', 'win');
  };

  // Stały zapis rozgrywki do historii (np. po końcu rundy/gry)
  const handleScoreSave = (finalScores: { name: string; score: number }[]) => {
    const newSavedGame: SavedGame = {
      id: `game-${Date.now()}`,
      gameType: selectedGame,
      date: new Date().toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      players: finalScores,
      roundsCount: players[0]?.roundsScores?.length || 1,
      completed: true,
    };

    const updatedList = [...savedGames, newSavedGame];
    setSavedGames(updatedList);
    localStorage.setItem('saved_card_games_history', JSON.stringify(updatedList));
    addLog('Zapisano ostateczny wynik meczu w bazie lokalnej offline!', undefined, 'meld');
  };

  // Reset historii gier
  const handleClearHistory = () => {
    if (window.confirm('Czy na pewno chcesz usunąć całą historię gier offline?')) {
      setSavedGames([]);
      localStorage.removeItem('saved_card_games_history');
      addLog('Wyczyszczono lokalną bazę historyczną.', undefined, 'alert');
    }
  };

  const handleExitGame = () => {
    if (window.confirm('Czy na pewno chcesz zakończyć obecną rozgrywkę i wrócić do menu głównego?')) {
      setGameStarted(false);
      setGameState(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans select-none pb-12 relative overflow-hidden">
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[50%] bg-purple-600/15 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* PWA INSTALL BANNER */}
      <AnimatePresence>
        {showInstallBanner && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-3 text-center flex justify-between items-center z-50 text-xs font-mono font-bold relative border-b border-rose-400 shadow-md"
          >
            <div className="flex items-center gap-2 mx-auto">
              <Smartphone className="w-4 h-4 text-white animate-bounce" />
              <span>Graj w pełni offline! Dodaj Karciany Klub do ekranu głównego telefonu.</span>
              <button 
                onClick={triggerPwaInstall}
                className="ml-3 px-3 py-1 bg-white hover:bg-slate-150 text-rose-600 rounded-lg text-[10px] font-sans font-bold tracking-wider uppercase transition-colors"
              >
                Instaluj Offline
              </button>
            </div>
            <button 
              onClick={() => setShowInstallBanner(false)}
              className="text-rose-200 hover:text-white px-2 text-sm leading-none font-sans"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP GŁÓWNY NAGŁÓWEK */}
      <header className="border-b border-white/10 bg-white/[0.04] backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-rose-500 text-xl font-bold shadow-inner">
              ♠
            </div>
            <div>
              <h1 className="text-sm font-mono font-black tracking-widest bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent uppercase sm:text-lg">
                Karciany Klub Offline
              </h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide">
                Porty PWA: Remik, Makao, 1000
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/25 px-4 py-1.5 rounded-full text-[10px] font-mono tracking-wider font-bold">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="text-emerald-400">TRYB OFFLINE AKTYWNY</span>
            </div>

            <button 
              onClick={() => setIsHowToPlayOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/15 border border-indigo-500/30 hover:bg-indigo-500/25 text-indigo-300 text-xs font-mono font-bold rounded-lg transition-all shadow-md active:scale-95"
              id="how-to-play-header-trigger"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Akademia Gier
            </button>

            {gameStarted && (
              <button 
                onClick={handleExitGame}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-rose-950/40 hover:text-rose-400 text-slate-300 text-xs font-mono rounded-lg transition-colors border border-white/5"
              >
                <LogOut className="w-3.5 h-3.5" /> WYJDŹ z Gry
              </button>
            )}
          </div>
        </div>
      </header>

      {/* GŁÓWNA STRUKTURA DLA AKTYWNEJ ROZGRYWKI LUB LOBBY */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!gameStarted ? (
          // LOBBY / MENU KONFIGURACYJNE
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* WYBÓR GRY ORAZ PROTOKOŁU (LOBBY LEWY PANEL) */}
            <div className="lg:col-span-2 space-y-6 z-10">
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    <h2 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
                      Wybierz grę karcianą
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsHowToPlayOpen(true)}
                    className="text-xs font-mono font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-all hover:translate-x-0.5 active:scale-95"
                    id="how-to-play-sub-trigger"
                  >
                    Jak grać? <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* TRZY KARTY GIER (REMIK, MAKAO, 1000) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  {/* REMIK CARD */}
                  <div 
                    onClick={() => setSelectedGame('remik')}
                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-44 select-none ${
                      selectedGame === 'remik' 
                        ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/25' 
                        : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase tracking-widest block mb-2">
                        Wielo-rurowa
                      </span>
                      <h3 className="text-lg font-bold text-white mb-1.5 font-sans">Remik (Rummy)</h3>
                      <p className="text-xs text-slate-400">Układaj sekwencje i grupy, zdobywaj pierwsze 51 punktów.</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Talia: 52 karty + Jokery</span>
                  </div>

                  {/* MAKAO CARD */}
                  <div 
                    onClick={() => setSelectedGame('makao')}
                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-44 select-none ${
                      selectedGame === 'makao' 
                        ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/25' 
                        : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-sky-400 font-bold uppercase tracking-widest block mb-2">
                        Akcja / Walka
                      </span>
                      <h3 className="text-lg font-bold text-white mb-1.5 font-sans">Makao</h3>
                      <p className="text-xs text-slate-400">Bitwy kart specjalnych 2, 3, 4, królów. Blokady i życzenia.</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Talia: 52 karty</span>
                  </div>

                  {/* 1000 CARD */}
                  <div 
                    onClick={() => setSelectedGame('tysiac')}
                    className={`border-2 rounded-2xl p-5 cursor-pointer transition-all flex flex-col justify-between h-44 select-none ${
                      selectedGame === 'tysiac' 
                        ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/25' 
                        : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-mono text-yellow-400 font-bold uppercase tracking-widest block mb-2">
                        Marjaże / Lewy
                      </span>
                      <h3 className="text-lg font-bold text-white mb-1.5 font-sans">Tysiąc (1000)</h3>
                      <p className="text-xs text-slate-400">Licytacja musika, zgrywanie lew, meldowanie par król-dama.</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Talia: 24 karty (9-A)</span>
                  </div>
                </div>

                {/* TRYB GRY (SOLO, PASS, P2P) */}
                <div className="border-t border-white/10 pt-6">
                  <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-4">
                    Metoda rozgrywki
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button 
                      onClick={() => {
                        setPlayMode('solo');
                        if (selectedGame === 'tysiac') setBotCount(2); // Tysiąc zawsze w 3 osoby
                      }}
                      className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                        playMode === 'solo' 
                          ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30' 
                          : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <Cpu className="w-5 h-5 text-indigo-400 mb-1" />
                      <span className="text-xs font-bold font-sans text-slate-100">Z botami (Offline)</span>
                      <span className="text-[9px] text-slate-400 mt-1">Grasz sam z inteligentnym komputerem</span>
                    </button>

                    <button 
                      onClick={() => {
                        setPlayMode('pass');
                        if (selectedGame === 'tysiac') setBotCount(2);
                      }}
                      className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                        playMode === 'pass' 
                          ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30' 
                          : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <Layers className="w-5 h-5 text-purple-400 mb-1" />
                      <span className="text-xs font-bold font-sans text-slate-100">Pass & Play</span>
                      <span className="text-[9px] text-slate-400 mt-1">Lokalna gra na 1 ekranie, z przekazywaniem</span>
                    </button>

                    <button 
                      onClick={() => setPlayMode('p2p')}
                      className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all ${
                        playMode === 'p2p' 
                          ? 'border-indigo-500 bg-white/15 ring-2 ring-indigo-500/30' 
                          : 'border-white/10 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/20'
                      }`}
                    >
                      <Network className="w-5 h-5 text-emerald-400 mb-1" />
                      <span className="text-xs font-bold font-sans text-slate-100">P2P Synchronizacja</span>
                      <span className="text-[9px] text-slate-400 mt-1">Parowanie między urządzeniami / kartami</span>
                    </button>
                  </div>
                </div>

                {/* PARAMETRY (SPOŁECZNOŚĆ / LICZBA BOTÓW) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-white/10 mt-6 pt-6">
                  <div>
                    <label className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase block mb-2">
                      Twoje imię w grze
                    </label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-indigo-400" />
                      <input 
                        type="text" 
                        maxLength={16}
                        value={playerName}
                        onChange={(e) => handlePlayerNameChange(e.target.value)}
                        className="w-full bg-slate-950/40 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs font-mono text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all placeholder-slate-500"
                        placeholder="Imię..."
                      />
                    </div>
                  </div>

                  {selectedGame !== 'tysiac' && (
                    <div>
                      <label className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase block mb-2">
                        {playMode === 'pass' 
                          ? 'Łączna liczba oponentów i graczy' 
                          : 'Liczba oponentów (Komputerów / Rywali)'}
                      </label>
                      <div className="flex gap-1.5 flex-wrap">
                        {[1, 2, 3, 4, 5].map((count) => (
                          <button
                            key={count}
                            onClick={() => setBotCount(count)}
                            className={`flex-1 min-w-[70px] py-2.5 text-xs font-mono rounded-xl border transition-all ${
                              botCount === count 
                                ? 'border-indigo-500 bg-white/15 text-indigo-300 font-bold ring-2 ring-indigo-500/30' 
                                : 'border-white/10 bg-white/5 text-slate-400 hover:text-slate-200 hover:border-white/20'
                            }`}
                          >
                            {count + 1} graczy ({count} {count === 1 ? 'rywal' : 'rywali'})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedGame === 'tysiac' && (
                    <div className="flex flex-col justify-center">
                      <span className="text-xs font-mono font-bold tracking-wider text-indigo-300 uppercase block">
                        Konfiguracja Tysiąca
                      </span>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        Tysiąc wymaga obecności dokładnie 3 stałych graczy (Ty + 2 przeciwników). Liczba ta jest zablokowana.
                      </p>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleStartGame}
                  className="w-full mt-8 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-2xl text-sm font-mono tracking-widest transition-all shadow-lg hover:shadow-indigo-500/20 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" /> ROZPOCZNIJ PARTIĘ CARDS
                </button>
              </div>
            </div>

            {/* P2P STANICA & SCOREBOARD (LOBBY PRAWY PANEL) */}
            <div className="space-y-6">
              <P2PSync 
                onSyncReceived={handleP2PSyncScores} 
                players={players} 
                gameType={selectedGame}
                addLog={addLog}
              />
              
              <ScoreBoard 
                savedGames={savedGames} 
                onClearHistory={handleClearHistory}
                activePlayersScores={[]}
              />
            </div>

          </div>
        ) : (
          // AKTYWNA TURA Z CYFRĄ KARTY
          <CardTable
            gameType={selectedGame}
            players={players}
            setPlayers={setPlayers}
            gameState={gameState}
            setGameState={setGameState}
            logs={logs}
            addLog={addLog}
            resetGame={() => setGameStarted(false)}
            onScoreSave={handleScoreSave}
            playMode={playMode}
          />
        )}
      </main>

      {/* STOPKA INFORMACYJNA */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950 pt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs font-mono text-slate-600 space-y-2">
          <p>Karciany Klub Offline © 2026. Wszelkie prawa zastrzeżone.</p>
          <div className="flex justify-center gap-6 text-[10px]">
            <span className="flex items-center gap-1"><Info className="w-3.5 h-3.5 text-slate-500" /> Bluetooth Low Energy w przeglądarkach współpracuje bezpośrednio z urządzeniami peryferyjnymi Bluetooth.</span>
          </div>
        </div>
      </footer>

      {/* HOW TO PLAY ACADEMY MODAL */}
      <HowToPlayModal 
        isOpen={isHowToPlayOpen} 
        onClose={() => setIsHowToPlayOpen(false)} 
        initialGameType={selectedGame}
      />
    </div>
  );
}
