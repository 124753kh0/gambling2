import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateLoanAmount } from "../../../shared/loans.js";

test("loan offer adds 250 chips to outstanding debt", () => {
  assert.equal(calculateLoanAmount(0), 250);
  assert.equal(calculateLoanAmount(2000), 2250);
});

test("loan offer does not treat negative or invalid debt as an amount owed", () => {
  assert.equal(calculateLoanAmount(-500), 250);
  assert.equal(calculateLoanAmount(Number.NaN), 0);
});
