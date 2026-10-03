import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLoanAmount } from "../../../shared/loans.js";

test("loan offer covers the negative chip balance and adds 250 chips", () => {
  assert.equal(calculateLoanAmount(0), 250);
  assert.equal(calculateLoanAmount(-1000), 1250);
});

test("positive chip balances and invalid balances do not qualify for a loan", () => {
  assert.equal(calculateLoanAmount(200), 0);
  assert.equal(calculateLoanAmount(Number.NaN), 0);
});
