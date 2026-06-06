import React, { useState, useEffect } from 'react';
import { 
  Trophy, Medal, RotateCcw, Calendar, TrendingUp, HelpCircle, Flame, Target, 
  Trash2, BarChart2, Star, ShieldAlert
} from 'lucide-react';
import { SavedGame, GameType } from '../types';

interface ScoreBoardProps {
  savedGames: SavedGame[];
  onClearHistory: () => void;
  activePlayersScores: { name: string; score: number }[];
}

export default function ScoreBoard({ savedGames, onClearHistory, activePlayersScores }: ScoreBoardProps) {
  const [stats, setStats] = useState({
    totalGames: 0,
    remikCount: 0,
    makaoCount: 0,
    tysiacCount: 0,
    highestScore: 0,
    bestPlayer: 'Brak',
  });

  useEffect(() => {
    if (savedGames.length === 0) {
      setStats({
        totalGames: 0,
        remikCount: 0,
        makaoCount: 0,
        tysiacCount: 0,
        highestScore: 0,
        bestPlayer: 'Brak',
      });
      return;
    }

    let remik = 0;
    let makao = 0;
    let tysiac = 0;
    let maxScr = 0;
    let bestPlName = 'Brak';

    const playerAggs: Record<string, number> = {};

    savedGames.forEach((game) => {
      if (game.gameType === 'remik') remik++;
      if (game.gameType === 'makao') makao++;
      if (game.gameType === 'tysiac') tysiac++;

      game.players.forEach((p) => {
        if (p.score > maxScr) {
          maxScr = p.score;
        }
        playerAggs[p.name] = (playerAggs[p.name] || 0) + p.score;
      });
    });

    // Znajdź gracza z największą sumą punktów w historii
    let bestPlScore = -999999;
    Object.entries(playerAggs).forEach(([name, score]) => {
      if (score > bestPlScore) {
        bestPlScore = score;
        bestPlName = name;
      }
    });

    setStats({
      totalGames: savedGames.length,
      remikCount: remik,
      makaoCount: makao,
      tysiacCount: tysiac,
      highestScore: maxScr,
      bestPlayer: bestPlName,
    });
  }, [savedGames]);

  const polishNames: Record<GameType, string> = {
    remik: 'Remik',
    makao: 'Makao',
    tysiac: 'Tysiąc (1000)',
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl select-text" id="scoreboard-station-view">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-5 h-5 text-yellow-500 animate-bounce" />
        <div>
          <h2 className="text-sm font-mono font-bold tracking-wider text-slate-200 uppercase">
            Statystyki i Historia Wyników
          </h2>
          <p className="text-[10px] text-slate-400 font-mono">
            Zapisane wyniki gier offline
          </p>
        </div>
      </div>

      {/* METRYKA METRYK (BENTO GRID STYLE STATS) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
          <Star className="w-4 h-4 text-indigo-400 mx-auto mb-1 animate-pulse" />
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Wszystkie Gry</span>
          <span className="text-2xl font-bold font-mono text-white block mt-0.5">{stats.totalGames}</span>
        </div>

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center">
          <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Najlepszy Wynik</span>
          <span className="text-2xl font-bold font-mono text-emerald-400 block mt-0.5">{stats.highestScore} pkt</span>
        </div>

        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center col-span-2 sm:col-span-1">
          <Medal className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
          <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-400 block">Lider Klubu</span>
          <span className="text-sm font-semibold text-slate-200 block truncate mt-1.5">{stats.bestPlayer}</span>
        </div>
      </div>

      {/* WYKRES UDZIAŁU GIER (Dystrybucja graficzna w Tailwind) */}
      {stats.totalGames > 0 && (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-6">
          <h4 className="text-[10px] font-mono tracking-wider text-slate-400 uppercase mb-3 font-semibold">
            Dystrybucja ulubionych gier
          </h4>
          <div className="space-y-3">
            {/* Remik */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-300">Remik</span>
                <span className="text-slate-500">{stats.remikCount} gier ({Math.round(stats.remikCount / stats.totalGames * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.remikCount / stats.totalGames * 100) || 0}%` }}
                />
              </div>
            </div>

            {/* Makao */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-300">Makao</span>
                <span className="text-slate-500">{stats.makaoCount} gier ({Math.round(stats.makaoCount / stats.totalGames * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.makaoCount / stats.totalGames * 100) || 0}%` }}
                />
              </div>
            </div>

            {/* Tysiąc */}
            <div>
              <div className="flex justify-between text-xs mb-1.5 font-mono">
                <span className="text-slate-300">Tysiąc (1000)</span>
                <span className="text-slate-500">{stats.tysiacCount} gier ({Math.round(stats.tysiacCount / stats.totalGames * 100)}%)</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 rounded-full transition-all duration-500" 
                  style={{ width: `${(stats.tysiacCount / stats.totalGames * 100) || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LISTA OSTATNICH GIER */}
      <h3 className="text-[10px] font-mono tracking-wider uppercase text-slate-400 mb-2.5">
        Ostatnie partie karciane:
      </h3>
      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
        {savedGames.slice().reverse().map((game) => (
          <div key={game.id} className="bg-white/5 p-3 rounded-xl border border-white/10">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-bold font-sans text-indigo-400">
                {polishNames[game.gameType] || game.gameType}
              </span>
              <span className="text-[9px] font-mono text-slate-500 flex items-center gap-1">
                <Calendar className="w-3" /> {game.date}
              </span>
            </div>
            
            {/* Gracze w danej grze */}
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {game.players.map((p, idx) => (
                <span key={idx} className="text-xs font-mono text-slate-300">
                  {p.name}: <strong className="text-white">{p.score}</strong>
                </span>
              ))}
            </div>
          </div>
        ))}

        {savedGames.length === 0 && (
          <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
            <span className="text-xs text-slate-500 italic font-mono block">Brak historii meczów.</span>
            <span className="text-[9px] text-slate-500 block mt-1">Ukończ grę z botem lub partnerem, aby zapisać stały rekord!</span>
          </div>
        )}
      </div>

      {savedGames.length > 0 && (
        <button 
          onClick={onClearHistory}
          className="mt-6 w-full py-2 bg-white/5 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 text-xs font-mono tracking-wider uppercase font-bold rounded-xl transition-all border border-white/10 flex items-center justify-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" /> WYCZYŚĆ HISTORIĘ PARTII
        </button>
      )}
    </div>
  );
}
