export const LOAN_BONUS = 250;

export function calculateLoanAmount(chips: number): number {
  if (!Number.isFinite(chips) || chips > 0) return 0;
  return Math.ceil(-chips) + LOAN_BONUS;
}
