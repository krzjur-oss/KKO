// Typy dla gier karcianych offline

export type GameType = 'remik' | 'makao' | 'tysiac';

export type CardSuit = 'H' | 'D' | 'C' | 'S'; // Hearts (Kier ♥), Diamonds (Karo ♦), Clubs (Trefl ♣), Spades (Pik ♠)

export type CardValue = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A' | 'JOKER';

export interface Card {
  id: string;
  suit: CardSuit;
  value: CardValue;
  label: string;
  isJoker?: boolean;
}

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isRemote: boolean;
  score: number;
  roundsScores: number[];
  hand: Card[];
  isDealer?: boolean;
  declaredMakao?: boolean;
}

// Historia meczów zapisywana lokalnie
export interface SavedGame {
  id: string;
  gameType: GameType;
  date: string;
  players: { name: string; score: number }[];
  roundsCount: number;
  completed: boolean;
}

// Logi z przebiegu rozgrywki
export interface GameLog {
  id: string;
  timestamp: string;
  message: string;
  playerName?: string;
  type: 'info' | 'action' | 'meld' | 'win' | 'alert';
}

// Typy komunikatów synchronizacji P2P
export type P2PMessageType = 
  | 'PING'
  | 'PONG'
  | 'SYNC_SCORES'
  | 'GAME_STATE_UPDATE'
  | 'PLAYER_ACTION'
  | 'CHAT';

export interface P2PMessage {
  type: P2PMessageType;
  senderId: string;
  senderName: string;
  payload: any;
  timestamp: number;
}
