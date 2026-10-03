export type Card = { rank: number; suit: string };
export type HandValue = { category: number; kickers: number[]; label: string };

const LABELS = ["High card", "One pair", "Two pair", "Three of a kind", "Straight", "Flush", "Full house", "Four of a kind", "Straight flush"];

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]];
  if (items.length < size) return [];
  const [first, ...rest] = items;
  return [
    ...combinations(rest, size - 1).map((tail) => [first, ...tail]),
    ...combinations(rest, size),
  ];
}

function evaluateFive(cards: Card[]): HandValue {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0].suit);
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  const straightHigh = unique.length === 5 && unique[0] - unique[4] === 4
    ? unique[0]
    : unique.join(",") === "14,5,4,3,2" ? 5 : 0;
  let category = 0;
  let kickers: number[] = ranks;

  if (flush && straightHigh) { category = 8; kickers = [straightHigh]; }
  else if (groups[0][1] === 4) { category = 7; kickers = [groups[0][0], groups[1][0]]; }
  else if (groups[0][1] === 3 && groups[1][1] === 2) { category = 6; kickers = [groups[0][0], groups[1][0]]; }
  else if (flush) { category = 5; kickers = ranks; }
  else if (straightHigh) { category = 4; kickers = [straightHigh]; }
  else if (groups[0][1] === 3) { category = 3; kickers = groups.map(([rank]) => rank); }
  else if (groups[0][1] === 2 && groups[1][1] === 2) {
    category = 2;
    kickers = [Math.max(groups[0][0], groups[1][0]), Math.min(groups[0][0], groups[1][0]), groups[2][0]];
  } else if (groups[0][1] === 2) { category = 1; kickers = groups.map(([rank]) => rank); }

  return { category, kickers, label: LABELS[category] };
}

export function evaluateBestHand(cards: Card[]): HandValue {
  if (cards.length < 5) throw new Error("A hand needs at least five cards");
  return combinations(cards, 5).map(evaluateFive).reduce((best, candidate) => compareHands(candidate, best) > 0 ? candidate : best);
}

export function compareHands(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let index = 0; index < Math.max(a.kickers.length, b.kickers.length); index += 1) {
    const difference = (a.kickers[index] ?? 0) - (b.kickers[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
