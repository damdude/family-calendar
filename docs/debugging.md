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

Requests to `/api/*` and `/setup*` (method, path, status, duration), the
decisions the access gates made, and explicit events through the wizard:
Wi-Fi join attempts and their result, the device-password change, the shape
of submitted Google credentials, the Google device-flow handshake, and setup
completion.

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

Logging is on by default, because the run worth capturing is usually the
first one and nobody gets a chance to enable anything beforehand. To disable,
set `FC_DEBUG=0` in `~/family-calendar/.env` and restart:

```bash
sudo systemctl restart family-calendar
```
