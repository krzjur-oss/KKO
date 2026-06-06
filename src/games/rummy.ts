import { Card, Player } from '../types';
import { createFullDeck, shuffleDeck, getRummyCardValue } from '../utils';

export interface RummyMeld {
  id: string;
  playerId: string;
  cards: Card[];
  type: 'group' | 'run';
}

export interface RummyState {
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  activePlayerIndex: number;
  phase: 'draw' | 'action' | 'discard';
  tableMelds: RummyMeld[];
  winnerId: string | null;
  roundNumber: number;
  meldMessage: string;
  firstMeldsByPlayer: Record<string, boolean>; // Czy gracz wyłożył już pierwsze meldunki (potrzebne min. 51 pkt)
}

export function initRummyGame(playerNames: string[], humanCount = 1): RummyState {
  let deck = shuffleDeck(createFullDeck(true)); // Include Jokers for Remik

  const players: Player[] = playerNames.map((name, index) => {
    const isBot = index >= humanCount;
    const hand: Card[] = [];
    // Rozdanie kart: Gracz rozdający dostaje 14 kart, reszta też 13 kart lub 14 kart dla rozpoczynającego.
    // Uprośćmy: Rozdajemy po 13 kart, a w pierwzej turze pierwszy gracz dobiera i odrzuca.
    const cardCount = 13;
    for (let c = 0; c < cardCount; c++) {
      const card = deck.pop();
      if (card) hand.push(card);
    }
    return {
      id: `player-${index}`,
      name,
      isBot,
      isRemote: false,
      score: 0,
      roundsScores: [],
      hand,
    };
  });

  // Dodaj jedną kartę pierwszemu graczowi (rozpoczyna z 14 kartami)
  const firstCard = deck.pop();
  if (firstCard) {
    players[0].hand.push(firstCard);
  }

  const discardPile: Card[] = [];
  const topCard = deck.pop();
  if (topCard) discardPile.push(topCard);

  return {
    players,
    deck,
    discardPile,
    activePlayerIndex: 0,
    phase: 'action', // Gracz 0 ma 14 kart, więc od razu faza akcji (może wyłożyć meldunek lub musi odrzucić)
    tableMelds: [],
    winnerId: null,
    roundNumber: 1,
    meldMessage: 'Gracz rozpoczynający ma 14 kart. Może wyłożyć meldunek lub odrzucić kartę.',
    firstMeldsByPlayer: {},
  };
}

// Sprawdzenie czy dany układ to "Grupa" (Czysty komplet) - 3 lub 4 karty tej samej wartości różnych kolorów
export function isValidGroup(cards: Card[]): boolean {
  if (cards.length < 3 || cards.length > 4) return false;

  const nonJokers = cards.filter(c => !c.isJoker);
  if (nonJokers.length === 0) return true; // same jokery - teoretycznie niemożliwe

  const value = nonJokers[0].value;
  const isSameValue = nonJokers.every(c => c.value === value);
  if (!isSameValue) return false;

  // Różne kolory
  const suits = nonJokers.map(c => c.suit);
  const uniqueSuits = new Set(suits);
  return uniqueSuits.size === nonJokers.length;
}

// Sprawdzenie wartości dla Sekwencji (Run)
const CARD_RANK: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function isValidRun(cards: Card[]): boolean {
  if (cards.length < 3) return false;
  
  // Znajdujemy kolor sekwencji
  const nonJokers = cards.filter(c => !c.isJoker);
  if (nonJokers.length === 0) return true;

  const suit = nonJokers[0].suit;
  const isAllSameSuit = nonJokers.every(c => c.suit === suit);
  if (!isAllSameSuit) return false;

  // Sekwencje z asami: A-2-3 lub Q-K-A
  // Przeanalizujmy pozycje bez Jokerów.
  // Uproszczona walidacja sekwencji z Jokerami:
  // Sortujemy rangi kart nie-jokerów
  const ranks = nonJokers.map(c => CARD_RANK[c.value]).sort((a, b) => a - b);
  
  // Czy są duplikaty w nie-jokerach?
  if (new Set(ranks).size !== ranks.length) return false;

  // Sprawdzamy standardową rosnącą sekwencję (np. 4, 5, JOKER, 7)
  let jokersLeft = cards.length - nonJokers.length;
  
  // Sprawdzamy przypadek specjalny As jako 1 (A-2-3)
  if (nonJokers.some(c => c.value === 'A') && nonJokers.some(c => c.value === '2')) {
    // Traktujemy As jako o randze 1
    const adjustedRanks = nonJokers.map(c => c.value === 'A' ? 1 : CARD_RANK[c.value]).sort((a, b) => a - b);
    let possible = true;
    let tempJokers = jokersLeft;
    for (let i = 0; i < adjustedRanks.length - 1; i++) {
      const diff = adjustedRanks[i+1] - adjustedRanks[i] - 1;
      if (diff < 0) return false;
      tempJokers -= diff;
    }
    if (tempJokers >= 0) return true;
  }

  // Standardowy test
  let tempJokers = jokersLeft;
  for (let i = 0; i < ranks.length - 1; i++) {
    const diff = ranks[i+1] - ranks[i] - 1;
    if (diff < 0) return false;
    tempJokers -= diff;
  }
  
  return tempJokers >= 0;
}

// Obliczanie punktów meldunku
export function calculateMeldPoints(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + getRummyCardValue(c), 0);
}

// Prosta sztuczna inteligencja bota dla Remika
export function playRummyBotTurn(state: RummyState): RummyState {
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.isBot || state.winnerId !== null) return state;

  const newState = { ...state };
  let currentHand = [...activePlayer.hand];

  // 1. FAZA DOBIERANIA
  // Inteligentna decyzja: czy brać z odrzuconych czy z zakrytych?
  // Jeśli odrzucona karta pasuje do jakiejś pary w ręce bota, bierzemy ją. Bezpiecznie bierzemy z decku.
  const topDiscard = state.discardPile[state.discardPile.length - 1];
  let drawnFromDiscard = false;

  if (topDiscard) {
    // Sprawdzenie czy ta karta pomaga stworzyć zestaw
    const testHand = [...currentHand, topDiscard];
    const hasPairs = currentHand.some(c => c.value === topDiscard.value || c.suit === topDiscard.suit);
    if (hasPairs && Math.random() > 0.4) {
      // Dobór ze stosu odrzuconych
      currentHand.push(topDiscard);
      newState.discardPile = state.discardPile.slice(0, -1);
      drawnFromDiscard = true;
    }
  }

  if (!drawnFromDiscard) {
    // Dobór z zakrytego decku
    const drawnCard = newState.deck.pop();
    if (drawnCard) {
      currentHand.push(drawnCard);
    } else {
      // Przetasuj stos odrzuconych jeśli deck się skończył
      if (newState.discardPile.length > 1) {
        const kept = newState.discardPile.pop()!;
        newState.deck = shuffleDeck(newState.discardPile);
        newState.discardPile = [kept];
        const secondChance = newState.deck.pop();
        if (secondChance) currentHand.push(secondChance);
      }
    }
  }

  newState.phase = 'action';
  
  // 2. FAZA AKCJI - próba wyłożenia meldunków przez bota
  // Bot szuka grup (3-4 te same wartości) lub sekwencji w swojej ręce
  const formedMelds: Card[][] = [];
  
  // Szukamy grup (tych samych wartości)
  const valueGroups: Record<string, Card[]> = {};
  currentHand.forEach(card => {
    if (!card.isJoker) {
      if (!valueGroups[card.value]) valueGroups[card.value] = [];
      valueGroups[card.value].push(card);
    }
  });

  const jokers = currentHand.filter(c => c.isJoker);

  Object.entries(valueGroups).forEach(([val, cards]) => {
    if (cards.length >= 3) {
      formedMelds.push(cards);
    } else if (cards.length === 2 && jokers.length > 0) {
      const groupWithJoker = [...cards, jokers.pop()!];
      formedMelds.push(groupWithJoker);
    }
  });

  // Czy bot może wyłożyć meldunek?
  // Pierwsze wyłożenie wymaga sumy co najmniej 51 pkt
  const hasAlreadyMelded = newState.firstMeldsByPlayer[activePlayer.id] || false;
  let totalPoints = formedMelds.reduce((sum, m) => sum + calculateMeldPoints(m), 0);

  if (formedMelds.length > 0 && (hasAlreadyMelded || totalPoints >= 51)) {
    formedMelds.forEach(meldCards => {
      // Usuń te karty z ręki bota
      const meldIdSet = new Set(meldCards.map(c => c.id));
      currentHand = currentHand.filter(c => !meldIdSet.has(c.id));

      const type = isValidRun(meldCards) ? 'run' : 'group';
      newState.tableMelds.push({
        id: `meld-${Date.now()}-${Math.random()}`,
        playerId: activePlayer.id,
        cards: meldCards,
        type,
      });
    });
    newState.firstMeldsByPlayer[activePlayer.id] = true;
    newState.meldMessage = `Bot ${activePlayer.name} wyłożył meldunki o wartości ${totalPoints} pkt!`;
  }

  // 3. FAZA ODRZUCENIA
  // Bot odrzuca najmniej przydatną kartę (np. taką o dużej wartości bez dopasowania)
  if (currentHand.length > 0) {
    // Znajdź pojedynczą kartę nie-joker która nie ma pary po wartości lub kolorze i ma najwyższą wartość
    let discardIndex = 0;
    let maxVal = -1;
    currentHand.forEach((c, idx) => {
      if (c.isJoker) return;
      const val = getRummyCardValue(c);
      if (val > maxVal) {
        maxVal = val;
        discardIndex = idx;
      }
    });

    const discarded = currentHand.splice(discardIndex, 1)[0];
    newState.discardPile.push(discarded);
  }

  // Zapisz zmienioną rękę
  newState.players = state.players.map((p, idx) => {
    if (idx === state.activePlayerIndex) {
      return { ...p, hand: currentHand };
    }
    return p;
  });

  // Sprawdzenie zwycięstwa
  if (currentHand.length === 0) {
    newState.winnerId = activePlayer.id;
    newState.phase = 'discard'; // end game
    newState.meldMessage = `${activePlayer.name} wygrywa rundę!`;
  } else {
    // Przekaż turę kolejnemu graczowi
    newState.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
    newState.phase = 'draw';
  }

  return newState;
}
