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
