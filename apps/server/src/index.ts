import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import express from "express";
import { randomInt, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import type { ClientToServerEvents, PlayerAction, RoomSnapshot, ServerToClientEvents, Street } from "../../../shared/protocol.js";
import { compareHands, evaluateBestHand, type Card } from "./poker.js";

interface Player {
  id: string;
  name: string;
  seat: number;
  chips: number;
  bet: number;
  contributed: number;
  folded: boolean;
  connected: boolean;
  acted: boolean;
  cards: Card[];
}
interface Room {
  id: string;
  players: Player[];
  deck: Card[];
  community: Card[];
  pot: number;
  street: Street;
  currentBet: number;
  minRaise: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  dealerSeat: number;
  turnId: string | null;
  message: string;
  winnerIds: string[];
  smallBlindId: string | null;
  bigBlindId: string | null;
}

const rooms = new Map<string, Room>();
const suits = ["♣", "♦", "♥", "♠"];
const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const rankValues = new Map(ranks.map((rank, index) => [rank, index + 2]));
const port = Number(process.env.PORT ?? 3001);
const app = express();
const webDist = resolve(process.cwd(), "../../apps/web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (_request, response) => response.sendFile(resolve(webDist, "index.html")));
}
const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN?.split(",") ?? "*" },
});

function makeDeck(): Card[] {
  const deck = suits.flatMap((suit) => ranks.map((rank) => ({ rank: rankValues.get(rank)!, suit })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swap = randomInt(index + 1);
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}
function cardText(card: Card): string {
  const rank = ({ 11: "J", 12: "Q", 13: "K", 14: "A" } as Record<number, string>)[card.rank] ?? String(card.rank);
  return `${rank}${card.suit}`;
}
function roomFor(socketId: string): Room | undefined {
  const roomId = io.sockets.sockets.get(socketId)?.data.roomId as string | undefined;
  return roomId ? rooms.get(roomId) : undefined;
}
function announce(room: Room): void {
  for (const player of room.players) {
    const snapshot: RoomSnapshot = {
      roomId: room.id,
      players: room.players.map((seat) => ({
        id: seat.id, name: seat.name, seat: seat.seat, chips: seat.chips, bet: seat.bet,
        folded: seat.folded, connected: seat.connected,
        isDealer: seat.seat === room.dealerSeat && room.street !== "waiting",
        isSmallBlind: room.smallBlindId === seat.id && room.street !== "waiting",
        isBigBlind: room.bigBlindId === seat.id && room.street !== "waiting",
        isTurn: seat.id === room.turnId,
        cards: seat.id === player.id || (room.street === "showdown" && !seat.folded) ? seat.cards.map(cardText) : [],
      })),
      communityCards: room.community.map(cardText), pot: room.pot + room.players.reduce((sum, seat) => sum + seat.bet, 0),
      street: room.street, currentBet: room.currentBet, minRaise: room.minRaise,
      smallBlind: room.smallBlind, bigBlind: room.bigBlind, handNumber: room.handNumber,
      message: room.message, winnerIds: room.winnerIds,
      you: { id: player.id, name: player.name },
    };
    io.to(player.id).emit("state", snapshot);
  }
}
function cleanName(value: unknown): string {
  const name = typeof value === "string" ? value.trim().replace(/[<>]/g, "") : "";
  return (name || "Player").slice(0, 18);
}
function addPlayer(room: Room, id: string, name: string): boolean {
  if (room.players.length >= 6) return false;
  const seat = [0, 1, 2, 3, 4, 5].find((number) => room.players.every((p) => p.seat !== number));
  if (seat === undefined) return false;
  room.players.push({ id, name, seat, chips: 1000, bet: 0, contributed: 0, folded: false, connected: true, acted: false, cards: [] });
  return true;
}
function newRoom(id: string, playerId: string, name: string): Room {
  const room: Room = {
    id, players: [], deck: [], community: [], pot: 0, street: "waiting", currentBet: 0,
    minRaise: 20, smallBlind: 10, bigBlind: 20, handNumber: 0, dealerSeat: -1,
    turnId: null, message: "Waiting for another player to join.", winnerIds: [], smallBlindId: null, bigBlindId: null,
  };
  addPlayer(room, playerId, name);
  rooms.set(id, room);
  return room;
}
function nextPlayer(room: Room, fromSeat: number, predicate: (player: Player) => boolean): Player | undefined {
  for (let offset = 1; offset <= 6; offset += 1) {
    const seat = (fromSeat + offset + 6) % 6;
    const player = room.players.find((candidate) => candidate.seat === seat);
    if (player && predicate(player)) return player;
  }
  return undefined;
}
function postBlind(player: Player, amount: number): void {
  const paid = Math.min(player.chips, amount);
  player.chips -= paid;
  player.bet += paid;
  player.contributed += paid;
}
function deal(room: Room, player: Player): void {
  const card = room.deck.pop();
  if (card) player.cards.push(card);
}
function startHand(room: Room): void {
  if (room.players.filter((player) => player.connected && player.chips > 0).length < 2) {
    room.message = "Two players with chips are needed to start.";
    announce(room);
    return;
  }
  const eligible = room.players.filter((player) => player.connected && player.chips > 0).sort((a, b) => a.seat - b.seat);
  if (!eligible.some((player) => player.seat > room.dealerSeat)) room.dealerSeat = eligible[0].seat - 1;
  room.dealerSeat = nextPlayer(room, room.dealerSeat, (player) => eligible.includes(player))?.seat ?? eligible[0].seat;
  room.handNumber += 1;
  room.deck = makeDeck();
  room.community = [];
  room.pot = 0;
  room.currentBet = room.bigBlind;
  room.minRaise = room.bigBlind;
  room.winnerIds = [];
  room.players.forEach((player) => {
    player.bet = 0; player.contributed = 0; player.folded = !player.connected || player.chips <= 0;
    player.acted = false; player.cards = [];
  });
  eligible.forEach((player) => { deal(room, player); deal(room, player); });
  const dealer = room.players.find((player) => player.seat === room.dealerSeat)!;
  const smallBlind = eligible.length === 2 ? dealer : nextPlayer(room, room.dealerSeat, (player) => eligible.includes(player))!;
  const bigBlind = nextPlayer(room, smallBlind.seat, (player) => eligible.includes(player))!;
  room.smallBlindId = smallBlind.id;
  room.bigBlindId = bigBlind.id;
  postBlind(smallBlind, room.smallBlind);
  postBlind(bigBlind, room.bigBlind);
  room.currentBet = Math.max(...eligible.map((player) => player.bet));
  room.street = "preflop";
  room.turnId = nextPlayer(room, bigBlind.seat, (player) => !player.folded && player.chips > 0)?.id ?? null;
  room.message = `Hand ${room.handNumber} · ${smallBlind.name} posts ${room.smallBlind}, ${bigBlind.name} posts ${room.bigBlind}.`;
  continueIfReady(room);
}
function payStreet(room: Room): void {
  room.pot += room.players.reduce((sum, player) => sum + player.bet, 0);
  room.players.forEach((player) => { player.bet = 0; });
  room.currentBet = 0;
}
function awardUncontested(room: Room, winner: Player): void {
  payStreet(room);
  winner.chips += room.pot;
  room.message = `${winner.name} takes the pot — everyone else folded.`;
  room.winnerIds = [winner.id];
  finishHand(room);
}
function awardShowdown(room: Room): void {
  payStreet(room);
  const contributors = room.players.filter((player) => player.contributed > 0);
  const levels = [...new Set(contributors.map((player) => player.contributed))].sort((a, b) => a - b);
  let previous = 0;
  const winners = new Set<string>();
  const payouts = new Map<string, number>();
  for (const level of levels) {
    const participants = contributors.filter((player) => player.contributed >= level);
    const sidePot = (level - previous) * participants.length;
    previous = level;
    const contenders = participants.filter((player) => !player.folded);
    const scored = contenders.map((player) => ({ player, score: evaluateBestHand([...player.cards, ...room.community]) }));
    const best = scored.reduce((top, entry) => compareHands(entry.score, top) > 0 ? entry.score : top, scored[0].score);
    const roundWinners = scored.filter((entry) => compareHands(entry.score, best) === 0).map((entry) => entry.player);
    const share = Math.floor(sidePot / roundWinners.length);
    roundWinners.forEach((player) => { payouts.set(player.id, (payouts.get(player.id) ?? 0) + share); winners.add(player.id); });
    let remainder = sidePot - share * roundWinners.length;
    for (const player of roundWinners) { if (remainder-- <= 0) break; payouts.set(player.id, (payouts.get(player.id) ?? 0) + 1); }
  }
  payouts.forEach((amount, id) => { const player = room.players.find((entry) => entry.id === id); if (player) player.chips += amount; });
  room.winnerIds = [...winners];
  const names = room.players.filter((player) => winners.has(player.id)).map((player) => player.name);
  room.message = `${names.join(" & ")} win${names.length === 1 ? "s" : ""} · ${evaluateBestHand([...room.players.find((p) => winners.has(p.id))!.cards, ...room.community]).label}`;
  finishHand(room);
}
function finishHand(room: Room): void {
  room.pot = 0;
  room.turnId = null;
  room.street = "showdown";
  announce(room);
}
function progressStreet(room: Room): void {
  if (room.street === "preflop") { room.deck.pop(); room.community.push(...room.deck.splice(-3)); room.street = "flop"; }
  else if (room.street === "flop" || room.street === "turn") { room.deck.pop(); room.community.push(room.deck.pop()!); room.street = room.community.length === 4 ? "turn" : "river"; }
  else { awardShowdown(room); return; }
  room.players.forEach((player) => { player.bet = 0; player.acted = player.folded || player.chips === 0; });
  room.currentBet = 0;
  room.minRaise = room.bigBlind;
  room.turnId = nextPlayer(room, room.dealerSeat, (player) => !player.folded && player.chips > 0)?.id ?? null;
  room.message = room.turnId ? `${room.street[0].toUpperCase()}${room.street.slice(1)} · action is live.` : `${room.street[0].toUpperCase()}${room.street.slice(1)} · all remaining players are all-in.`;
  continueIfReady(room);
}
function continueIfReady(room: Room): void {
  if (room.street === "waiting" || room.street === "showdown") { announce(room); return; }
  const alive = room.players.filter((player) => !player.folded);
  if (alive.length === 1) { awardUncontested(room, alive[0]); return; }
  const canAct = alive.filter((player) => player.chips > 0);
  if (canAct.length === 0 || (canAct.every((player) => player.acted && player.bet === room.currentBet))) {
    if (room.street === "river") awardShowdown(room);
    else progressStreet(room);
    return;
  }
  if (!room.turnId || !canAct.some((player) => player.id === room.turnId)) {
    const previousSeat = room.players.find((player) => player.id === room.turnId)?.seat ?? room.dealerSeat;
    room.turnId = nextPlayer(room, previousSeat, (player) => !player.folded && player.chips > 0 && (!player.acted || player.bet < room.currentBet))?.id ?? null;
  }
  announce(room);
}
function fail(socketId: string, message: string): void { io.to(socketId).emit("errorMessage", message); }

io.on("connection", (socket) => {
  socket.on("room:create", ({ name }, callback) => {
    const roomId = randomUUID().slice(0, 6).toUpperCase();
    const room = newRoom(roomId, socket.id, cleanName(name));
    socket.data.roomId = roomId;
    socket.join(roomId);
    callback(roomId);
    announce(room);
  });
  socket.on("room:join", ({ roomId, name }, callback) => {
    const room = rooms.get(String(roomId).trim().toUpperCase());
    if (!room) { callback({ error: "That room code was not found." }); return; }
    if (room.street !== "waiting" && room.street !== "showdown") { callback({ error: "A hand is underway. Join after this hand." }); return; }
    if (!addPlayer(room, socket.id, cleanName(name))) { callback({ error: "This table is full (6 seats)." }); return; }
    socket.data.roomId = room.id;
    socket.join(room.id);
    callback({ roomId: room.id });
    room.message = `${cleanName(name)} joined the table.`;
    announce(room);
  });
  socket.on("game:start", () => {
    const room = roomFor(socket.id);
    if (!room) return;
    if (room.street !== "waiting" && room.street !== "showdown") { fail(socket.id, "A hand is already in progress."); return; }
    startHand(room);
  });
  socket.on("game:action", ({ action, amount }) => {
    const room = roomFor(socket.id);
    if (!room || room.turnId !== socket.id || room.street === "waiting" || room.street === "showdown") { fail(socket.id, "It is not your turn."); return; }
    const player = room.players.find((entry) => entry.id === socket.id)!;
    if (!( ["fold", "check", "call", "raise"] as PlayerAction[]).includes(action)) { fail(socket.id, "Unknown action."); return; }
    if (action === "fold") { player.folded = true; player.acted = true; room.message = `${player.name} folds.`; }
    if (action === "check") {
      if (player.bet !== room.currentBet) { fail(socket.id, "You can only check when there is no bet to call."); return; }
      player.acted = true; room.message = `${player.name} checks.`;
    }
    if (action === "call") {
      const paid = Math.min(player.chips, Math.max(0, room.currentBet - player.bet));
      player.chips -= paid; player.bet += paid; player.contributed += paid; player.acted = true;
      room.message = `${player.name} ${paid === 0 ? "checks" : `calls ${paid}`}.`;
    }
    if (action === "raise") {
      const target = Number(amount);
      const maxBet = player.bet + player.chips;
      if (!Number.isFinite(target) || target <= room.currentBet || target > maxBet || (target - room.currentBet < room.minRaise && target !== maxBet)) {
        fail(socket.id, `Raise-to must be at least ${room.currentBet + room.minRaise} (or your all-in amount).`); return;
      }
      const increase = target - room.currentBet;
      const paid = target - player.bet;
      player.chips -= paid; player.bet = target; player.contributed += paid;
      room.minRaise = Math.max(room.bigBlind, increase); room.currentBet = target;
      room.players.forEach((other) => { if (!other.folded && other.id !== player.id && other.chips > 0) other.acted = false; });
      player.acted = true; room.message = `${player.name} raises to ${target}.`;
    }
    const previousSeat = player.seat;
    room.turnId = nextPlayer(room, previousSeat, (other) => !other.folded && other.chips > 0 && (!other.acted || other.bet < room.currentBet))?.id ?? null;
    continueIfReady(room);
  });
  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomId as string);
    const player = room?.players.find((entry) => entry.id === socket.id);
    if (!room || !player) return;
    player.connected = false;
    if (room.street !== "waiting" && room.street !== "showdown") {
      player.folded = true;
      player.acted = true;
      if (player.id === room.turnId) {
        room.turnId = nextPlayer(room, player.seat, (other) => !other.folded && other.chips > 0 && (!other.acted || other.bet < room.currentBet))?.id ?? null;
      }
      continueIfReady(room);
    } else announce(room);
    if (room.street === "waiting" && room.players.every((entry) => !entry.connected)) rooms.delete(room.id);
  });
});

httpServer.listen(port, "0.0.0.0", () => console.log(`River Room socket server listening on :${port}`));
