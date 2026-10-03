export type Street = "waiting" | "preflop" | "flop" | "turn" | "river" | "showdown";
export type PlayerAction = "fold" | "check" | "call" | "raise";

export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  chips: number;
  debt: number;
  bet: number;
  folded: boolean;
  connected: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isTurn: boolean;
  cards: string[];
}

export interface ActionFeedItem {
  player: string;
  text: string;
  tone: "neutral" | "good" | "bad";
}

export interface RoomSnapshot {
  roomId: string;
  players: PublicPlayer[];
  communityCards: string[];
  pot: number;
  street: Street;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  message: string;
  winnerIds: string[];
  log: ActionFeedItem[];
  you: { id: string; name: string } | null;
}

export interface ServerToClientEvents {
  state: (snapshot: RoomSnapshot) => void;
  errorMessage: (message: string) => void;
}

export interface ClientToServerEvents {
  "room:create": (payload: { name: string }, callback: (roomId: string) => void) => void;
  "room:join": (payload: { roomId: string; name: string }, callback: (result: { roomId: string } | { error: string }) => void) => void;
  "game:start": () => void;
  "game:loan": (payload: { amount: number }) => void;
  "game:action": (payload: { action: PlayerAction; amount?: number }) => void;
}
