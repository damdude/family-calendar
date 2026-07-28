# ADR 003 — Keyboard-free setup wizard (QR + phone + SSE)

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** Project maintainers

## Context

The Pi drives a TV with no keyboard. First-boot configuration (family name,
timezone, profiles, later calendar accounts) must happen from a phone, and the
kiosk should reflect progress live so setup feels connected, not blind.

## Decision

**Pairing.** The kiosk's `/setup` load issues a short-lived pairing **token**
(`crypto.randomBytes(16)`, base64url), held in an in-memory session with a
10-minute TTL. Each `/setup` load rotates the token; opening a fresh QR
invalidates the old one by expiry. The token gates every setup endpoint. The QR
encodes only `http://<lan-ip>:<port>/setup/pair?token=…` — a LAN address plus
token, never PII. A typed mDNS fallback (`familycalendar.local`) is shown too.

**Transport: SSE (not WebSocket).** Setup sync is one-way server→kiosk push
(the phone drives, the kiosk displays), which is exactly SSE's shape. SSE is
simpler, proxy-friendly, and auto-reconnects. It matches the sibling
`home-display` project. A `text/event-stream` endpoint (`/setup/events`) streams
draft snapshots and a final `complete` event; a periodic comment line keeps the
connection warm.

**Flow.**

1. Kiosk `/setup` → issues token, renders QR + fallback URLs, opens an
   `EventSource` on `/setup/events?token=…`, shows a live preview.
2. Phone opens `/setup/pair?token=…` → server validates/claims the token and
   serves the mobile wizard.
3. Each wizard change POSTs the whole draft to `/setup/step`; the server
   validates it (Zod), stores it on the pairing session, and publishes it to the
   kiosk's channel (an in-process pub/sub keyed by token).
4. Finish POSTs `/setup/complete`; the server writes `config.json` and publishes
   `complete`; the kiosk navigates to the dashboard.

**Persistence.** Non-sensitive settings (`family`, `profiles`, feature flags,
view prefs) are written to `data/config.json` (gitignored) via a Zod-validated,
atomic temp-file-then-rename write. Secrets (OAuth tokens, photos) are **not**
handled here — they go to the encrypted SQLite store in Batch 4.

## Consequences

- Pairing state is in-memory and dies with the process — correct for a
  single-family appliance; no pairing tokens ever persist to disk.
- Sending the whole draft each step (rather than deltas) keeps the protocol
  trivial; payloads are tiny (a family + a handful of profiles).
- The wizard resumes from the server-side draft if the phone reloads mid-setup.
- SSE's one-way nature means the phone learns of completion from its own POST
  response, not the stream — acceptable, since the phone is the driver.
- Photo upload is deferred to Batch 4 (needs the encryption layer); the wizard
  uses emoji avatars for now.

## Related

- ADR 002 — config-driven, two-tier (JSON vs. encrypted SQLite) storage.
- Security rules — short-lived single-use pairing tokens; QR carries no PII.
