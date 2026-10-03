import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPotBreakdown, buildPotLayers, collectStreetBets } from "./pot.js";

test("street bets accumulate in the pot without disappearing between streets", () => {
  const room = {
    pot: 30,
    currentBet: 20,
    players: [{ bet: 20 }, { bet: 10 }],
  };

  collectStreetBets(room);

  assert.equal(room.pot, 60);
  assert.equal(room.currentBet, 0);
  assert.deepEqual(room.players.map((player) => player.bet), [0, 0]);

  room.players[0].bet = 40;
  room.players[1].bet = 40;
  room.currentBet = 40;
  collectStreetBets(room);

  assert.equal(room.pot, 140);
  assert.equal(room.currentBet, 0);
  assert.deepEqual(room.players.map((player) => player.bet), [0, 0]);
});

test("side pots include each contribution tier and exclude folded players from winning", () => {
  const { pots } = buildPotLayers([
    { id: "short-stack", amount: 100, folded: false, allIn: true },
    { id: "folded", amount: 250, folded: true, allIn: false },
    { id: "deep-stack", amount: 500, folded: false, allIn: false },
  ]);

  assert.deepEqual(pots, [
    { amount: 300, eligibleIds: ["short-stack", "deep-stack"] },
    { amount: 300, eligibleIds: ["deep-stack"] },
  ]);
  assert.equal(pots[0].amount + pots.slice(1).reduce((total, pot) => total + pot.amount, 0), 600);
  assert.deepEqual(buildPotLayers([
    { id: "short-stack", amount: 100, folded: false, allIn: true },
    { id: "folded", amount: 250, folded: true, allIn: false },
    { id: "deep-stack", amount: 500, folded: false, allIn: false },
  ]).uncalledReturns, [{ playerId: "deep-stack", amount: 250 }]);
});

test("returns an unmatched raise instead of awarding it as a side pot", () => {
  const result = buildPotLayers([
    { id: "short-stack", amount: 100, folded: false, allIn: true },
    { id: "deep-stack", amount: 500, folded: false, allIn: false },
  ]);

  assert.deepEqual(result, {
    pots: [{ amount: 200, eligibleIds: ["short-stack", "deep-stack"] }],
    uncalledReturns: [{ playerId: "deep-stack", amount: 400 }],
  });
  assert.deepEqual(buildPotBreakdown(600, [
    { id: "short-stack", amount: 100, folded: false, allIn: true },
    { id: "deep-stack", amount: 500, folded: false, allIn: false },
  ]), { mainPot: 200, sidePots: [] });
});

test("side pots are displayed when any player is all-in, not only the local player", () => {
  assert.deepEqual(buildPotBreakdown(1100, [
    { id: "all-in", amount: 100, folded: false, allIn: true },
    { id: "second", amount: 500, folded: false, allIn: false },
    { id: "third", amount: 500, folded: false, allIn: false },
  ]), { mainPot: 300, sidePots: [800] });
});

test("uneven contributions without an all-in stay in the main pot", () => {
  assert.deepEqual(buildPotBreakdown(0, [
    { id: "one", amount: 100, folded: false, allIn: true },
    { id: "two", amount: 500, folded: false, allIn: false },
  ]), { mainPot: 0, sidePots: [] });
  assert.deepEqual(buildPotBreakdown(600, [
    { id: "one", amount: 100, folded: false, allIn: false },
    { id: "two", amount: 500, folded: false, allIn: false },
  ]), { mainPot: 600, sidePots: [] });
});
