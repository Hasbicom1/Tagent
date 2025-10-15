# Backlog

## Low Priority

- Enhance stream relay to support `Authorization: Bearer <token>` header on `/ws/stream/{sessionId}` in addition to `?token=` query parameter, while remaining backward compatible.
  - Rationale: Future-proof token handling and align with standard auth patterns.
  - Acceptance: Relay accepts either header or query param, and continues to function with no token for worker connections where allowed by policy.