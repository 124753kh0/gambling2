export const LOAN_BONUS = 250;

export function calculateLoanAmount(debt: number): number {
  if (!Number.isFinite(debt)) return 0;
  return Math.max(0, Math.round(debt)) + LOAN_BONUS;
}
