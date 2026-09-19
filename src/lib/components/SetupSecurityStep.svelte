<script lang="ts">
	import { Lock, AlertCircle, CheckCircle2 } from 'lucide-svelte';

	let password = $state('');
	let confirmPassword = $state('');
	let googleClientId = $state('');
	let googleClientSecret = $state('');

	let saving = $state(false);
	let error = $state('');
	let success = $state(false);

	async function handleSave() {
		error = '';
		success = false;

		// Validate password
		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 6) {
			error = 'Password must be at least 6 characters';
			return;
		}

		saving = true;

		try {
			// Save password
			if (password) {
				const pwRes = await fetch('/api/pi-password', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ newPassword: password, confirmPassword })
				});

				if (!pwRes.ok) {
					const msg = await pwRes.text();
					throw new Error(`Password update failed: ${msg}`);
				}
			}

			// Save environment variables (Google OAuth)
			if (googleClientId || googleClientSecret) {
				const envRes = await fetch('/api/setup-env', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({
						googleClientId,
						googleClientSecret
					})
				});

				if (!envRes.ok) {
					const msg = await envRes.text();
					throw new Error(`Environment setup failed: ${msg}`);
				}
			}

			success = true;
			// Clear sensitive data from memory
			password = '';
			confirmPassword = '';
			googleClientId = '';
			googleClientSecret = '';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Setup failed';
		} finally {
			saving = false;
		}
	}
</script>

<div class="w-full max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg space-y-6">
	<div class="text-center space-y-2">
		<div class="flex justify-center">
			<Lock class="w-12 h-12 text-blue-600" />
		</div>
		<h2 class="text-2xl font-bold text-gray-900">Security Setup</h2>
		<p class="text-gray-600">Set your Pi password and optional Google Calendar credentials</p>
	</div>

	{#if error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
			<AlertCircle class="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
			<div class="text-red-800 text-sm">{error}</div>
		</div>
	{/if}

	{#if success}
		<div class="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
			<CheckCircle2 class="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
			<div class="text-green-800 text-sm">Security settings saved successfully!</div>
		</div>
	{/if}

	<div class="space-y-4">
		<!-- Password Section -->
		<div class="border-t pt-4 space-y-4">
			<h3 class="font-semibold text-gray-900">Pi Login Password</h3>
			<p class="text-sm text-gray-600">
				This password will be used for SSH access and system login. Choose something strong.
			</p>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">New Password</label>
				<input
					type="password"
					bind:value={password}
					placeholder="Minimum 6 characters"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
				<input
					type="password"
					bind:value={confirmPassword}
					placeholder="Re-enter password"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</div>
		</div>

		<!-- Google OAuth Section -->
		<div class="border-t pt-4 space-y-4">
			<h3 class="font-semibold text-gray-900">Google Calendar (Optional)</h3>
			<p class="text-sm text-gray-600">
				Add your Google OAuth credentials to enable calendar sync. You can skip this and add it later
				in Settings.
			</p>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
				<input
					type="text"
					bind:value={googleClientId}
					placeholder="Leave blank to skip"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				/>
				<p class="text-xs text-gray-500 mt-1">
					From Google Cloud Console → OAuth 2.0 Client IDs
				</p>
			</div>

			<div>
				<label class="block text-sm font-medium text-gray-700 mb-2">Client Secret</label>
				<input
					type="password"
					bind:value={googleClientSecret}
					placeholder="Leave blank to skip"
					class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
				/>
				<p class="text-xs text-gray-500 mt-1">Kept secure, never stored in Git</p>
			</div>
		</div>

		<!-- Info Box -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
			<p class="font-medium mb-2">🔐 Security Note:</p>
			<ul class="list-disc list-inside space-y-1 text-xs">
				<li>Credentials are encrypted and never leave your Pi</li>
				<li>They are NOT stored in the GitHub repository</li>
				<li>Accessible only to the Pi system and your family</li>
			</ul>
		</div>

		<button
			on:click={handleSave}
			disabled={saving || (!password && !googleClientId)}
			class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
		>
			{#if saving}
				<span class="flex items-center justify-center gap-2">
					<div class="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
					Saving...
				</span>
			{:else}
				Continue to Dashboard
			{/if}
		</button>
	</div>
</div>

<style>
	:global(body) {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}
</style>
