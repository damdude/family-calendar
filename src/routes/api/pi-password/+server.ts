import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { RequestHandler } from './$types';

const execAsync = promisify(exec);

const BodySchema = z.object({
	newPassword: z.string().min(6, 'Password must be at least 6 characters'),
	confirmPassword: z.string()
});

/**
 * Change the Pi's default 'pi' user password. Only callable during initial setup.
 * The new password is used for both system login and SSH access.
 */
export const POST: RequestHandler = async ({ request }) => {
	const parsed = BodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) throw error(400, parsed.error.message);

	const { newPassword, confirmPassword } = parsed.data;
	if (newPassword !== confirmPassword) {
		throw error(400, 'Passwords do not match');
	}

	try {
		// Use `echo` + `chpasswd` to change password non-interactively
		// Format: username:newpassword
		const { stdout, stderr } = await execAsync(
			`echo "pi:${newPassword}" | sudo chpasswd`,
			{ timeout: 5000 }
		);

		if (stderr && !stderr.includes('chpasswd')) {
			console.error('Password change stderr:', stderr);
		}

		return json({ ok: true, message: 'Password updated successfully' });
	} catch (err) {
		console.error('Failed to change password:', err);
		throw error(500, 'Failed to update password');
	}
};
