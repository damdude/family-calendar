# ADR 002 — Config-driven, no hardcoded family data

- **Status:** Accepted
- **Date:** 2026-07-27
- **Deciders:** Project maintainers

## Context

The same codebase must ship to any family — and potentially as a sellable kit —
without per-family edits. A build for the Sharma family and a build for anyone
else must be byte-identical; only data and configuration differ. This also keeps
the repo safe: no real names, photos, or events can ever be committed.

## Decision

1. **No family data as string literals in components.** Every rendered name,
   avatar, color, event, routine, meal, or list item comes from data — the
   SQLite database at runtime, or `src/lib/fake/` during development. If a
   component contains a family member's name, that is a bug.

2. **Every feature is a config toggle.** `config.features.*` flags gate whole
   surfaces. If a family sets `config.features.meals = false`, the Meals tab and
   its routes disappear — not hidden with CSS, but absent from navigation.

3. **Two-tier configuration.**
   - `config.json` — non-sensitive settings (family name, timezone, feature
     flags, view preferences, sleep window, start-of-week). Human-readable.
   - Encrypted SQLite rows — anything sensitive (OAuth tokens, event
     descriptions, photos, feelings notes). Never in `config.json`, never in Git.

4. **Fake data is quarantined.** All development/demo data lives under
   `src/lib/fake/` and is the _only_ place literal people may appear. Production
   rendering never imports from `src/lib/fake/`.

5. **The setup wizard writes config; code never assumes it.** Components degrade
   gracefully when a feature is off or data is absent (empty states, not crashes).

## Consequences

- A CI lint rule (added later) can assert that non-`fake/` source contains no
  known demo names.
- Adding a feature means adding a flag _and_ an empty/disabled state, not just
  the happy path.
- Selling as a kit is a packaging exercise, not a code fork: flash the image,
  run the wizard, done.

## Related

- ADR 001 (stack choice) — SQLite + JSON split underpins the two-tier config.
- Security rules: sensitive fields are encrypted at rest with a device-bound key.
