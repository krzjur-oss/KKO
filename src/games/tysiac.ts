import { Card, Player, CardSuit } from '../types';
import { createTysiacDeck, shuffleDeck, TYSIAC_CARD_VALUES, TYSIAC_MARRIAGE_VALUES, SUIT_NAMES } from '../utils';

export interface TysiacState {
  players: Player[];
  deck: Card[];
  musik: Card[]; // 3 karty na stole (talon)
  activePlayerIndex: number;
  phase: 'licytacja' | 'musik_view' | 'musik_distribute' | 'rozgrywka' | 'round_score' | 'game_victory';
  
  // Stan licytacji
  currentBid: number;
  highestBidderIndex: number;
  activeLicitators: boolean[]; // Kto jeszcze nie spasował
  dealerIndex: number;

  // Stan rozgrywki
  trumpSuit: CardSuit | null; // Kolor atutowy (np. 'H' po zameldowaniu marjażu)
  trickCards: { playerId: string; card: Card }[]; // Karty aktualnie leżące na stole w danej lewie
  roundTricksCount: number; // Ile lew wykonano (do 8)
  startingTrickPlayerIndex: number; // Kto rzucił jako pierwszy w danej lewie
  
  // Deklaracje meldunków w danej rundzie
  declaredMarriages: { playerId: string; suit: CardSuit }[];
  
  // Punkty zdobyte w danej twardej rundzie
  roundPoints: Record<string, number>;
  
  statusMessage: string;
}

export function initTysiacGame(playerNames: string[], humanCount = 1): TysiacState {
  let deck = shuffleDeck(createTysiacDeck()); // Talia 24 kart (9-A)

  const players: Player[] = playerNames.slice(0, 3).map((name, index) => {
    const isBot = index >= humanCount;
    const hand: Card[] = [];
    
    // Rozdanie kart: 7 dla każdego gracza na start
    for (let c = 0; c < 7; c++) {
      const card = deck.pop();
      if (card) hand.push(card);
    }
    return {
      id: `tysiac-player-${index}`,
      name,
      isBot,
      isRemote: false,
      score: 0,
      roundsScores: [],
      hand,
    };
  });

  // Musik to pozostałe 3 karty
  const musik: Card[] = [];
  while (deck.length > 0) {
    musik.push(deck.pop()!);
  }

  return {
    players,
    deck: [],
    musik,
    activePlayerIndex: 1, // Zaczyna gracz po rozdającym (przyjmijmy gracza 1)
    phase: 'licytacja',
    currentBid: 100, // Minimalna stawka
    highestBidderIndex: 0, // Automatycznie mus "100" dla rozdającego (gracz 0)
    activeLicitators: [true, true, true],
    dealerIndex: 0,
    trumpSuit: null,
    trickCards: [],
    roundTricksCount: 0,
    startingTrickPlayerIndex: 0,
    declaredMarriages: [],
    roundPoints: { 'tysiac-player-0': 0, 'tysiac-player-1': 0, 'tysiac-player-2': 0 },
    statusMessage: 'Rozpoczęto licytację! Rozdający (Ty) ma mus 100. Gracz 2 licytuje.',
  };
}

// Sprawdzenie czy gracz posiada parę marjażową (Melduje Damę + Króla w tym samym kolorze)
export function checkMarriages(hand: Card[]): CardSuit[] {
  const suits: CardSuit[] = ['H', 'D', 'C', 'S'];
  const available: CardSuit[] = [];
  
  suits.forEach(suit => {
    const hasQueen = hand.some(c => c.suit === suit && c.value === 'Q');
    const hasKing = hand.some(c => c.suit === suit && c.value === 'K');
    if (hasQueen && hasKing) {
      available.push(suit);
    }
  });

  return available;
}

// Sprawdzenie czy karta pasuje do wyłożenia w Tysiącu (Zasada koloru, bicia i atutu)
export function canPlayTysiacCard(
  card: Card,
  hand: Card[],
  trickCards: { playerId: string; card: Card }[],
  trumpSuit: CardSuit | null
): boolean {
  if (trickCards.length === 0) return true; // Pierwszy ruch dowolny

  const firstPlayed = trickCards[0].card;
  const leadSuit = firstPlayed.suit;

  // 1. Obowiązek koloru
  const hasLeadSuit = hand.some(c => c.suit === leadSuit);
  if (hasLeadSuit) {
    if (card.suit !== leadSuit) return false;
    
    // Obowiązek bicia (zagranie wyższej karty jeśli mamy)
    // Znajdź dotychczasową najwyższą kartę na stole w danym kolorze wyjścia
    const sameSuitTricks = trickCards.filter(tc => tc.card.suit === leadSuit);
    let highestRankOnTable = -1;
    sameSuitTricks.forEach(tc => {
      const val = TYSIAC_CARD_VALUES[tc.card.value];
      if (val > highestRankOnTable) highestRankOnTable = val;
    });

    const higherCards = hand.filter(c => c.suit === leadSuit && TYSIAC_CARD_VALUES[c.value] > highestRankOnTable);
    if (higherCards.length > 0) {
      // Jeśli posiadamy wyższe, musimy zagrać wyższą niż leży
      return TYSIAC_CARD_VALUES[card.value] > highestRankOnTable;
    }
    return true; // Jeśli nie mamy wyższej, wystarczy dopasować kolor
  }

  // 2. Jeśli nie mamy koloru, obowiązek atutowania (zagranie kozery)
  if (trumpSuit) {
    const hasTrump = hand.some(c => c.suit === trumpSuit);
    if (hasTrump) {
      if (card.suit !== trumpSuit) return false;
      
      // Obowiązek bicia kozery na stole
      const trumpTricks = trickCards.filter(tc => tc.card.suit === trumpSuit);
      let highestTrumpOnTable = -1;
      trumpTricks.forEach(tc => {
        const val = TYSIAC_CARD_VALUES[tc.card.value];
        if (val > highestTrumpOnTable) highestTrumpOnTable = val;
      });

      const higherTrumps = hand.filter(c => c.suit === trumpSuit && TYSIAC_CARD_VALUES[c.value] > highestTrumpOnTable);
      if (higherTrumps.length > 0) {
        return TYSIAC_CARD_VALUES[card.value] > highestTrumpOnTable;
      }
      return true;
    }
  }

  // 3. Brak koloru i brak kozery -> dowolna karta
  return true;
}

// Liczenie kto bierze lewę
export function getTrickWinnerIndex(
  trickCards: { playerId: string; card: Card }[],
  trumpSuit: CardSuit | null,
  players: Player[]
): number {
  if (trickCards.length === 0) return 0;
  
  const leadSuit = trickCards[0].card.suit;
  let winnerId = trickCards[0].playerId;
  let highestValue = TYSIAC_CARD_VALUES[trickCards[0].card.value];
  let isTrumped = trickCards[0].card.suit === trumpSuit;

  for (let i = 1; i < trickCards.length; i++) {
    const current = trickCards[i];
    const curVal = TYSIAC_CARD_VALUES[current.card.value];
    const curSuit = current.card.suit;

    if (trumpSuit && curSuit === trumpSuit) {
      if (!isTrumped) {
        // Pierwsze przebicie kozerą
        winnerId = current.playerId;
        highestValue = curVal;
        isTrumped = true;
      } else if (curVal > highestValue) {
        // Kolejne, wyższe przebicie kozerą
        winnerId = current.playerId;
        highestValue = curVal;
      }
    } else if (!isTrumped && curSuit === leadSuit) {
      // Pasuje do koloru wyjścia i nie ma atutu na stole
      if (curVal > highestValue) {
        winnerId = current.playerId;
        highestValue = curVal;
      }
    }
  }

  return players.findIndex(p => p.id === winnerId);
}

// Automatyzacja tury bota w Tysiącu
export function playTysiacBotTurn(state: TysiacState): TysiacState {
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.isBot || state.phase === 'game_victory' || state.phase === 'round_score') return state;

  const newState = { ...state };

  // 1. FAZA LICYTACJI
  if (state.phase === 'licytacja') {
    // Prosta logika licytacji botów
    const marriages = checkMarriages(activePlayer.hand);
    let maxBotBid = 100;
    
    // Oblicz wartość ręki dla bota
    let handStrenghtPoints = activePlayer.hand.reduce((sum, c) => sum + TYSIAC_CARD_VALUES[c.value], 0);
    marriages.forEach(suit => {
      handStrenghtPoints += TYSIAC_MARRIAGE_VALUES[suit];
    });

    // Bot licytuje do maksymalnie 60% siły swoich kart
    maxBotBid = Math.min(300, 100 + Math.floor(handStrenghtPoints * 0.8 / 10) * 10);

    const nextBid = state.currentBid + 10;
    if (nextBid <= maxBotBid && Math.random() > 0.2) {
      // Licytuje wyżej
      newState.currentBid = nextBid;
      newState.highestBidderIndex = state.activePlayerIndex;
      newState.statusMessage = `Bot ${activePlayer.name} licytuje ${nextBid}!`;
    } else {
      // Pasuje
      newState.activeLicitators[state.activePlayerIndex] = false;
      newState.statusMessage = `Bot ${activePlayer.name} pasuje.`;
    }

    // Sprawdź czy został tylko 1 licytujący
    const activeCount = newState.activeLicitators.filter(Boolean).length;
    if (activeCount === 1) {
      // Koniec licytacji - zwycięzca bierze musik
      const winnerIdx = newState.activeLicitators.findIndex(Boolean);
      newState.highestBidderIndex = winnerIdx;
      newState.activePlayerIndex = winnerIdx;
      newState.phase = 'musik_view';
      newState.statusMessage = `Licytację wygrał ${newState.players[winnerIdx].name} z deklaracją ${newState.currentBid} pkt! Pokazanie musika.`;
    } else {
      // Następny licytujący
      let i = (state.activePlayerIndex + 1) % 3;
      while (!newState.activeLicitators[i]) {
        i = (i + 1) % 3;
      }
      newState.activePlayerIndex = i;
    }
    return newState;
  }

  // 2. FAZA MUSIK PREZENTACJI (Gdy bot wygrał)
  if (state.phase === 'musik_view') {
    // Bot zabiera musik do ręki
    const currentHand = [...activePlayer.hand, ...state.musik];
    newState.players = state.players.map((p, idx) => {
      if (idx === state.highestBidderIndex) {
        return { ...p, hand: currentHand };
      }
      return p;
    });
    newState.musik = [];
    newState.phase = 'musik_distribute';
    newState.statusMessage = `${activePlayer.name} bierze musik. Rozpoczyna rozdawanie po 1 karcie przeciwnikom.`;
    return newState;
  }

  // 3. FAZA ROZDAWANIA KART Z MUSIKA (Bot automatycznie oddaje 2 najgorsze karty swoim oponentom)
  if (state.phase === 'musik_distribute') {
    let currentHand = [...activePlayer.hand];
    
    // Sortuj od najsłabszej (9, J...)
    currentHand.sort((a, b) => TYSIAC_CARD_VALUES[a.value] - TYSIAC_CARD_VALUES[b.value]);
    
    // Oddaj oddzielnie graczowi 1 i graczowi 2
    const firstGive = currentHand.shift()!;
    const secondGive = currentHand.shift()!;

    const oppIndices = [0, 1, 2].filter(idx => idx !== state.highestBidderIndex);
    
    newState.players = state.players.map((p, idx) => {
      if (idx === state.highestBidderIndex) {
        return { ...p, hand: currentHand };
      }
      if (idx === oppIndices[0]) {
        return { ...p, hand: [...p.hand, firstGive] };
      }
      if (idx === oppIndices[1]) {
        return { ...p, hand: [...p.hand, secondGive] };
      }
      return p;
    });

    newState.phase = 'rozgrywka';
    newState.activePlayerIndex = state.highestBidderIndex; // Rozpoczyna zwycięzca licytacji
    newState.startingTrickPlayerIndex = state.highestBidderIndex;
    newState.statusMessage = `${activePlayer.name} rozdał karty z musika. Zaczyna rozgrywkę lew!`;
    return newState;
  }

  // 4. ROZGRYWKA LEW - Bot wyrzuca kartę
  if (state.phase === 'rozgrywka') {
    const currentHand = [...activePlayer.hand];
    
    // Filtruj karty na poprawne w tej lewie
    const playable = currentHand.filter(c => 
      canPlayTysiacCard(c, currentHand, state.trickCards, state.trumpSuit)
    );

    let cardToPlay = playable[0] || currentHand[0];

    // Logika bota: jeśli jest pierwszy w lewie i ma marjaż, melduje go!
    if (state.trickCards.length === 0) {
      const marSizes = checkMarriages(currentHand);
      if (marSizes.length > 0) {
        // Melduj najlepszy marjaż!
        const bestSuit = marSizes[0];
        const meldCard = currentHand.find(c => c.suit === bestSuit && (c.value === 'Q' || c.value === 'K'))!;
        cardToPlay = meldCard;

        newState.trumpSuit = bestSuit;
        newState.declaredMarriages.push({ playerId: activePlayer.id, suit: bestSuit });
        newState.roundPoints[activePlayer.id] += TYSIAC_MARRIAGE_VALUES[bestSuit];
        newState.statusMessage = `📣 ${activePlayer.name} melduje Marjaż ${SUIT_NAMES[bestSuit]} (${TYSIAC_MARRIAGE_VALUES[bestSuit]} pkt)! Nowa kozera: ${SUIT_NAMES[bestSuit]}.`;
      }
    }

    // Wyłóż wybraną kartę
    newState.players = state.players.map((p, idx) => {
      if (idx === state.activePlayerIndex) {
        return { ...p, hand: currentHand.filter(c => c.id !== cardToPlay.id) };
      }
      return p;
    });

    newState.trickCards.push({ playerId: activePlayer.id, card: cardToPlay });

    // Następny gracz w lewie lub podsumowanie lewy
    if (newState.trickCards.length === 3) {
      // Lewa zebrana! Obliczamy zwycięzcę
      const winnerIdx = getTrickWinnerIndex(newState.trickCards, newState.trumpSuit, newState.players);
      const winner = newState.players[winnerIdx];
      
      // Dodaj punkty z lewy do roundPoints
      const trickSum = newState.trickCards.reduce((sum, tc) => sum + TYSIAC_CARD_VALUES[tc.card.value], 0);
      newState.roundPoints[winner.id] += trickSum;

      newState.activePlayerIndex = winnerIdx;
      newState.startingTrickPlayerIndex = winnerIdx;
      newState.trickCards = []; // Czyścimy stół
      newState.roundTricksCount += 1;

      newState.statusMessage = `Lewę zgarnia ${winner.name} (${trickSum} pkt).`;

      // Sprawdź koniec rundy (8 lew)
      if (newState.roundTricksCount === 8) {
        newState.phase = 'round_score';
        newState.statusMessage = 'Runda skończona! Podliczanie wyników...';
        
        // Funkcja do zsumowania w App.tsx
      }
    } else {
      newState.activePlayerIndex = (state.activePlayerIndex + 1) % 3;
    }

    return newState;
  }

  return newState;
}
