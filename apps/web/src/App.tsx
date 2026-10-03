import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, PlayerAction, RoomSnapshot, ServerToClientEvents } from "../../../shared/protocol";
import { calculateLoanAmount } from "../../../shared/loans";

type PokerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin);
const money = (amount: number) => new Intl.NumberFormat("en-US").format(amount);

function PlayingCard({ card, faceDown = false, small = false }: { card?: string; faceDown?: boolean; small?: boolean }) {
  if (faceDown || !card) return <div className={`playing-card card-back ${small ? "small" : ""}`} aria-label="Face down card"><span>✦</span></div>;
  const suit = card.slice(-1);
  const red = suit === "♥" || suit === "♦";
  return <div className={`playing-card ${red ? "red" : ""} ${small ? "small" : ""}`} aria-label={card}><b>{card.slice(0, -1)}</b><span style={{ fontFamily: '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols", sans-serif' }}>{suit}</span></div>;
}

function App() {
  const [socket, setSocket] = useState<PokerSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [name, setName] = useState(() => localStorage.getItem("river-name") || "");
  const [roomCode, setRoomCode] = useState(() => new URLSearchParams(window.location.search).get("room")?.toUpperCase() || "");
  const [error, setError] = useState("");
  const [raiseTo, setRaiseTo] = useState(40);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const client: PokerSocket = io(SERVER_URL, { transports: ["websocket", "polling"] });
    setSocket(client);
    client.on("connect", () => { setConnected(true); setError(""); });
    client.on("disconnect", () => setConnected(false));
    client.on("state", (next) => setSnapshot(next));
    client.on("errorMessage", (message) => setError(message));
    client.on("connect_error", () => setError("Can't reach the poker table server. Start the app with npm run dev."));
    return () => { client.disconnect(); };
  }, []);

  useEffect(() => {
    if (snapshot) setRaiseTo(Math.max(snapshot.currentBet + snapshot.minRaise, snapshot.bigBlind * 2));
  }, [snapshot?.currentBet, snapshot?.minRaise, snapshot?.handNumber]);

  const me = snapshot?.players.find((player) => player.id === snapshot.you?.id);
  const isMyTurn = Boolean(me?.isTurn);
  const callAmount = me && snapshot ? Math.max(0, snapshot.currentBet - me.bet) : 0;
  const minRaiseTo = snapshot ? snapshot.currentBet + snapshot.minRaise : 40;
  const maxRaiseTo = me ? me.bet + Math.max(me.chips, 0) : minRaiseTo;
  const canRaise = Boolean(me && snapshot && maxRaiseTo > snapshot.currentBet && maxRaiseTo >= minRaiseTo);
  const playersAtTable = useMemo(() => snapshot?.players ?? [], [snapshot?.players]);

  function rememberName() {
    const value = name.trim().slice(0, 18) || "Player";
    setName(value);
    localStorage.setItem("river-name", value);
    return value;
  }
  function createRoom() {
    if (!socket || !connected) { setError("Connecting to the table server…"); return; }
    setError("");
    socket.emit("room:create", { name: rememberName() }, (id) => setRoomCode(id));
  }
  function joinRoom() {
    if (!socket || !connected) { setError("Connecting to the table server…"); return; }
    const requested = roomCode.trim().toUpperCase();
    if (!requested) { setError("Enter a room code first."); return; }
    setError("");
    socket.emit("room:join", { roomId: requested, name: rememberName() }, (result) => {
      if ("error" in result) setError(result.error);
      else setRoomCode(result.roomId);
    });
  }
  function act(action: PlayerAction, amount?: number) {
    socket?.emit("game:action", { action, amount });
    setError("");
  }
  function takeLoan() {
    if (!socket || !connected) return;
    socket.emit("game:loan");
    setError("");
  }
  async function copyInvite() {
    if (!snapshot) return;
    try {
      const invite = new URL(window.location.href);
      invite.searchParams.set("room", snapshot.roomId);
      await navigator.clipboard.writeText(invite.toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  if (!snapshot) return (
    <main className="lobby-shell">
      <header className="brand-row"><a className="brand" href="#"><span className="brand-mark">R</span><span>river<span className="brand-light">room</span></span></a><span className={`connection-pill ${connected ? "online" : ""}`}><i />{connected ? "TABLES ONLINE" : "CONNECTING"}</span></header>
      <section className="lobby-content">
        <div className="lobby-copy"><p className="eyebrow"><span className="eyebrow-line" /> A seat is waiting</p><h1>Good cards.<br /><em>Better company.</em></h1><p className="lobby-description">Your private poker night, wherever your people are. No stakes, no fuss — just one more hand.</p>
          <div className="lobby-perks"><span><b>♧</b> Play-money only</span><span><b>⌁</b> Up to 6 at the table</span></div>
        </div>
        <div className="lobby-card"><div className="card-topline"><span>TAKE YOUR SEAT</span><span className="tiny-diamond">◆</span></div><label className="input-label" htmlFor="player-name">YOUR NAME</label><input id="player-name" className="text-input" maxLength={18} placeholder="What should we call you?" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") createRoom(); }} />
          <button className="primary-button" onClick={createRoom} disabled={!connected}><span>Create a table</span><b>↗</b></button>
          <div className="divider"><span /> OR JOIN YOUR FRIENDS <span /></div>
          <div className="join-row"><input className="text-input room-input" aria-label="Room code" maxLength={6} placeholder="ROOM CODE" value={roomCode} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} onKeyDown={(event) => { if (event.key === "Enter") joinRoom(); }} /><button className="join-button" onClick={joinRoom} disabled={!connected}>Join table <span>→</span></button></div>
          {error && <p className="error-message">{error}</p>}
          <p className="lobby-footnote"><span>♧</span> A friendly game. Chips have no cash value.</p>
        </div>
      </section>
      <footer className="lobby-footer"><span>RIVER ROOM <b>·</b> BUILT FOR YOUR INNER CIRCLE</span><span>TEXAS HOLD’EM <b>·</b> 2–6 PLAYERS</span></footer>
    </main>
  );

  const activePlayers = playersAtTable.filter((player) => !player.folded);
  return (
    <main className="game-shell">
      <header className="table-header"><a className="brand" href="#"><span className="brand-mark">R</span><span>river<span className="brand-light">room</span></span></a><div className="table-meta"><div className="room-badge"><span className="live-dot" /> PRIVATE TABLE <b>/</b> {snapshot.roomId}</div><button className="invite-button" onClick={copyInvite}>{copied ? "Copied! ✓" : "＋ Invite friends"}</button></div><button className="icon-button" title="Return to lobby" onClick={() => { socket?.disconnect(); window.location.reload(); }}>↗</button></header>
      <section className="game-content">
        <div className="game-title-row"><div><p className="eyebrow"><span className="eyebrow-line" /> HAND {String(snapshot.handNumber).padStart(2, "0")}</p><h1>Friday night <em>table.</em></h1></div><div className="blinds"><span>BLINDS</span><b>{snapshot.smallBlind} <i>/</i> {snapshot.bigBlind}</b></div></div>
        {error && <div className="toast" role="status">{error}<button onClick={() => setError("")}>×</button></div>}
        <div className="table-wrap">
          <div className="felt-table">
            <div className="felt-inner" />
            <div className="table-topline"><span><i className="live-dot" /> FRIENDS ONLY</span><span>NO LIMIT · HOLD’EM</span></div>
            <div className="pot-display"><span className="pot-icon">◆</span><span className="pot-label">TOTAL POT</span><strong>{money(snapshot.pot)}</strong><small>PLAY CHIPS</small></div>
            <div className="community-row" aria-label={`${snapshot.communityCards.length} community cards`}>
              {Array.from({ length: 5 }, (_, index) => <PlayingCard key={index} card={snapshot.communityCards[index]} small />)}
            </div>
            <div className="street-label">{snapshot.street === "waiting" || snapshot.street === "showdown" ? "✦" : snapshot.street.toUpperCase()}</div>
            {playersAtTable.map((player) => {
              const angle = (player.seat / 6) * Math.PI * 2 - Math.PI / 2;
              const left = 50 + Math.cos(angle) * 47;
              const top = 50 + Math.sin(angle) * 46;
              const isWinner = snapshot.winnerIds.includes(player.id);
              return <div key={player.id} className={`player-seat ${player.isTurn ? "on-turn" : ""} ${player.id === me?.id ? "my-seat" : ""} ${player.folded ? "folded" : ""} ${isWinner ? "winner" : ""}`} style={{ left: `${left}%`, top: `${top}%` }}>
                <div className="seat-cards">{player.cards.length ? player.cards.map((card, index) => <div className="seat-card-slot" key={index}><PlayingCard card={card} small /></div>) : snapshot.street !== "waiting" && snapshot.street !== "showdown" && !player.folded ? <><div className="seat-card-slot"><PlayingCard faceDown small /></div><div className="seat-card-slot"><PlayingCard faceDown small /></div></> : null}</div>
                <div className="avatar-wrap"><div className="avatar">{player.name.slice(0, 1).toUpperCase()}</div>{player.isDealer && <span className="dealer-chip">D</span>}{player.allIn && <span style={{ position: "absolute", left: "calc(100% + 7px)", top: "50%", transform: "translateY(-50%)", padding: "2px 5px", border: "1px solid #d4c67d80", borderRadius: 999, background: "#181a11e8", color: "#d4c67d", font: "9px monospace", whiteSpace: "nowrap" }}>ALL IN</span>}</div>
                <div className="player-name">{player.name}{player.id === me?.id && <span className="you-tag">YOU</span>}</div>
                <div className="player-stack-row">
                  <div className="player-stack">{money(player.chips)} <span>CHIPS</span></div>
                  {player.debt > 0 && <div className="player-debt" style={{ display: "inline-block", marginTop: 2, padding: "2px 5px", border: "1px solid #d4c67d80", borderRadius: 999, background: "#181a11b8", color: "#d4c67d", font: "10px monospace", whiteSpace: "nowrap" }}>DEBT {money(player.debt)}</div>}
                </div>
                {!player.connected && <div className="player-status">RECONNECTING</div>}
                {player.folded && snapshot.street !== "waiting" && <div className="player-status">FOLDED</div>}
                {player.bet > 0 && <div className="bet-chip">{money(player.bet)}</div>}
                {player.isTurn && <div className="turn-tag">YOUR TURN</div>}
                {isWinner && <div className="winner-tag">WINNER</div>}
              </div>;
            })}
            <div className="table-message">{snapshot.message}</div>
          </div>
        </div>
        <div className="controls-row">
          <div className="action-hint"><span className="hint-icon">♧</span><span><b>{isMyTurn ? "Your move" : snapshot.street === "waiting" ? "Make it a full table" : snapshot.street === "showdown" ? "Hand complete" : "You're up next"}</b><small>{isMyTurn ? `Call ${money(callAmount)} or make it yours.` : snapshot.street === "waiting" ? `${playersAtTable.length} ${playersAtTable.length === 1 ? "player" : "players"} seated · share your room code.` : snapshot.street === "showdown" ? "Ready when you are for another hand." : "Watch the table — your turn is coming."}</small></span></div>
          {(snapshot.street === "waiting" || snapshot.street === "showdown") ? <button className="primary-button start-button" onClick={() => socket?.emit("game:start")} disabled={playersAtTable.filter((player) => player.connected).length < 2}><span>{snapshot.street === "waiting" ? "Deal the cards" : "Play another hand"}</span><b>↗</b></button> : <div className={`action-buttons ${isMyTurn ? "enabled" : ""}`}>
            <button className="action-button fold-button" disabled={!isMyTurn} onClick={() => act("fold")}>Fold</button>
            <button className="action-button" disabled={!isMyTurn} onClick={() => act(callAmount === 0 ? "check" : "call")}>{callAmount === 0 ? "Check" : `Call ${money(callAmount)}`}</button>
            <div className="raise-control"><label htmlFor="raise-slider">RAISE TO <b>{money(raiseTo)}</b></label><input id="raise-slider" type="range" min={Math.max(minRaiseTo, snapshot.bigBlind)} max={Math.max(minRaiseTo, maxRaiseTo)} step={snapshot.bigBlind} value={Math.min(raiseTo, Math.max(minRaiseTo, maxRaiseTo))} onChange={(event) => setRaiseTo(Number(event.target.value))} disabled={!isMyTurn || !canRaise} /><button className="raise-button" disabled={!isMyTurn || !canRaise} onClick={() => act("raise", raiseTo)}>Raise <span>↗</span></button></div>
          </div>}
        </div>
        <aside className="info-panel">
          <div className="panel-header">Table depth</div>
          <div className="stat-grid">
            <div><strong>{playersAtTable.filter((player) => player.connected).length}</strong><span>at table</span></div>
            <div><strong>{snapshot.communityCards.filter(Boolean).length}</strong><span>board cards</span></div>
            <div><strong>{money(snapshot.pot)}</strong><span>pot value</span></div>
            <div><strong>{money(me?.debt ?? 0)}</strong><span>your debt</span></div>
          </div>
          <ul className="feed-list">
            {snapshot.log.map((entry, index) => (
              <li key={`${entry.player}-${entry.text}-${index}`} className={`feed-item ${entry.tone}`}>
                <span>{entry.player}</span>
                <p>{entry.text}</p>
              </li>
            ))}
          </ul>
          {me && me.debt > 0 && (
            <button className="primary-button start-button loan-button" onClick={takeLoan}>
              <span>Take {money(calculateLoanAmount(me.debt))} chip loan</span><b>+</b>
            </button>
          )}
        </aside>
        <div className="table-caption"><span>{playersAtTable.length}/6 SEATS <b>·</b> {activePlayers.length} IN HAND</span><span>PLAY-MONEY TABLE <b>·</b> NO CASH VALUE</span></div>
      </section>
    </main>
  );
}

export default App;
