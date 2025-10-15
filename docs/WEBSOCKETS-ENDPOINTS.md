# WebSocket Endpoints and Protocols

This document clarifies the responsibilities and protocols of the system’s WebSocket endpoints.

## Control-Plane: `/ws`

- Purpose: authenticated messaging for agent/session control and status updates.
- Server: `server/websocket.ts` (`ws` library, manual HTTP upgrade handling).
- Messages:
  - Client → Server: `AUTHENTICATE`, `SUBSCRIBE`, `UNSUBSCRIBE`, `PING`.
  - Server → Client: `AUTHENTICATED`, `TASK_STATUS`, `TASK_PROGRESS`, `SESSION_STATUS`, `PONG`, etc.
- Auth: send `WSMessageType.AUTHENTICATE` with `sessionToken` (JWT) and `agentId` after connect.
- Clients:
  - Frontend: `socket.io-client` connects to `/ws/socket.io/` (Socket.IO transport).
  - Services: can connect directly to `/ws` using a standard WebSocket client (non-Socket.IO).

## Stream Relay: `/ws/stream/{sessionId}`

- Purpose: low-friction frame relay from Worker to frontend viewer.
- Server: `server/live-stream-relay.js` (noServer `WebSocketServer`, upgrade handled in production server).
- Protocol: accepts JSON frame messages and forwards them to subscribed frontend viewers.
- Auth:
  - Worker: token is optional (no token required per current implementation).
  - Frontend viewer: connect to `/ws/view/{sessionId}?token=...` with a valid JWT; validated against `sessionId`.
- Important: stream relay does NOT implement/expect `AUTHENTICATE` and will not respond with `AUTHENTICATED`.

## Worker Behavior

- Connects to `/ws/stream/{sessionId}` and begins streaming frames.
- Does not send `AUTHENTICATE` on this socket.
- Updates Redis flags on stream start: `browser_ready=true`, `worker_ready=true`, `workerConnected=true`, `status=active`.

## Recommended Environment Variables

- Worker:
  - `BACKEND_WS_URL` = `wss://<host>/ws/stream/`
  - `BACKEND_ORIGIN` = `https://<host>` (used as Origin header by the Worker).

## Security Guidance

- Use short-lived JWTs for WebSocket auth.
- If passing a token via query string, ensure logs/proxies do not persist query params.
- For stricter security later, the stream relay can require tokens for Worker connections; keeping `?token` support in the Worker is forward-compatible.