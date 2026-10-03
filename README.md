# River Room Poker

A play-money-only, real-time Texas Hold’em table. Each room is synchronized by a Node server over Socket.IO; open another browser tab or share the room invite link to play with friends. Players only need a browser—no downloads or installs. No account, payment, or real-money gambling features are included.

## Publish it for friends

The game needs one hosted server for online tables, but players do not install anything. The included `render.yaml` is a deployment blueprint: push this project to a Git repository, create a Blueprint service with your hosting provider, and select that repository. The host builds and runs the web client and realtime server together. Share the resulting public URL with players; room invites include the room code.

The deployment is not live yet: it must be connected to a hosting account and a Git repository once. Rooms live in server memory, so a server restart clears open tables.

## Run locally

1. Install Node.js 20 or newer.
2. From this folder, run `npm install`.
3. Run `npm run dev`.
4. Open the web URL printed by Vite (usually `http://localhost:5173`). The socket server listens on port `3001`.

To play across devices on your local network, use the host computer's LAN address and allow ports 5173 and 3001 through the firewall. The client automatically connects to port 3001 on the host serving the page; set `VITE_SERVER_URL` if your server is hosted elsewhere.

## Gameplay

Create a table or join one by room code. Players receive private hole cards; the server owns all chips, turns, and community cards. The game supports 2–6 seats, blinds, fold/check/call/raise, and showdown hand ranking. If you have outstanding debt, you can take a loan equal to your debt plus 250 chips, regardless of your current chip count (for example, 1,000 debt offers 1,250 chips). Chips are fictional and have no cash value.

## Scripts

- `npm run dev` — run web client and socket server together.
- `npm run build` — type-check/build both apps.
- `npm test` — run server-side hand evaluator tests.
