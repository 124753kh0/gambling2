export const LOAN_BONUS = 250;

export function canTakeLoan(chips: number): boolean {
  return Number.isFinite(chips) && chips <= 0;
}

export function calculateLoanAmount(chips: number): number {
  if (!canTakeLoan(chips)) return 0;
  return Math.ceil(-chips) + LOAN_BONUS;
}
