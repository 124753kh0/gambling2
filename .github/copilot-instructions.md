# River Room Poker — project notes

- This is a play-money Texas Hold’em game; do not add real-money, payment, or wagering integrations.
- The server is authoritative for room membership, cards, chips, turns, and action validation.
- The web client is React + TypeScript + Vite; the realtime server is Node + Socket.IO.
- Run both apps with `npm run dev`; validate with `npm run build` and `npm test`.
