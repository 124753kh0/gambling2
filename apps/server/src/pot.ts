export interface PotPlayer {
  bet: number;
}

export interface PotState {
  pot: number;
  players: PotPlayer[];
  currentBet: number;
}

export interface Contribution {
  id: string;
  amount: number;
  folded: boolean;
}

export interface SidePot {
  amount: number;
  eligibleIds: string[];
}

export function collectStreetBets(room: PotState): void {
  room.pot += room.players.reduce((total, player) => total + player.bet, 0);
  room.players.forEach((player) => { player.bet = 0; });
  room.currentBet = 0;
}

export function buildSidePots(contributions: Contribution[]): SidePot[] {
  const levels = [...new Set(contributions.map(({ amount }) => amount).filter((amount) => amount > 0))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  let previous = 0;

  for (const level of levels) {
    const participants = contributions.filter(({ amount }) => amount >= level);
    pots.push({
      amount: (level - previous) * participants.length,
      eligibleIds: participants.filter(({ folded }) => !folded).map(({ id }) => id),
    });
    previous = level;
  }

  return pots;
}
