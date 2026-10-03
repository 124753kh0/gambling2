import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSidePots, collectStreetBets } from "./pot.js";

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
  assert.deepEqual(buildSidePots([
    { id: "short-stack", amount: 100, folded: false },
    { id: "folded", amount: 250, folded: true },
    { id: "deep-stack", amount: 500, folded: false },
  ]), [
    { amount: 300, eligibleIds: ["short-stack", "deep-stack"] },
    { amount: 300, eligibleIds: ["deep-stack"] },
    { amount: 250, eligibleIds: ["deep-stack"] },
  ]);
});
