# Getting diagnostics off the device

The appliance keeps a running diagnostic log of what it actually did, which
is the only practical way to see inside the setup wizard: that is precisely
when Settings is unreachable, the screen may be a TV with no keyboard, and
whoever is debugging is not in the room.

## Where it is

```
~/family-calendar/data/debug.log      # current
~/family-calendar/data/debug.log.1    # previous, after rotation at 2MB
```

One JSON object per line, newest last.

## Fetching it

```bash
scp pi@<device-ip>:family-calendar/data/debug.log .
```

Use the device password set in the setup wizard. To watch it live while
reproducing something:

```bash
ssh pi@<device-ip> 'tail -f family-calendar/data/debug.log'
```

## What it records

**Server side** — requests to `/api/*` and `/setup*` (method, path, status,
duration), the decisions the access gates made, and explicit events: Wi-Fi
join attempts and their result, the device-password change, the shape of
submitted Google credentials, the Google device-flow handshake, setup
completion, and each stage of a factory reset.

**Browser side**, via `/api/debug/log` — the transitions the server never
sees on its own, which are usually the context that makes a later failure
interpretable:

| Event                                     | Recorded                                |
| ----------------------------------------- | --------------------------------------- |
| `ui.wizard.step` / `ui.wizard.back`       | which wizard, step number and name      |
| `ui.wizard.personAdded` / `personRemoved` | running total                           |
| `ui.wizard.finished` / `finishFailed`     | profile count, or the failure           |
| `ui.nav`                                  | which tab or page was opened            |
| `ui.settings.saved`                       | which settings groups changed           |
| `ui.settings.feature`                     | which feature was switched, and to what |
| `ui.settings.debugLogging`                | this switch itself                      |

Settings changes are detected by diffing the saved payload rather than by
instrumenting each control, so a switch added later cannot quietly go
unrecorded.

## What it never records

Passwords, client secrets, OAuth tokens, Wi-Fi passphrases and cookies. Any
value under a key matching `pass|secret|token|passphrase|credential|refresh|
authorization|cookie|psk` is replaced with `[redacted N chars]` — the length
survives because "was it empty, or the wrong length" is usually the question
worth answering, and the value itself never is. This is covered by tests in
`src/lib/server/debugLog.test.ts`, since redaction breaking is silent.

Credentials are additionally logged by _shape_ rather than content, e.g.:

```json
{
	"event": "googleCreds.received",
	"clientIdLength": 72,
	"clientIdSuffixOk": true,
	"clientIdHasSpace": false,
	"clientIdHasUppercase": false,
	"secretLength": 28
}
```

That combination identifies a value corrupted in transit — iOS autocorrect
rewriting a pasted client ID, say — without the credential appearing anywhere.

## Turning it off

**Settings → Diagnostics → Debug logging.** Takes effect immediately, no
restart. On by default, because the run worth capturing is usually the first
one and nobody gets the chance to enable anything beforehand.

`FC_DEBUG` in `.env` overrides the setting either way — `0` forces it off,
`1` forces it on — for a device that cannot reach the UI. That needs a
restart:

```bash
sudo systemctl restart family-calendar
```

# Locked out: recovering the device password

Losing the device password closes every door at once — ssh needs it, and so
do the update and factory-reset buttons.

Recovery requires being **physically in front of the display**:

1. On the phone or tablet that is asking for the password, choose
   **"Forgotten it? Recover using the screen"**.
2. A four-digit code appears **on the calendar screen itself**.
3. Type that code back on the phone, along with the **new password** you want.
4. That becomes the device password immediately — for the calendar's own
   prompts and for signing in over the network — and whatever you were doing
   when it asked carries straight on.

The new password is validated before the code is consumed, so a typo or a
mismatch costs nothing: the code stays live and you can correct it without
walking back to the screen for a fresh one. It is also re-checked after being
set, the same way the setup wizard does, so a password manager quietly
filling a generated value fails loudly instead of locking you out later.

An earlier version reset to the shipped default and asked you to change it
afterwards. That was worse: it left a window in which the device was
protected by a publicly known password.

## Why the code is trustworthy

It is held in memory and written nowhere — not the config, not the log, not
the database — so it cannot be read back off the disk. And
`/api/recovery/code` answers **only requests arriving on loopback**, which is
how the kiosk's own browser reaches the server. A phone or laptop on the
network arrives from a routable address and is refused:

```
GET /api/recovery/code  from 127.0.0.1     → {"code":"0879"}
GET /api/recovery/code  from 192.168.7.33  → 403 {"reason":"not-local"}
```

That refusal is the entire proof of presence. Starting a challenge is open to
anyone on the network on purpose — it returns nothing but an expiry, so doing
it without being in the room only puts a code on a screen you cannot see.

The code is single-use, expires after five minutes, is compared in constant
time, and locks out after five wrong guesses rather than allowing all 10,000
to be tried.

Residual, stated plainly: someone already logged in over ssh could ask
loopback for the code. That is not a new hole — ssh requires the very
password being recovered, so being in that position means already having it
(or an ssh key, which is a trust relationship someone set up deliberately).
