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
  allIn: boolean;
}

export interface SidePot {
  amount: number;
  eligibleIds: string[];
}

export interface PotBreakdown {
  mainPot: number;
  sidePots: number[];
}

export interface PotLayers {
  pots: SidePot[];
  uncalledReturns: { playerId: string; amount: number }[];
}

export function collectStreetBets(room: PotState): void {
  room.pot += room.players.reduce((total, player) => total + player.bet, 0);
  room.players.forEach((player) => { player.bet = 0; });
  room.currentBet = 0;
}

export function buildPotLayers(contributions: Contribution[]): PotLayers {
  const levels = [...new Set(contributions.map(({ amount }) => amount).filter((amount) => amount > 0))].sort((a, b) => a - b);
  const pots: SidePot[] = [];
  const uncalledReturns: PotLayers["uncalledReturns"] = [];
  let previous = 0;

  for (const level of levels) {
    const participants = contributions.filter(({ amount }) => amount >= level);
    const amount = (level - previous) * participants.length;
    if (participants.length === 1) {
      uncalledReturns.push({ playerId: participants[0].id, amount });
    } else {
      const eligibleIds = participants.filter(({ folded }) => !folded).map(({ id }) => id);
      if (eligibleIds.length > 0) {
        pots.push({ amount, eligibleIds });
      } else if (pots.length > 0) {
        pots[0].amount += amount;
      } else {
        throw new Error("A pot layer has no eligible players.");
      }
    }
    previous = level;
  }

  return { pots, uncalledReturns };
}

export function buildPotBreakdown(total: number, contributions: Contribution[]): PotBreakdown {
  if (total <= 0) return { mainPot: 0, sidePots: [] };
  if (!contributions.some(({ allIn, folded }) => allIn && !folded)) {
    return { mainPot: total, sidePots: [] };
  }

  const { pots, uncalledReturns } = buildPotLayers(contributions);
  const sidePots = pots.slice(1).map(({ amount }) => amount);
  const returned = uncalledReturns.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    mainPot: total - returned - sidePots.reduce((sum, amount) => sum + amount, 0),
    sidePots,
  };
}
