# Monitoring & Alerts – Streaming Relay and Worker

Priority: Medium

Scope: Implement observability for the live streaming path and worker lifecycle. Include synthetic health check for `/ws/stream/`.

## Objectives

- Detect stream regressions within minutes and surface actionable diagnostics
- Track worker readiness, session lifecycle, and relay stability
- Provide alerting with clear runbooks

## Metrics

- Worker
  - `worker.startup.time_ms` (time to browser ready)
  - `worker.stream.start.count` (per session)
  - `worker.stream.frame.rate_fps` (per session)
  - `worker.stream.frame.size_bytes_p50/p95` (jpeg payload)
  - `worker.stream.errors.count` (by category: ws_send, redis_pub, playwright)
  - `worker.redis.pub.latency_ms` (publish to Redis)
  - `worker.redis.status` (connected/disconnected)

- Relay (server)
  - `relay.connections.active` (current)
  - `relay.connections.established.count` / `relay.connections.closed.count`
  - `relay.frames.forwarded.count` (per session)
  - `relay.frames.dropped.count` (with reason)
  - `relay.ws.close.code.count` (by code)
  - `relay.latency.forward_ms_p50/p95` (optional)

- UI
  - `ui.viewer.ws.connect.time_ms` (time to first frame)
  - `ui.viewer.ws.reconnect.count`

## Synthetic Checks

- `GET /health` – worker and main service health endpoints (existing)
- `WS /ws/stream/synthetic` – open a WebSocket, send a small test frame payload, expect echo/ack within 2s
  - Frequency: every 1 minute
  - Environments: production only
  - Alert if: 3 consecutive failures or p95 connect time > 2s for 10 min

## Alerts

- P0
  - No frames received for active session > 30s
  - Relay connections error rate > 5% over 5 min
  - Worker startup failures > 2 in 10 min

- P1
  - p95 time-to-first-frame > 6s over 10 min
  - Redis publish failures > 1% over 10 min

## Dashboards

- Overview: active sessions, time-to-first-frame, error rates
- Worker: startup times, FPS, error breakdown, Redis status
- Relay: connections, closes by code, frames forwarded/dropped

## Implementation Notes

- Emit structured logs with consistent prefixes: `WORKER:`, `STREAM:`, `RELAY:`
- Prefer lightweight metrics emitter (StatsD/Prometheus) where available; otherwise start with logs → metrics pipeline
- Tag all metrics with `env`, `service`, `session_id` (where cardinality is acceptable)

## Runbooks

- No frames visible
  - Check relay logs for session connection
  - Check worker logs for `STREAM: Screencast started`
  - Verify Redis metrics and recent publish errors

- High dropped frames
  - Inspect relay CPU/memory, p95 forward latency
  - Confirm UI reconnect thrash rates

## Deliverables

- Instrumentation PRs for worker and server relay
- Synthetic `/ws/stream/` check via your monitoring platform
- Dashboards and alert policies with thresholds above