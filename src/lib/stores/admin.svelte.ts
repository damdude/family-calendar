/** Session-scoped admin unlock state for the parental lock. */
class AdminGate {
	/** True once the correct PIN has been entered this session. */
	unlocked = $state(false);
}

export const admin = new AdminGate();
