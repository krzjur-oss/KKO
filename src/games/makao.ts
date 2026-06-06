import { Card, Player, CardSuit } from '../types';
import { createFullDeck, shuffleDeck } from '../utils';

export interface MakaoState {
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  activePlayerIndex: number;
  winnerId: string | null;
  roundNumber: number;
  
  // Stan kart specjalnych
  drawStack: number; // Suma kart do dobrania z "2", "3", Królów
  skipStack: number; // Liczba tur do czekania z "4"
  demandedValue: string | null; // Żądanie wartości z Waleta (J)
  demandedSuit: CardSuit | null; // Żądanie koloru z Asa (A)
  demandOrbitLeft: number; // Liczba graczy, który muszą spełnić żądanie Waleta zanim wygaśnie
  
  statusMessage: string;
}

export function initMakaoGame(playerNames: string[], humanCount = 1): MakaoState {
  let deck = shuffleDeck(createFullDeck(false)); // Makao standardowo bez Jokerów

  const players: Player[] = playerNames.map((name, index) => {
    const isBot = index >= humanCount;
    const hand: Card[] = [];
    const cardCount = 5; // Standardowo w Makao rozdaje się po 5 kart
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

  // Pierwsza karta na stosie odrzuconych (nie może być specjalna na start!)
  const discardPile: Card[] = [];
  let topCard = deck.pop();
  while (topCard && ['2', '3', '4', 'J', 'Q', 'K', 'A'].includes(topCard.value)) {
    deck.unshift(topCard); // Wsadź spowrotem na spód tali i potasuj
    deck = shuffleDeck(deck);
    topCard = deck.pop();
  }
  
  if (topCard) discardPile.push(topCard);

  return {
    players,
    deck,
    discardPile,
    activePlayerIndex: 0,
    winnerId: null,
    roundNumber: 1,
    drawStack: 0,
    skipStack: 0,
    demandedValue: null,
    demandedSuit: null,
    demandOrbitLeft: 0,
    statusMessage: 'Gra Makao rozpoczęta! Twój ruch.',
  };
}

// Sprawdzenie czy karta pasuje do zagrania
export function canPlayCard(
  card: Card,
  topCard: Card,
  drawStack: number,
  skipStack: number,
  demandedValue: string | null,
  demandedSuit: CardSuit | null
): boolean {
  // Jeśli na stosie leży żądanie wartości z Waleta
  if (demandedValue && card.value !== demandedValue && card.value !== 'J') {
    return false;
  }

  // Jeśli na stosie leży żądanie koloru z Asa
  if (demandedSuit && card.suit !== demandedSuit && card.value !== 'A') {
    return false;
  }

  // Zagranie obronne podczas aktywnego dobierania (stos 2, 3 lub Królestwa)
  if (drawStack > 0) {
    // Można położyć inną bitewną kartę o odpowiedniej wartości/kolorze
    if (['2', '3'].includes(topCard.value)) {
      return card.value === '2' || card.value === '3' || (card.value === 'K' && (card.suit === 'H' || card.suit === 'S'));
    }
    if (topCard.value === 'K') {
      return card.value === 'K' && (card.suit === 'H' || card.suit === 'S');
    }
  }

  // Zagranie obronne przed czekaniem (stos 4)
  if (skipStack > 0) {
    return card.value === '4';
  }

  // Standardowa zgodność: kolor lub wartość
  if (card.value === 'A') return true; // Asa można położyć na wszystko
  if (card.value === 'J') return true; // Waleta można położyć na wszystko nienakładane

  return card.suit === topCard.suit || card.value === topCard.value;
}

// Bot Makao podejmuje ruch
export function playMakaoBotTurn(state: MakaoState): MakaoState {
  const activePlayer = state.players[state.activePlayerIndex];
  if (!activePlayer.isBot || state.winnerId !== null) return state;

  const newState = { ...state };
  const topCard = state.discardPile[state.discardPile.length - 1];
  let currentHand = [...activePlayer.hand];

  // Zmniejszamy orbitę życzeń waleta
  if (newState.demandedValue && newState.demandOrbitLeft > 0) {
    newState.demandOrbitLeft--;
    if (newState.demandOrbitLeft === 0) {
      newState.demandedValue = null;
    }
  }

  // 1. Sprawdzenie czy bot musi przeczekać rundę (skipStack)
  if (newState.skipStack > 0) {
    // Sprawdź czy bot ma '4' do zablokowania lub dodania tury
    const hasFour = currentHand.find(c => c.value === '4');
    if (hasFour) {
      // Wyłóż '4'
      currentHand = currentHand.filter(c => c.id !== hasFour.id);
      newState.discardPile.push(hasFour);
      newState.skipStack += 1;
      newState.statusMessage = `${activePlayer.name} broni się kartą 4! Następny gracz czeka ${newState.skipStack} tur.`;
    } else {
      newState.skipStack--;
      newState.statusMessage = `${activePlayer.name} czeka tury (zostało ${newState.skipStack}).`;
      newState.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
      return newState;
    }
  }

  // 2. Szukanie pasującej karty w ręce bota
  const playableCards = currentHand.filter(c => 
    canPlayCard(c, topCard, newState.drawStack, newState.skipStack, newState.demandedValue, newState.demandedSuit)
  );

  if (playableCards.length > 0) {
    // Bot wybiera najlepszą kartę do zagrania
    // Priorytet dla kart bojowych przy ataku, albo pozbywanie się pasujących
    let cardToPlay = playableCards[0];
    
    // Preferuj pasowanie z zachowaniem kart bojowych na później, chyba że sam atakuje
    const combat = playableCards.find(c => ['2', '3', '4', 'K'].includes(c.value));
    if (newState.drawStack > 0 && combat) {
      cardToPlay = combat;
    } else {
      // Nie-bojowe jako pierwsze
      const normal = playableCards.find(c => !['2', '3', '4', 'K', 'J', 'A'].includes(c.value));
      if (normal) cardToPlay = normal;
    }

    // Wyłóż kartę
    currentHand = currentHand.filter(c => c.id !== cardToPlay.id);
    newState.discardPile.push(cardToPlay);

    // Wyczyszczenie życzeń koloru z asa, bo zagraliśmy pasującą kartę
    newState.demandedSuit = null;

    // Przetworzenie efektu specjalnego karty
    if (cardToPlay.value === '2') {
      newState.drawStack += 2;
      newState.statusMessage = `${activePlayer.name} kładzie 2! Kolejny gracz dobiera ${newState.drawStack} kart lub kładzie bitewną.`;
    } else if (cardToPlay.value === '3') {
      newState.drawStack += 3;
      newState.statusMessage = `${activePlayer.name} kładzie 3! Kolejny gracz dobiera ${newState.drawStack} kart lub kładzie bitewną.`;
    } else if (cardToPlay.value === '4') {
      newState.skipStack += 1;
      newState.statusMessage = `${activePlayer.name} kładzie 4! Kolejny gracz czeka tury lub kładzie 4.`;
    } else if (cardToPlay.value === 'J') {
      // Walet żąda wartości (losowa nieaktywna z popularnych)
      const values: string[] = ['5', '6', '7', '8', '9', '10'];
      const demand = values[Math.floor(Math.random() * values.length)];
      newState.demandedValue = demand;
      newState.demandOrbitLeft = state.players.length;
      newState.statusMessage = `${activePlayer.name} kładzie Waleta i żąda wartości: ${demand}!`;
    } else if (cardToPlay.value === 'A') {
      // As żąda koloru (najczęściej takiego, jaki bot ma najwięcej w dłoni)
      const suitCounts: Record<CardSuit, number> = { H: 0, D: 0, C: 0, S: 0 };
      currentHand.forEach(c => suitCounts[c.suit]++);
      let bestSuit: CardSuit = 'H';
      let maxCount = -1;
      (Object.keys(suitCounts) as CardSuit[]).forEach(s => {
        if (suitCounts[s] > maxCount) {
          maxCount = suitCounts[s];
          bestSuit = s;
        }
      });
      newState.demandedSuit = bestSuit;
      const polishSuits = { H: 'Kier ♥', D: 'Karo ♦', C: 'Trefl ♣', S: 'Pik ♠' };
      newState.statusMessage = `${activePlayer.name} kładzie Asa i żąda koloru: ${polishSuits[bestSuit]}!`;
    } else if (cardToPlay.value === 'K') {
      if (cardToPlay.suit === 'H') {
        // Król kier (atak do przodu - dobór 5)
        newState.drawStack += 5;
        newState.statusMessage = `${activePlayer.name} kładzie Króla Kier! Kolejny gracz dobiera ${newState.drawStack} kart lub się broni.`;
      } else if (cardToPlay.suit === 'S') {
        // Król Pik (atak wsteczny lub do przodu wg uproszczenia - dobiera kolejny 5)
        newState.drawStack += 5;
        newState.statusMessage = `${activePlayer.name} kładzie Króla Pik! Kolejny gracz dobiera ${newState.drawStack} kart lub się broni.`;
      } else {
        newState.statusMessage = `${activePlayer.name} kładzie zwykłego Króla.`;
      }
    } else {
      newState.statusMessage = `${activePlayer.name} kładzie ${cardToPlay.value} ${cardToPlay.suit}.`;
    }

  } else {
    // BRAK PASUJĄCEJ KARTY -> Dobór kart
    if (newState.drawStack > 0) {
      // Pobierz ze stogu tyle kart ile wynosi kara
      const targetCount = newState.drawStack;
      newState.statusMessage = `${activePlayer.name} nie ma obrony i dobiera karę: ${targetCount} kart!`;
      
      for (let i = 0; i < targetCount; i++) {
        const dCard = newState.deck.pop();
        if (dCard) currentHand.push(dCard);
      }
      newState.drawStack = 0; // Zerujemy karę
    } else {
      // Zwykłe dobranie 1 karty
      newState.statusMessage = `${activePlayer.name} dobiera kartę.`;
      const dCard = newState.deck.pop();
      if (dCard) {
        currentHand.push(dCard);
      }
    }
  }

  // Przetasowanie zużytych kart gdy skończy się talia dobierania
  if (newState.deck.length < 5) {
    if (newState.discardPile.length > 2) {
      const top = newState.discardPile.pop()!;
      newState.deck = shuffleDeck(newState.discardPile);
      newState.discardPile = [top];
    }
  }

  // Aktualizacja statusu Makao
  // Bot mówi "Makao" z 1 kartą w ręku
  activePlayer.declaredMakao = currentHand.length === 1;
  if (currentHand.length === 1) {
    newState.statusMessage += ` 📣 ${activePlayer.name} krzyczy: MAKAO!`;
  }

  // Zapisz dłoń bota
  newState.players = state.players.map((p, idx) => {
    if (idx === state.activePlayerIndex) {
      return { ...p, hand: currentHand, declaredMakao: activePlayer.declaredMakao };
    }
    return p;
  });

  // Czy bot wygrał?
  if (currentHand.length === 0) {
    newState.winnerId = activePlayer.id;
    newState.statusMessage = `🏆 ${activePlayer.name} wygrywa grę Makao! Gratulacje!`;
  } else {
    // Kolejka następnej osoby
    newState.activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  }

  return newState;
}
