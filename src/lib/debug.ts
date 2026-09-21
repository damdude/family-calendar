/**
 * Client half of the diagnostic log. Fire-and-forget: a diagnostic must never
 * delay or break the interaction it is describing.
 *
 * Send shapes and identifiers, never values a person typed — the server
 * redacts by key name, but the cheapest way not to log a secret is not to
 * send one.
 */
export function uiLog(event: string, details?: Record<string, unknown>): void {
	try {
		void fetch('/api/debug/log', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ event, details }),
			keepalive: true
		}).catch(() => {});
	} catch {
		/* never throw from a log call */
	}
}
