import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, RotateCcw, AlertCircle, ArrowUpRight, CheckCircle2, User, Cpu, 
  HelpCircle, ChevronRight, Eye, ShieldAlert, Award, Volume2, Sparkles
} from 'lucide-react';
import { Card, Player, GameType, GameLog, CardSuit, CardValue } from '../types';
import { SUIT_SYMBOLS, SUIT_NAMES, SUIT_COLORS, getRummyCardValue, TYSIAC_CARD_VALUES, TYSIAC_MARRIAGE_VALUES } from '../utils';
import { RummyMeld, isValidGroup, isValidRun, calculateMeldPoints } from '../games/rummy';
import { canPlayCard } from '../games/makao';
import { canPlayTysiacCard, checkMarriages } from '../games/tysiac';

interface CardTableProps {
  gameType: GameType;
  players: Player[];
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  gameState: any; // Może trzymać stan specyficzny dla danej gry
  setGameState: React.Dispatch<React.SetStateAction<any>>;
  logs: GameLog[];
  addLog: (message: string, playerName?: string, type?: GameLog['type']) => void;
  resetGame: () => void;
  onScoreSave: (finalScores: { name: string; score: number }[]) => void;
  playMode: 'solo' | 'pass' | 'p2p';
  activeP2PPlayerId?: string;
}

export default function CardTable({
  gameType,
  players,
  setPlayers,
  gameState,
  setGameState,
  logs,
  addLog,
  resetGame,
  onScoreSave,
  playMode,
  activeP2PPlayerId,
}: CardTableProps) {
  const [selectedCards, setSelectedCards] = useState<Record<string, boolean>>({});
  const [botThinking, setBotThinking] = useState(false);
  const [passDeviceOverlay, setPassDeviceOverlay] = useState(false);
  const [lastPlayerIndex, setLastPlayerIndex] = useState(0);

  const activePlayer = players[gameState.activePlayerIndex];
  const isHumanTurn = !activePlayer?.isBot && (!activeP2PPlayerId || activePlayer.id === activeP2PPlayerId);

  // Zresetowanie zaznaczonych kart przy zmianie tury
  useEffect(() => {
    setSelectedCards({});
    
    // Obsługa ochrony prywatności dla trybu Pass & Play
    if (playMode === 'pass' && lastPlayerIndex !== gameState.activePlayerIndex) {
      setPassDeviceOverlay(true);
      setLastPlayerIndex(gameState.activePlayerIndex);
    }
  }, [gameState.activePlayerIndex]);

  // Automatyczny ruch bota po małym opóźnieniu (dla realizmu myślenia bota)
  useEffect(() => {
    if (gameState.winnerId) return;

    if (activePlayer?.isBot && !botThinking) {
      setBotThinking(true);
      const thinkTime = 1200 + Math.random() * 800; // 1.2s - 2.0s myślenia
      const timer = setTimeout(() => {
        executeBotTurn();
        setBotThinking(false);
      }, thinkTime);
      return () => clearTimeout(timer);
    }
  }, [gameState.activePlayerIndex, activePlayer?.isBot, gameState.winnerId]);

  const executeBotTurn = () => {
    if (gameType === 'remik') {
      import('../games/rummy').then(({ playRummyBotTurn }) => {
        setGameState((prev: any) => {
          const next = playRummyBotTurn(prev);
          setPlayers(next.players);
          if (next.winnerId) {
            const winner = next.players.find((p: Player) => p.id === next.winnerId);
            addLog(`🏆 ${winner?.name} WYGRYWA RUNDĘ REMIKA! Otrzymuje punkty.`, winner?.name, 'win');
            handleGameEnd(next.players, next.winnerId);
          }
          return next;
        });
      });
    } else if (gameType === 'makao') {
      import('../games/makao').then(({ playMakaoBotTurn }) => {
        setGameState((prev: any) => {
          const next = playMakaoBotTurn(prev);
          setPlayers(next.players);
          addLog(next.statusMessage, activePlayer.name, 'action');
          if (next.winnerId) {
            const winner = next.players.find((p: Player) => p.id === next.winnerId);
            addLog(`🏆 ${winner?.name} WYGRYWA MAKAO!`, winner?.name, 'win');
            handleGameEnd(next.players, next.winnerId);
          }
          return next;
        });
      });
    } else if (gameType === 'tysiac') {
      import('../games/tysiac').then(({ playTysiacBotTurn }) => {
        setGameState((prev: any) => {
          const next = playTysiacBotTurn(prev);
          setPlayers(next.players);
          
          if (next.statusMessage !== gameState.statusMessage) {
            addLog(next.statusMessage, activePlayer.name, 'action');
          }

          // Sprawdzenie faz podsumowania w Tysiącu
          if (next.phase === 'round_score' && prev.phase !== 'round_score') {
            resolveTysiacRound(next);
          }

          return next;
        });
      });
    }
  };

  const handleGameEnd = (endPlayers: Player[], winnerId: string) => {
    // Policz punkty karne dla przegranych
    const winnersScore = endPlayers.map(p => {
      let earned = 0;
      if (p.id === winnerId) {
        earned = 100; // Zwycięzca rundy dostaje 100 pkt
      } else {
        // Policz karę na bazie kart w ręce
        if (gameType === 'remik') {
          const sum = p.hand.reduce((s, c) => s + getRummyCardValue(c), 0);
          earned = -sum;
        } else if (gameType === 'makao') {
          earned = -p.hand.length * 10; // Każda karta w ręce to -10 pkt
        }
      }
      return {
        ...p,
        score: p.score + earned,
        roundsScores: [...p.roundsScores, earned],
      };
    });

    setPlayers(winnersScore);
    onScoreSave(winnersScore.map(p => ({ name: p.name, score: p.score })));
  };

  // Rozliczenie rundy w Tysiącu (Specjalne reguły)
  const resolveTysiacRound = (state: any) => {
    const finalPlayers = state.players.map((p: Player) => {
      let earned = state.roundPoints[p.id] || 0;
      
      // Zwycięzca licytacji musi ugrać minimum tyle, ile licytował
      if (p.id === state.players[state.highestBidderIndex].id) {
        if (earned < state.currentBid) {
          // Kara - traci tyle ile deklarował
          earned = -state.currentBid;
          addLog(`❌ ${p.name} nie zrealizował deklaracji (${state.currentBid} pkt)! Otrzymuje ${earned} pkt karnych.`, p.name, 'alert');
        } else {
          // Sukces - otrzymuje zadeklarowane lub zagrane punkty (zaokrąglone do dziesiątek)
          earned = Math.round(earned / 10) * 10;
          addLog(`✅ ${p.name} zrealizował kontrakt o wartości ${earned} pkt!`, p.name, 'meld');
        }
      } else {
        // Przeciwnicy zarabiają po prostu tyle ile ugrali, zaokrąglone do dziesiątek
        earned = Math.round(earned / 10) * 10;
      }

      // Baryłka / Limit 900 pkt: Gracz na poziomie 900+ nie może zbierać wolnych punktów, musi wygrać licytację aby iść do 1000
      let newScore = p.score + earned;
      if (p.score >= 900 && newScore > 900 && p.id !== state.players[state.highestBidderIndex].id) {
        newScore = p.score; // Blokada na 900 pkt bez wygranej licytacji
        addLog(`🛡️ Blokada 900 pkt (Baryłka) u gracza ${p.name}! Musi wygrać licytację, aby dobić do 1000 pkt.`, p.name, 'info');
      }

      return {
        ...p,
        score: newScore,
        roundsScores: [...p.roundsScores, earned],
      };
    });

    setPlayers(finalPlayers);

    // Sprawdzenie czy ktoś osiągnął 1000 pkt
    const winner = finalPlayers.find((p: Player) => p.score >= 1000);
    if (winner) {
      setGameState((prev: any) => ({ ...prev, phase: 'game_victory', winnerId: winner.id }));
      addLog(`👑 ${winner.name} MA PONAD 1000 PUNKTÓW! WYGRAL CAŁĄ GRĘ!`, winner.name, 'win');
    } else {
      addLog('Rozpoczyna się nowa tura rozdania w Tysiąca!', undefined, 'info');
      // Przycisk restart rundy będzie widoczny
    }
  };

  const toggleSelectCard = (cardId: string) => {
    if (!isHumanTurn) return;
    setSelectedCards(prev => ({
      ...prev,
      [cardId]: !prev[cardId],
    }));
  };

  // ----- RUCH ZWYKŁY - REMIK -----
  const rummyDrawFromDeck = () => {
    if (!isHumanTurn || gameState.phase !== 'draw') return;
    setGameState((prev: any) => {
      const next = { ...prev };
      const drawn = next.deck.pop();
      if (drawn) {
        next.players[next.activePlayerIndex].hand.push(drawn);
        addLog(`Pobrałeś kartę z zakrytej talii.`, activePlayer.name, 'action');
      }
      next.phase = 'action';
      return next;
    });
  };

  const rummyDrawFromDiscard = () => {
    if (!isHumanTurn || gameState.phase !== 'draw' || gameState.discardPile.length === 0) return;
    setGameState((prev: any) => {
      const next = { ...prev };
      const drawn = next.discardPile.pop();
      if (drawn) {
        next.players[next.activePlayerIndex].hand.push(drawn);
        addLog(`Pobrałeś ${drawn.label}${SUIT_SYMBOLS[drawn.suit]} z odrzuconych.`, activePlayer.name, 'action');
      }
      next.phase = 'action';
      return next;
    });
  };

  const rummyDiscardCard = (card: Card) => {
    if (!isHumanTurn || gameState.phase !== 'action') return;
    setGameState((prev: any) => {
      const next = { ...prev };
      const activeP = next.players[next.activePlayerIndex];
      activeP.hand = activeP.hand.filter((c: Card) => c.id !== card.id);
      next.discardPile.push(card);
      
      addLog(`Odrzuciłeś kartę ${card.label}${SUIT_SYMBOLS[card.suit]} na stos.`, activeP.name, 'action');

      if (activeP.hand.length === 0) {
        next.winnerId = activeP.id;
        addLog(`🏆 Gratulacje! Wygrałeś tę rundę Remika!`, activeP.name, 'win');
        handleGameEnd(next.players, activeP.id);
      } else {
        // Następny gracz
        next.activePlayerIndex = (prev.activePlayerIndex + 1) % prev.players.length;
        next.phase = 'draw';
      }
      return next;
    });
  };

  const rummyCreateMeld = () => {
    if (!isHumanTurn || gameState.phase !== 'action') return;
    const selected = activePlayer.hand.filter(c => selectedCards[c.id]);
    
    if (selected.length < 3) {
      addLog('Meldunek musi składać się z minimum 3 kart!', activePlayer.name, 'alert');
      return;
    }

    const isGroup = isValidGroup(selected);
    const isRun = isValidRun(selected);

    if (!isGroup && !isRun) {
      addLog('Wybrane karty nie tworzą prawidłowej sekwencji ani grupy!', activePlayer.name, 'alert');
      return;
    }

    const meldPoints = calculateMeldPoints(selected);
    const hasAlreadyMelded = gameState.firstMeldsByPlayer[activePlayer.id] || false;

    if (!hasAlreadyMelded && meldPoints < 51) {
      addLog(`Twój pierwszy meldunek musi mieć co najmniej 51 pkt! (Wybrane karty mają ${meldPoints} pkt)`, activePlayer.name, 'alert');
      return;
    }

    setGameState((prev: any) => {
      const next = { ...prev };
      // Usuń karty z ręki
      next.players[next.activePlayerIndex].hand = next.players[next.activePlayerIndex].hand.filter(
        (c: Card) => !selectedCards[c.id]
      );
      // Dodaj meldunek na stół
      next.tableMelds.push({
        id: `meld-${Date.now()}`,
        playerId: activePlayer.id,
        cards: selected,
        type: isRun ? 'run' : 'group',
      });
      next.firstMeldsByPlayer[activePlayer.id] = true;
      addLog(`Wyłożyłeś meldunek (${isRun ? 'Sekwencja' : 'Czysty komplet'}) o wartości ${meldPoints} pkt!`, activePlayer.name, 'meld');
      return next;
    });

    setSelectedCards({});
  };


  // ----- MAKAO ACTIONS -----
  const playMakaoCardAction = (card: Card) => {
    if (!isHumanTurn) return;
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    const valid = canPlayCard(
      card, 
      topCard, 
      gameState.drawStack, 
      gameState.skipStack, 
      gameState.demandedValue, 
      gameState.demandedSuit
    );

    if (!valid) {
      addLog(`Nie możesz zagrać karty ${card.label}${SUIT_SYMBOLS[card.suit]} na ${topCard.label}${SUIT_SYMBOLS[topCard.suit]}!`, activePlayer.name, 'alert');
      return;
    }

    setGameState((prev: any) => {
      const next = { ...prev };
      const currentH = next.players[next.activePlayerIndex].hand.filter((c: Card) => c.id !== card.id);
      next.discardPile.push(card);

      // Reset żądań Asa/Waleta
      next.demandedSuit = null;
      if (next.demandedValue && next.demandOrbitLeft > 0) {
        next.demandOrbitLeft--;
        if (next.demandOrbitLeft === 0) next.demandedValue = null;
      }

      let message = `Rzuca ${card.label}${SUIT_SYMBOLS[card.suit]}.`;

      // Obsługa kart bojowych / funkcyjnych
      if (card.value === '2') {
        next.drawStack += 2;
        message += ` Następny gracz dobiera ${next.drawStack} kart lub kładzie bitewną.`;
      } else if (card.value === '3') {
        next.drawStack += 3;
        message += ` Następny gracz dobiera ${next.drawStack} kart lub kładzie bitewną.`;
      } else if (card.value === '4') {
        next.skipStack += 1;
        message += ` Następny gracz czeka turę lub kładzie 4.`;
      } else if (card.value === 'J') {
        // Żądanie losowej niebojowej wartości
        next.demandedValue = '10'; // Domyślnie dla usera, ułatwione
        next.demandOrbitLeft = prev.players.length;
        message += ` Żąda kart o wartości 10.`;
      } else if (card.value === 'A') {
        // Żądanie koloru
        next.demandedSuit = 'H'; // Domyślnie Kier dla usera, ułatwione
        message += ` Żąda koloru Kier ♥.`;
      } else if (card.value === 'K' && (card.suit === 'H' || card.suit === 'S')) {
        next.drawStack += 5;
        message += ` Kładzie Króla Bitewnego! Kolejny gracz dobiera ${next.drawStack} kart!`;
      }

      addLog(message, activePlayer.name, 'action');

      // Sprawdzenie Makao
      const isMakao = currentH.length === 1;
      const decMakao = isMakao; 
      if (isMakao) addLog(`📣 Ogłaszasz MAKAO!`, activePlayer.name, 'meld');

      next.players[next.activePlayerIndex].hand = currentH;
      next.players[next.activePlayerIndex].declaredMakao = decMakao;

      if (currentH.length === 0) {
        next.winnerId = activePlayer.id;
        addLog(`🏆 Gratulacje, wygrałeś grę Makao!`, activePlayer.name, 'win');
        handleGameEnd(next.players, activePlayer.id);
      } else {
        next.activePlayerIndex = (prev.activePlayerIndex + 1) % prev.players.length;
      }

      return next;
    });
  };

  const drawMakaoCardAction = () => {
    if (!isHumanTurn) return;
    setGameState((prev: any) => {
      const next = { ...prev };
      const activeP = next.players[next.activePlayerIndex];
      let currentH = [...activeP.hand];

      if (next.drawStack > 0) {
        addLog(`Nie masz obrony! Dobierasz karę ${next.drawStack} kart.`, activeP.name, 'alert');
        for (let i = 0; i < next.drawStack; i++) {
          const drawn = next.deck.pop();
          if (drawn) currentH.push(drawn);
        }
        next.drawStack = 0;
      } else if (next.skipStack > 0) {
        next.skipStack--;
        addLog(`Czekasz tę rundę.`, activeP.name, 'info');
      } else {
        const drawn = next.deck.pop();
        if (drawn) {
          currentH.push(drawn);
          addLog(`Dobrałeś kartę ze stosu.`, activeP.name, 'action');
        }
      }

      next.players[next.activePlayerIndex].hand = currentH;
      next.activePlayerIndex = (prev.activePlayerIndex + 1) % prev.players.length;
      return next;
    });
  };


  // ----- TYSIĄC ACTIONS -----
  const playTysiacBid = (bidVal: number) => {
    if (!isHumanTurn || gameState.phase !== 'licytacja') return;
    if (bidVal <= gameState.currentBid) {
      addLog('Musisz zalicytować więcej niż aktualna stawka!', activePlayer.name, 'alert');
      return;
    }

    setGameState((prev: any) => {
      const next = { ...prev };
      next.currentBid = bidVal;
      next.highestBidderIndex = prev.activePlayerIndex;
      addLog(`Licytujesz ${bidVal} pkt!`, activePlayer.name, 'action');

      // Kolejna osoba
      let i = (prev.activePlayerIndex + 1) % 3;
      while (!next.activeLicitators[i]) {
        i = (i + 1) % 3;
      }
      next.activePlayerIndex = i;
      return next;
    });
  };

  const passTysiacBid = () => {
    if (!isHumanTurn || gameState.phase !== 'licytacja') return;
    setGameState((prev: any) => {
      const next = { ...prev };
      next.activeLicitators[prev.activePlayerIndex] = false;
      addLog('Pasujesz w licytacji.', activePlayer.name, 'action');

      const activeCount = next.activeLicitators.filter(Boolean).length;
      if (activeCount === 1) {
        const winnerIdx = next.activeLicitators.findIndex(Boolean);
        next.highestBidderIndex = winnerIdx;
        next.activePlayerIndex = winnerIdx;
        next.phase = 'musik_view';
        addLog(`Licytację wygrał ${next.players[winnerIdx].name} z deklaracją ${next.currentBid} pkt!`, undefined, 'win');
      } else {
        let i = (prev.activePlayerIndex + 1) % 3;
        while (!next.activeLicitators[i]) {
          i = (i + 1) % 3;
        }
        next.activePlayerIndex = i;
      }
      return next;
    });
  };

  const takeTysiacMusik = () => {
    if (!isHumanTurn || gameState.phase !== 'musik_view') return;
    setGameState((prev: any) => {
      const next = { ...prev };
      const currentH = [...next.players[next.highestBidderIndex].hand, ...next.musik];
      next.players[next.highestBidderIndex].hand = currentH;
      next.musik = [];
      next.phase = 'musik_distribute';
      addLog('Zabrałeś musik do ręki. Teraz oddaj po 1 wybranej karcie każdemu przeciwnikowi.', activePlayer.name, 'info');
      return next;
    });
  };

  const giveTysiacCard = (card: Card, targetPlayerIndex: number) => {
    if (!isHumanTurn || gameState.phase !== 'musik_distribute') return;
    if (targetPlayerIndex === gameState.highestBidderIndex) return;

    setGameState((prev: any) => {
      const next = { ...prev };
      const activeP = next.players[next.highestBidderIndex];
      
      // Oddanie karty
      activeP.hand = activeP.hand.filter((c: Card) => c.id !== card.id);
      next.players[targetPlayerIndex].hand.push(card);

      addLog(`Oddałeś kartę graczowi ${next.players[targetPlayerIndex].name}.`, activePlayer.name, 'action');

      // Sprawdzamy czy dłoń wróciła do 8 kart (zaczynał z 7+3=10, musi oddać 2)
      if (activeP.hand.length === 8) {
        next.phase = 'rozgrywka';
        next.activePlayerIndex = next.highestBidderIndex;
        next.startingTrickPlayerIndex = next.highestBidderIndex;
        addLog('Wszyscy mają po 8 kart. Rozpoczynamy lewy!', undefined, 'info');
      }
      return next;
    });
  };

  const playTysiacTrickCard = (card: Card) => {
    if (!isHumanTurn || gameState.phase !== 'rozgrywka') return;

    const valid = canPlayTysiacCard(card, activePlayer.hand, gameState.trickCards, gameState.trumpSuit);
    if (!valid) {
      addLog('Zasada koloru, bicia lub kozery! Wybierz poprawną kartę.', activePlayer.name, 'alert');
      return;
    }

    setGameState((prev: any) => {
      const next = { ...prev };
      
      // Obsługa meldunku na starcie lewy
      if (next.trickCards.length === 0) {
        const suits = checkMarriages(activePlayer.hand);
        // Jeśli położyliśmy Q lub K z koloru marjażu który posiadamy, meldujemy!
        if (suits.includes(card.suit) && (card.value === 'Q' || card.value === 'K')) {
          next.trumpSuit = card.suit;
          next.declaredMarriages.push({ playerId: activePlayer.id, suit: card.suit });
          next.roundPoints[activePlayer.id] += TYSIAC_MARRIAGE_VALUES[card.suit];
          addLog(`📣 Meldujesz Marjaż ${SUIT_NAMES[card.suit]} (+${TYSIAC_MARRIAGE_VALUES[card.suit]} pkt)! Atut: ${SUIT_NAMES[card.suit]}.`, activePlayer.name, 'meld');
        }
      }

      // Wyrzuć kartę z dłoni
      next.players[next.activePlayerIndex].hand = activePlayer.hand.filter((c: Card) => c.id !== card.id);
      next.trickCards.push({ playerId: activePlayer.id, card });

      // Sprawdzenie czy zebrano 3 karty na stole
      if (next.trickCards.length === 3) {
        import('../games/tysiac').then(({ getTrickWinnerIndex }) => {
          setGameState((prevSt: any) => {
            const nextSt = { ...prevSt };
            const winnerIdx = getTrickWinnerIndex(nextSt.trickCards, nextSt.trumpSuit, nextSt.players);
            const winner = nextSt.players[winnerIdx];
            
            const trickVal = nextSt.trickCards.reduce((s: number, tc: any) => s + TYSIAC_CARD_VALUES[tc.card.value], 0);
            nextSt.roundPoints[winner.id] += trickVal;
            
            addLog(`Lewę zgarnia ${winner.name} (+${trickVal} pkt).`, winner.name, 'action');

            nextSt.activePlayerIndex = winnerIdx;
            nextSt.startingTrickPlayerIndex = winnerIdx;
            nextSt.trickCards = [];
            nextSt.roundTricksCount += 1;

            if (nextSt.roundTricksCount === 8) {
              nextSt.phase = 'round_score';
              resolveTysiacRound(nextSt);
            }
            return nextSt;
          });
        });
      } else {
        next.activePlayerIndex = (prev.activePlayerIndex + 1) % 3;
      }

      return next;
    });
  };

  const restartTysiacRound = () => {
    import('../games/tysiac').then(({ initTysiacGame }) => {
      const nextGame = initTysiacGame(players.map(p => p.name), players.filter(p => !p.isBot).length);
      // Przekaż dotychczasowy skumulowany wynik
      const updatedPlayers = nextGame.players.map((p, idx) => ({
        ...p,
        score: players[idx].score,
        roundsScores: players[idx].roundsScores,
      }));
      setPlayers(updatedPlayers);
      setGameState({
        ...nextGame,
        players: updatedPlayers,
      });
      addLog('Rozpoczęto nową rundę w Tysiąca! Rozdanie kart.', undefined, 'info');
    });
  };

  // Kolory tła dla kart
  const getSuitSymbol = (suit: CardSuit) => SUIT_SYMBOLS[suit];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 select-none" id="card-table-view">
      {/* GŁÓWNY STÓŁ DLA KART */}
      <div className="lg:col-span-3 flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 relative overflow-hidden min-h-[600px] shadow-2xl shadow-slate-950/50">
        {/* Wirtualne sukno / tekstura */}
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-slate-900/50 to-indigo-900/10 pointer-events-none" />

        {/* STATUS GRY */}
        <div className="flex justify-between items-center bg-white/10 backdrop-blur-lg px-4 py-2 rounded-2xl border border-white/10 mb-6 z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-mono font-medium tracking-wide text-slate-200 uppercase">
              Gra: {gameType === 'remik' ? 'Remik' : gameType === 'makao' ? 'Makao' : 'Tysiąc (1000)'}
            </span>
          </div>

          <div className="text-sm font-semibold text-white">
            {gameState.winnerId ? (
              <span className="text-rose-400">Runda zakończona!</span>
            ) : botThinking ? (
              <span className="text-indigo-400 animate-pulse">Bot myśli...</span>
            ) : isHumanTurn ? (
              <span className="text-indigo-300">Twój ruch!</span>
            ) : (
              <span className="text-slate-300">Ruch gracza: {activePlayer?.name}</span>
            )}
          </div>
        </div>

        {/* RENDEROWANIE PRZECIWNIKÓW (BOTÓW / DRUGIEGO GRACZA) */}
        <div className="flex justify-around mb-8 z-10 gap-4">
          {players.map((player, idx) => {
            if (player.id === activePlayer?.id && player.isBot) {
              // Animacja myślenia bota nad jego awatarem
            }
            if (idx === 0 && playMode === 'solo') return null; // Nasz hand na dole
            if (gameType === 'tysiac' && idx === 0) return null; // W tysiącu gra 3 graczy, ty na dole

            // Dla normalnej gry 3/4 graczy, pokazujemy małe panele ich kart
            const isCurrent = idx === gameState.activePlayerIndex;
            return (
              <div 
                key={player.id} 
                className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-300 border ${
                  isCurrent ? 'bg-white/10 border-white/20 ring-2 ring-indigo-500/50 scale-105' : 'bg-white/5 border-white/5'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {player.isBot ? <Cpu className="w-3.5 h-3.5 text-slate-300" /> : <User className="w-3.5 h-3.5 text-slate-300" />}
                  <span className="text-xs font-medium text-white">{player.name}</span>
                  {player.declaredMakao && (
                    <span className="px-1 py-0.5 bg-rose-600 text-[10px] text-white rounded font-bold uppercase animate-bounce">
                      Makao
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-emerald-300">Wynik: {player.score} pkt</div>
                {/* Reprezentacja kart w dłoni oponenta (zakryte) */}
                <div className="flex -space-x-2 mt-2">
                  {player.hand.map((_, hIdx) => (
                    <div 
                      key={hIdx} 
                      className="w-5 h-8 bg-slate-900 rounded-md border border-slate-700 shadow-sm flex items-center justify-center"
                      style={{ transform: 'rotate(-3deg)' }}
                    >
                      <div className="w-3 h-5 bg-rose-800/45 rounded-sm" />
                    </div>
                  ))}
                  {player.hand.length === 0 && (
                    <div className="text-[10px] text-rose-300 uppercase">Pusta dłoń</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CENTRUM STOŁU - STOSY KART, KOZERA, AKTYWNE LEWY */}
        <div className="flex-1 flex flex-col justify-center items-center py-6 min-h-[160px] z-10 relative">
          {/* KOZERA / ATUT dla Tysiąca lub żądania dla Makao */}
          {(gameState.trumpSuit || gameState.demandedSuit || gameState.demandedValue) && (
            <div className="absolute top-0 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-full text-xs font-mono">
              <span className="text-slate-400 text-[10px] uppercase">Aktywne:</span>
              {gameState.trumpSuit && (
                <span className="text-yellow-400 font-bold flex items-center gap-1">
                  Trump: {SUIT_NAMES[gameState.trumpSuit]} {SUIT_SYMBOLS[gameState.trumpSuit]}
                </span>
              )}
              {gameState.demandedSuit && (
                <span className="text-sky-400 font-bold">
                  Żądanie Asa: {SUIT_NAMES[gameState.demandedSuit]}
                </span>
              )}
              {gameState.demandedValue && (
                <span className="text-sky-400 font-bold">
                  Żądanie Waleta: {gameState.demandedValue}
                </span>
              )}
            </div>
          )}

          <div className="flex gap-8 items-center justify-center">
            {/* STOS KART DO DOBIERANIA */}
            {gameState.deck && gameState.deck.length > 0 && (
              <div 
                onClick={() => {
                  if (gameType === 'remik') rummyDrawFromDeck();
                  if (gameType === 'makao') drawMakaoCardAction();
                }}
                className={`relative w-20 h-28 bg-slate-900 rounded-xl border-2 border-slate-700 shadow-md flex flex-col justify-center items-center cursor-pointer select-none transition-transform hover:-translate-y-1 hover:border-emerald-400 ${
                  gameState.phase === 'draw' && gameType === 'remik' ? 'ring-4 ring-rose-500 animate-pulse' : ''
                }`}
              >
                {/* Wzór rewersu graficznego */}
                <div className="absolute inset-1 border border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center bg-slate-950">
                  <div className="w-8 h-8 rounded-full border border-slate-800 flex items-center justify-center">
                    <span className="text-slate-500 text-lg">♠</span>
                  </div>
                  <span className="text-[10px] font-mono mt-1 text-slate-500">{gameState.deck.length} kart</span>
                </div>
              </div>
            )}

            {/* STOS ODDRZUCONYCH (TOP CARD) */}
            {gameState.discardPile && gameState.discardPile.length > 0 && (
              <div className="flex flex-col items-center">
                <div 
                  onClick={() => {
                    if (gameType === 'remik') rummyDrawFromDiscard();
                  }}
                  className={`w-20 h-28 bg-white text-slate-900 rounded-xl relative border border-slate-300 shadow-xl flex flex-col justify-between p-2 select-none select-none transition-transform ${
                    gameType === 'remik' && gameState.phase === 'draw' ? 'cursor-pointer hover:-translate-y-1 hover:ring-2 hover:ring-emerald-400' : ''
                  }`}
                >
                  {/* Mini-suit w rogach */}
                  <div className="flex justify-between items-start leading-none">
                    <span className="text-sm font-bold">{gameState.discardPile[gameState.discardPile.length - 1].label}</span>
                    <span className={`text-sm ${SUIT_COLORS[gameState.discardPile[gameState.discardPile.length - 1].suit]}`}>
                      {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                    </span>
                  </div>
                  
                  {/* Centrum */}
                  <div className="flex justify-center items-center text-3xl">
                    <span className={`${SUIT_COLORS[gameState.discardPile[gameState.discardPile.length - 1].suit]}`}>
                      {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                    </span>
                  </div>

                  {/* Odwrócone w rogach */}
                  <div className="flex justify-between items-end leading-none rotate-180">
                    <span className="text-sm font-bold">{gameState.discardPile[gameState.discardPile.length - 1].label}</span>
                    <span className={`text-sm ${SUIT_COLORS[gameState.discardPile[gameState.discardPile.length - 1].suit]}`}>
                      {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-300/60 mt-1">Stos odrzuconych</span>
              </div>
            )}

            {/* MUSIK W TYSIĄCU (Gdy leży na stole do wglądu) */}
            {gameType === 'tysiac' && gameState.phase === 'musik_view' && (
              <div className="flex flex-col items-center animate-bounce">
                <div className="flex gap-2">
                  {gameState.musik.map((card: Card) => (
                    <div 
                      key={card.id}
                      className="w-16 h-24 bg-white text-slate-900 rounded-xl relative border-2 border-yellow-400 shadow-lg flex flex-col justify-between p-1.5"
                    >
                      <div className="flex justify-between items-start leading-none text-xs">
                        <span className="font-bold">{card.label}</span>
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>
                      <div className="flex justify-center items-center text-xl">
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>
                      <div className="flex justify-between items-end leading-none text-xs rotate-180">
                        <span className="font-bold">{card.label}</span>
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {isHumanTurn && (
                  <button 
                    onClick={takeTysiacMusik}
                    className="mt-3 px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold rounded-lg text-xs tracking-wider transition-colors"
                  >
                    ZABIERZ MUSIK DO RĘKI
                  </button>
                )}
              </div>
            )}

            {/* AKTYWNA LEWA NA STOLE (Tysiąc) */}
            {gameType === 'tysiac' && gameState.trickCards && gameState.trickCards.length > 0 && (
              <div className="flex flex-col items-center">
                <div className="flex gap-3 relative justify-center items-center">
                  <AnimatePresence>
                    {gameState.trickCards.map((tc: any, tIdx: number) => {
                      const plName = players.find(p => p.id === tc.playerId)?.name || 'Gracz';
                      return (
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0, y: 15 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          key={tc.card.id}
                          className="flex flex-col items-center"
                        >
                          <div 
                            className="w-14 h-20 bg-white text-slate-900 rounded-lg relative border border-slate-300 shadow-md flex flex-col justify-between p-1"
                          >
                            <div className="flex justify-between items-start leading-none text-[10px]">
                              <span className="font-bold">{tc.card.label}</span>
                              <span className={`${SUIT_COLORS[tc.card.suit]}`}>{getSuitSymbol(tc.card.suit)}</span>
                            </div>
                            <div className="flex justify-center items-center text-sm">
                              <span className={`${SUIT_COLORS[tc.card.suit]}`}>{getSuitSymbol(tc.card.suit)}</span>
                            </div>
                            <div className="text-[8px] text-center font-mono text-slate-400 capitalize">
                              {plName.substring(0, 5)}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <span className="text-[10px] font-mono text-emerald-300/60 mt-2">Lewa w grze</span>
              </div>
            )}
          </div>
        </div>

        {/* WYŁOŻONE MELDUNKI NA STOLE (Dla Remika) */}
        {gameType === 'remik' && gameState.tableMelds && gameState.tableMelds.length > 0 && (
          <div className="mb-6 bg-slate-900/60 p-3 rounded-2xl border border-emerald-800/20 z-10">
            <h4 className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-2 font-semibold">
              Meldunki na stole:
            </h4>
            <div className="flex flex-wrap gap-4 max-h-[140px] overflow-y-auto">
              {gameState.tableMelds.map((meld: RummyMeld) => {
                const owner = players.find(p => p.id === meld.playerId)?.name || 'Gracz';
                return (
                  <div key={meld.id} className="bg-emerald-950/40 p-2 rounded-xl border border-emerald-800/40 flex flex-col items-start gap-1">
                    <span className="text-[9px] font-semibold text-slate-300">{owner} ({meld.type === 'run' ? 'Sekwencja' : 'Zestaw'}):</span>
                    <div className="flex gap-1">
                      {meld.cards.map((c: Card) => (
                        <div 
                          key={c.id} 
                          className="w-8 h-12 bg-white text-slate-900 rounded-md flex flex-col justify-between p-0.5 border border-slate-300 shadow text-[9px] font-bold"
                        >
                          <div className="flex justify-between leading-none">
                            <span>{c.label}</span>
                            <span className={SUIT_COLORS[c.suit]}>{getSuitSymbol(c.suit)}</span>
                          </div>
                          <div className="text-center text-xs text-rose-500">{getSuitSymbol(c.suit)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* OBSZAR GRACZA (NA DOLE STOŁU) */}
        <div className="mt-auto flex flex-col items-center w-full z-10 border-t border-emerald-800/30 pt-4">
          
          {/* LICYTACJA / PANEL KONTROLNY DLA TYSIĄCA */}
          {gameType === 'tysiac' && gameState.phase === 'licytacja' && (
            <div className="mb-4 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 w-full max-w-md animate-fade-in text-center">
              <span className="text-xs font-semibold text-orange-400 block mb-2 font-mono uppercase tracking-widest">
                Stacja Licytacji (Aktualna: {gameState.currentBid} pkt)
              </span>
              <p className="text-xs text-slate-300 mb-4 font-mono">
                Prowadzi licytację: {players[gameState.highestBidderIndex]?.name || 'Ty'}
              </p>

              {isHumanTurn ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  <button 
                    onClick={() => playTysiacBid(gameState.currentBid + 10)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 font-bold rounded-lg text-xs transition-colors"
                  >
                    Licytuj {gameState.currentBid + 10}
                  </button>
                  <button 
                    onClick={() => playTysiacBid(gameState.currentBid + 20)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 font-bold rounded-lg text-xs transition-colors"
                  >
                    Licytuj {gameState.currentBid + 20}
                  </button>
                  <button 
                    onClick={passTysiacBid}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-lg text-xs text-slate-300 transition-colors"
                  >
                    Pas (Spasuj)
                  </button>
                </div>
              ) : (
                <div className="text-xs font-semibold text-rose-400 animate-pulse">
                  Bot licytuje... Proszę czekać
                </div>
              )}
            </div>
          )}

          {/* PRIVACY SCREEN DLA TRYBU PASS & PLAY */}
          {passDeviceOverlay && (
            <div className="absolute inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-6 text-center rounded-3xl">
              <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold font-sans text-white mb-2">Przekaż urządzenie!</h2>
              <p className="text-sm text-slate-300 mb-6 max-w-sm">
                Ruch należy do gracza: <span className="font-bold text-rose-400 text-lg">{activePlayer?.name}</span>. 
                Ukryj swoje karty, zanim gracz kliknie aby kontynuować.
              </p>
              <button 
                onClick={() => setPassDeviceOverlay(false)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-sm shadow-xl hover:shadow-emerald-500/20 transition-all font-mono tracking-wider"
              >
                JESTEM PRZY URZĄDZENIU - POKAŻ KARTY
              </button>
            </div>
          )}

          {/* AKCJE RUCOWE USERA */}
          {isHumanTurn && (
            <div className="flex flex-wrap gap-2 mb-4 justify-center">
              {/* Przycisk akcji w dłoni dla Remika - układ i meldowanie */}
              {gameType === 'remik' && gameState.phase === 'action' && (
                <button
                  onClick={rummyCreateMeld}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow flex items-center gap-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" /> WYŁÓŻ SELEKCJĘ (MIN 51 PKT)
                </button>
              )}

              {/* Instrukcje */}
              {gameType === 'remik' && (
                <span className="text-[10px] font-mono text-emerald-300/70 py-1">
                  {gameState.phase === 'draw' ? 'Dobierz kartę z góry (Deck) lub stosu odrzuconych!' : 'Wybierz karty do meldunku lub kliknij kartę aby odrzucić.'}
                </span>
              )}
              {gameType === 'makao' && (
                <span className="text-[10px] font-mono text-emerald-300/70 py-1">
                  Kliknij pasującą kartę, aby zagrać. Jeśli nie masz, naciśnij zakrytą talię aby dobrać!
                </span>
              )}
              {gameType === 'tysiac' && gameState.phase === 'musik_distribute' && (
                <span className="text-[10px] font-mono text-yellow-400 font-semibold py-1">
                  Rozdaj nadprogramowe karty klikając na kartę i przydzielając ją oponentowi!
                </span>
              )}
            </div>
          )}

          {/* DŁOŃ GRACZA (KARTY USERA) */}
          <div className="flex flex-col items-center w-full">
            <div className="text-xs text-emerald-400 font-mono mb-2 flex items-center gap-1.5">
              <User className="w-4.5 h-4.5 text-rose-400" />
              <span>Twoje karty ({players[0]?.name || 'Gracz'}):</span>
              <span className="text-slate-300 font-normal">Wynik ogólny: {players[0]?.score || 0} pkt</span>
            </div>

            {/* Wizualna dłoń - wachlarz kart */}
            <div className="flex flex-wrap justify-center gap-2 max-w-full px-2 py-4 select-none">
              {players[0]?.hand.map((card: Card) => {
                const isSelected = !!selectedCards[card.id];
                
                // Walidacja optyczna przydatności zagrania (zielona poświata)
                let isPlayable = false;
                if (isHumanTurn) {
                  if (gameType === 'makao') {
                    const topC = gameState.discardPile[gameState.discardPile.length - 1];
                    isPlayable = canPlayCard(card, topC, gameState.drawStack, gameState.skipStack, gameState.demandedValue, gameState.demandedSuit);
                  } else if (gameType === 'tysiac' && gameState.phase === 'rozgrywka') {
                    isPlayable = canPlayTysiacCard(card, players[0].hand, gameState.trickCards, gameState.trumpSuit);
                  }
                }

                return (
                  <div key={card.id} className="relative group">
                    <div 
                      onClick={() => {
                        if (gameType === 'remik') {
                          toggleSelectCard(card.id);
                        } else if (gameType === 'makao') {
                          playMakaoCardAction(card);
                        } else if (gameType === 'tysiac') {
                          if (gameState.phase === 'rozgrywka') {
                            playTysiacTrickCard(card);
                          }
                        }
                      }}
                      className={`w-16 h-24 bg-white text-slate-900 rounded-xl relative border shadow-lg flex flex-col justify-between p-2 cursor-pointer transition-all ${
                        isSelected ? '-translate-y-4 border-rose-500 ring-2 ring-rose-500' : 'hover:-translate-y-2'
                      } ${
                        isHumanTurn && isPlayable ? 'ring-2 ring-emerald-400 shadow-emerald-400/20' : ''
                      }`}
                    >
                      {/* Mini-suit w rogach */}
                      <div className="flex justify-between items-start leading-none text-xs">
                        <span className="font-bold">{card.label}</span>
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>
                      
                      {/* Centrum */}
                      <div className="flex justify-center items-center text-xl">
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>

                      {/* Odwrócone w rogach */}
                      <div className="flex justify-between items-end leading-none rotate-180 text-xs">
                        <span className="font-bold">{card.label}</span>
                        <span className={`${SUIT_COLORS[card.suit]}`}>{getSuitSymbol(card.suit)}</span>
                      </div>
                    </div>

                    {/* Szybki odrzut w Remiku (Prawy klik lub ikona odrzucenia) */}
                    {gameType === 'remik' && isHumanTurn && gameState.phase === 'action' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          rummyDiscardCard(card);
                        }}
                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-rose-600 hover:bg-rose-700 text-white text-[9px] px-1 py-0.5 rounded shadow font-sans"
                      >
                        Odrzuć
                      </button>
                    )}

                    {/* Dystrybucja w Tysiącu (Gdy musimy oddać nadmiarowe karty) */}
                    {gameType === 'tysiac' && gameState.phase === 'musik_distribute' && isHumanTurn && (
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex gap-1 z-20">
                        <button 
                          onClick={() => giveTysiacCard(card, 1)}
                          className="bg-sky-600 hover:bg-sky-700 text-white text-[8px] px-1 py-0.5 rounded shadow font-bold"
                        >
                          Oddaj G2
                        </button>
                        <button 
                          onClick={() => giveTysiacCard(card, 2)}
                          className="bg-rose-600 hover:bg-rose-700 text-white text-[8px] px-1 py-0.5 rounded shadow font-bold"
                        >
                          Oddaj G3
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {players[0]?.hand.length === 0 && (
                <div className="text-sm font-semibold text-slate-300">Pusta dłoń</div>
              )}
            </div>
          </div>
        </div>

        {/* EKRAN KOŃCOWY - PODSUMOWANIE RUNDY */}
        {gameState.winnerId && (
          <div className="absolute inset-0 bg-slate-950/95 z-40 flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in border border-slate-800">
            <Award className="w-16 h-16 text-yellow-400 mb-2 animate-bounce" />
            <h2 className="text-3xl font-bold font-sans text-white mb-2">Koniec rundy!</h2>
            <p className="text-sm text-slate-300 mb-6">
              Zwycięzca: <span className="text-yellow-400 font-bold font-sans text-xl">
                {players.find(p => p.id === gameState.winnerId)?.name}
              </span>
            </p>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm mb-6">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2 font-bold">Wyniki rundy:</h4>
              <div className="space-y-2">
                {players.map(p => {
                  const lastScr = p.roundsScores[p.roundsScores.length - 1] || 0;
                  return (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-slate-300">{p.name}</span>
                      <span className="font-mono font-bold">
                        {p.score} pkt ({lastScr >= 0 ? `+${lastScr}` : lastScr})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-4">
              {gameType === 'tysiac' ? (
                <button 
                  onClick={restartTysiacRound}
                  className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold rounded-xl text-sm font-mono tracking-wider transition-colors shadow-lg"
                >
                  ROZPOCZNIJ KOLEJNE ROZDANIE
                </button>
              ) : (
                <button 
                  onClick={resetGame}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm font-mono tracking-wider transition-colors shadow-lg"
                >
                  NOWA ROZGRYWKA
                </button>
              )}
            </div>
          </div>
        )}

        {/* EKRAN ZWYCIĘSTWA CAŁKOWITEGO W TYSIĄCU */}
        {gameType === 'tysiac' && gameState.phase === 'game_victory' && (
          <div className="absolute inset-0 bg-slate-950/95 z-40 flex flex-col items-center justify-center p-6 text-center rounded-3xl animate-fade-in border border-slate-800">
            <Award className="w-20 h-20 text-yellow-400 mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold font-sans text-white mb-2">Zwycięstwo Królestwa!</h2>
            <p className="text-lg text-slate-300 mb-6">
              Całą grę do 1000 pkt wygrywa:
            </p>
            <span className="text-yellow-400 font-bold font-sans text-3xl block mb-8">
              🏆 {players.find(p => p.id === gameState.winnerId)?.name} 🏆
            </span>
            <button 
              onClick={resetGame}
              className="px-8 py-3 bg-yellow-500 hover:bg-yellow-600 text-slate-950 font-bold rounded-2xl text-base font-mono tracking-wider transition-all"
            >
              ZAGRAJ PONOWNIE!
            </button>
          </div>
        )}

      </div>

      {/* PANEL BOCZNY: LOGI ROZGRYWKI I PUNKTY */}
      <div className="flex flex-col gap-6" id="card-table-sidebar">
        
        {/* TABLICA WYNIKÓW MECZÓW */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase">
              Wyniki rund
            </h3>
            <span className="text-[10px] bg-white/10 text-indigo-300 px-2.5 py-0.5 rounded-full font-mono">
              Rundy
            </span>
          </div>
          <div className="space-y-3">
            {players.map((p, idx) => (
              <div key={p.id} className="flex justify-between items-center">
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                  <span className="text-xs font-semibold text-slate-200">{p.name}</span>
                </div>
                <div className="font-mono text-sm font-bold text-white">
                  {p.score} pkt
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* LOGI GRUPY */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-5 flex-1 flex flex-col shadow-lg max-h-[360px]">
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-400 uppercase mb-3 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-indigo-400" /> Krupier (Logi):
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 select-text scrollbar-thin scrollbar-thumb-slate-800">
            {logs.slice(-30).reverse().map((log) => (
              <div key={log.id} className="text-xs font-mono leading-snug border-b border-white/5 pb-1.5 animate-slide-in">
                <span className="text-[10px] text-slate-500 block">{log.timestamp}</span>
                <p className="text-slate-200">
                  {log.playerName && (
                    <span className="font-semibold text-indigo-400 font-sans mr-1">
                      [{log.playerName}]:
                    </span>
                  )}
                  {log.message}
                </p>
              </div>
            ))}
            {logs.length === 0 && (
              <p className="text-xs text-slate-500 italic text-center py-4">Brak wpisów krupiera</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
