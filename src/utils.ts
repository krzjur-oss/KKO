import { Card, CardSuit, CardValue } from './types';

export const SUIT_SYMBOLS: Record<CardSuit, string> = {
  H: '♥', // Kier
  D: '♦', // Karo
  C: '♣', // Trefl
  S: '♠', // Pik
};

export const SUIT_NAMES: Record<CardSuit, string> = {
  H: 'Kier',
  D: 'Karo',
  C: 'Trefl',
  S: 'Pik',
};

export const SUIT_COLORS: Record<CardSuit, string> = {
  H: 'text-red-500',
  D: 'text-orange-500', // Beautiful distinctive look
  C: 'text-emerald-500', // Unique vibrant emerald instead of black
  S: 'text-blue-500', // Blue instead of default boring black for Spades! Or traditional red/black
};

export function createFullDeck(includeJokers = false): Card[] {
  const suits: CardSuit[] = ['H', 'D', 'C', 'S'];
  const values: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({
        id: `${suit}-${value}`,
        suit,
        value,
        label: value,
      });
    });
  });

  if (includeJokers) {
    deck.push({ id: 'joker-1', suit: 'H', value: 'JOKER', label: '★', isJoker: true });
    deck.push({ id: 'joker-2', suit: 'S', value: 'JOKER', label: '★', isJoker: true });
  }

  return deck;
}

export function createTysiacDeck(): Card[] {
  const suits: CardSuit[] = ['H', 'D', 'C', 'S']; // Kier, Karo, Trefl, Pik
  const values: CardValue[] = ['9', 'J', 'Q', 'K', '10', 'A']; // Tysiąc ordering is different! Card values: 9=0, J=2, Q=3, K=4, 10=10, A=11
  const deck: Card[] = [];

  suits.forEach((suit) => {
    values.forEach((value) => {
      deck.push({
        id: `tysiac-${suit}-${value}`,
        suit,
        value,
        label: value,
      });
    });
  });

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

// Punktacja dla Tysiąca
export const TYSIAC_CARD_VALUES: Record<CardValue, number> = {
  '9': 0,
  'J': 2,
  'Q': 3,
  'K': 4,
  '10': 10,
  'A': 11,
  '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 0, 'JOKER': 0,
};

// Punktacja meldunków (Trójże / Marjaż)
export const TYSIAC_MARRIAGE_VALUES: Record<CardSuit, number> = {
  H: 100, // Kier ♥
  D: 80,  // Karo ♦
  C: 60,  // Trefl ♣
  S: 40,  // Pik ♠
};

// Punktacja kart dla Remika przy podliczaniu rąk
export function getRummyCardValue(card: Card): number {
  if (card.isJoker) return 20;
  if (card.value === 'A') return 11;
  if (['K', 'Q', 'J', '10'].includes(card.value)) return 10;
  return parseInt(card.value as string) || 0;
}
