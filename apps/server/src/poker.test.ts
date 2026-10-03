import { test } from "node:test";
import assert from "node:assert/strict";
import { compareHands, evaluateBestHand, type Card } from "./poker.js";

function cards(input: string): Card[] {
  const values: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };
  return input.split(" ").map((card) => ({ rank: values[card[0]] ?? Number(card[0]), suit: card[1] }));
}

test("recognizes a wheel straight flush", () => {
  assert.equal(evaluateBestHand(cards("As 2s 3s 4s 5s Kd Qc")).label, "Straight flush");
  assert.deepEqual(evaluateBestHand(cards("As 2s 3s 4s 5s Kd Qc")).kickers, [5]);
});

test("ranks full houses above flushes", () => {
  const fullHouse = evaluateBestHand(cards("Ah Ad Ac Ks Kd 2s 3c"));
  const flush = evaluateBestHand(cards("2h 5h 7h Jh Kh As Qd"));
  assert.equal(fullHouse.label, "Full house");
  assert.ok(compareHands(fullHouse, flush) > 0);
});

test("uses kickers to break ties", () => {
  const acesWithKing = evaluateBestHand(cards("As Ah Kd 8c 4s 2d 3c"));
  const acesWithQueen = evaluateBestHand(cards("Ad Ac Qd 8h 4d 2s 3h"));
  assert.ok(compareHands(acesWithKing, acesWithQueen) > 0);
});
