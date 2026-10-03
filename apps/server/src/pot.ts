export interface PotPlayer {
  bet: number;
}

export interface PotState {
  pot: number;
  players: PotPlayer[];
  currentBet: number;
}

export function collectStreetBets(room: PotState): void {
  room.pot += room.players.reduce((total, player) => total + player.bet, 0);
  room.players.forEach((player) => { player.bet = 0; });
  room.currentBet = 0;
}
