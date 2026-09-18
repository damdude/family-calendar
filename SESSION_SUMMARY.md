# Family Calendar — Session Summary (2026-09-13)

## Major Features Completed This Session

### 1. Fixed QR Code Visibility Bug (Critical)
**Status:** ✅ Deployed to Pi  
**Commits:** `541526e`

**Problem:** Phone-pairing QR code silently never appeared on TV kiosk. The POST `/api/mirror/start` was being rejected with 403 Forbidden.

**Root cause:** Same-origin CSRF check in `src/hooks.server.ts` compared the request's `Origin` header against `event.url.origin`. However, the app runs on adapter-node bound to `HOST=0.0.0.0` with no reverse proxy and no `ORIGIN` env var, so `event.url.origin` was wrong—it was rejecting *every* real browser request (which always sends Origin), even ones whose Origin perfectly matched the page's real address.

**Fix:** Changed the check to compare `Origin` header's hostname against the request's `Host` header instead. `Host` is always what the client actually dialed, regardless of adapter-level origin resolution.

**Impact:** Phone companion setup now works. QR permanently visible on TV for scanning.

---

### 2. Event Tagging by Attendee Email (Feature)
**Status:** ✅ Deployed to Pi  
**Commits:** `6715bb4`

**User request:** "Look at who is on the CC list or invite list on that event, and based on that, assign the tagging for an event."

**What was built:**

- **Schema additions** (`src/lib/server/schema.ts`):
  - `Profile.emails: string[]` — calendar invite addresses for each person (max 5)
  - `Family.sharedEmails: string[]` — household-level addresses (max 10). An invite sent to any shared address tags the whole family.

- **ICS parser** (`src/lib/server/ical.ts`):
  - Extracts all `ATTENDEE` lines from each event (not the organizer, not the title)
  - Strips `mailto:` prefix, lowercases, de-duplicates
  - Added `attendees: string[]` field to `IcsEvent` interface

- **Google Calendar sync** (`src/lib/server/google.ts`):
  - Extracts attendee emails from Google Calendar events
  - For all-day events, correctly subtracts 1 second from exclusive `end.date` (RFC 3339 compat with local inclusive convention)
  - Includes attendees in returned `GoogleEvent`

- **Match logic** (`src/lib/server/sync.ts`):
  - `matchAttendees()`: checks if any event attendee matches a profile's registered emails OR family's shared emails
  - Shared email match returns `[]` (whole family)
  - Personal email match returns that profile's ID(s) only
  - No match returns `null`, falls back to title/calendar heuristics
  - `resolveAutoProfileIds()`: coordinates attendee matching with fallback for cross-calendar duplicates

- **Database** (`src/lib/server/db/migrations.ts` + `repo.ts`):
  - Migration 6: adds `profile_ids_json` column to `events` table (sync's auto-tag guess can now be multi-profile)
  - `resolveProfileIds()` reads: override JSON (if present and non-empty) → auto JSON → calendar default
  - Fixed a bug where empty arrays in JSON were falsy in JS, silently ignoring the auto-guess

- **UI** (`src/lib/components/ProfileEditor.svelte`, phone + desktop Settings):
  - Each profile has an "Email(s) for tagging invites" field (comma-separated, auto-lowercased)
  - Family Settings has "Family email(s)" field for shared addresses
  - Both fields live-sync to config on change

- **Live setup:**
  - Revansh: `sharmarevansh11@gmail.com`
  - Enaya: `sharmaenaya30@gmail.com`
  - Re-sync triggered; next sync will use these addresses

**Testing:** Verified end-to-end with synthetic ICS event:
- Event invited to Revansh's address → tagged to Revansh only ✓
- Event invited to shared address → tagged to whole family ✓
- Organizer field ignored (not used for matching) ✓

---

### 3. Auto-Return to Calendar After 20 Minutes Idle
**Status:** ✅ Deployed to Pi  
**Commits:** `beb1679`

**Problem:** Display can get parked on Lists, Settings, or another tab (from phone remote control or direct touch), with nothing bringing it back to the default Calendar view.

**Solution:** `src/routes/(app)/+layout.svelte` now:
- Tracks `lastActivity` (updated on pointerdown/keydown or any navigation)
- Every 5-second tick, checks if on non-Calendar tab AND `tick - lastActivity > 20 minutes`
- Auto-navigates to `/` (Calendar) when idle past threshold
- Re-navigates on any activity (both physical interaction and navigation from phone count)

**Verified:** 
- Tested with 20-second timeout on dev server
- Confirmed it stays on Lists while under timeout, returns once it expires
- Activity resets the clock

---

## Hardware Research: Everblog Competitor Analysis

**Request:** Analyze Everblog (21.5" FridgeCal / 13.4" HomeCal) for feature inspiration and hardware sourcing.

**Key features worth stealing:**

| Feature | Why valuable | Current status |
|---------|------------|---|
| **Fridge inventory via camera** | Photo-based AI item detection + expiration tracking. Reviewers: ~80% accuracy. Huge UX win. | Not built; would need camera hardware + ML model |
| **AI meal planning from fridge** | Recipe suggestions based on *actual* inventory, not generic DB. | Recipes tab exists; could add inventory sync |
| **Email-to-calendar** | Forward confirmation emails → auto-event. Reviewers: Everblog's unreliable. Could do better. | Not built; medium effort |
| **Auto-wake on approach** | Wake display when fridge opens or on tap. | Not applicable to wall-mounted Pi |
| **Auto-rotate landscape/portrait** | Detect mount orientation, rotate UI. | Not applicable to fixed-mount Pi + TV |
| **Temp/humidity + light sensors** | HomeCal has these for context. | Cheap add-on (I²C sensors ~$5–10) |

**Hardware findings:**

Everblog uses **white-label Android 14 tablets** from Chinese ODMs, not custom SBCs. The Notebookcheck reviewer found a "backdoor" to full Android: navigate through YouTube link → Chrome → Play Store → custom launcher → full Android tablet.

| | FridgeCal (13.4") | HomeCal (21.5") |
|---|---|---|
| **Display** | 1920×1200 FHD, 16:10 | 1920×1080 FHD, 16:9 |
| **Storage** | 32–64 GB | 64 GB |
| **Power** | 8400 mAh battery, USB-C, 3–5 days | AC-only (plugged in) |
| **Audio** | Not specified | 20W quad speakers |
| **Mount** | Magnetic (33–40 lbs grip) | Wall strap / VESA / stand / wood frame |
| **OS** | Android 14 (custom launcher) | Android 14 (custom launcher) |

**Chipset not published.** Budget tablets today ship with Rockchip (RK3566/3568) or Allwinner (A523/A733) — either would handle a kiosk-mode Chromium pointed at your SvelteKit app.

---

## Current Live State

**Git:** `beb1679` (all three commits deployed)

**Calendar:**
- Attendee-based tagging active
- Revansh & Enaya emails configured
- 119 events re-synced with new logic

**Display:**
- QR panel shows permanently (phone companion setup works)
- Auto-returns to Calendar after 20 min idle on any other tab
- Week view, all-day events, avatar positioning all fixed (from prior session)

---

## Pending: Google OAuth Setup

**User request:** "Set up calendar on Google as app so people can sign in on the Google account for each profile instead of passing calendar share link."

**Blocker:** Single account vs. per-profile architecture.

**Current architecture:** One connected Google account total. Sync runs once per cycle, pulls all calendars into the shared DB.

**Two options:**

1. **Per-profile Google sign-in** (requires feature build)
   - Each profile gets its own "Connect Google" button in Settings
   - Each person signs in with their own account
   - Sync loops over every connected account
   - Events auto-tag to the person who connected them

2. **Single shared account** (works today, zero code)
   - Create/use a family Gmail (e.g., family@gmail.com)
   - Everyone approves once via device-flow QR code
   - One connection for the whole household
   - No per-profile auto-tagging (but attendee-based tagging still works)

**User chose:** Per-profile sign-in. Build needed.

**Setup steps (valid regardless):**

1. Create a Google Cloud project (or reuse existing)
2. Enable Google Calendar API
3. Configure OAuth consent screen (External, add test users: all family member Gmail addresses)
4. Create OAuth client: **TVs and Limited Input devices** (device flow, matching the app's current flow)
5. Copy credentials to Pi `.env`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```
6. Restart service: `sudo systemctl restart family-calendar`

---

## For Next Session

**If building per-profile Google OAuth:**
- Schema: Add `googleConnections: Array<{ profileId, accessToken, refreshToken, ...}>` to store
- Sync: Loop over each connected account instead of one
- UI: Settings → each profile gets "Connect Google" button (device-flow QR code)
- Auto-tag: Match synced event's source profile to its owner

**If not building OAuth yet:**
- Just follow setup steps above with a single shared family account
- Attendee-based tagging still works automatically once emails are configured

**Other features to consider (from Everblog research):**
- Fridge/pantry inventory camera + AI recognition
- Auto-rotate on mount orientation detection
- Temp/humidity sensor readouts

---

## Commits This Session

| Commit | Message |
|--------|---------|
| `beb1679` | feat(display): return to Calendar after 20 idle minutes on another tab |
| `541526e` | fix(security): fix same-origin check that was blocking every real browser POST |
| `6715bb4` | fix(pairing): fix QR load-order race; feat(calendar): tag synced events by invite list, not organizer or title |

