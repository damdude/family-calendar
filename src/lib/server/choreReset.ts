import { resetCompletedChores, getAllChores } from './familydata';

/** Run chore resets if needed (call from a periodic task or on app startup) */
export async function checkAndResetChores(): Promise<void> {
	const now = new Date();

	// Reset daily chores every day at midnight
	if (now.getHours() === 0) {
		await resetCompletedChores('daily');
	}

	// Reset weekly chores every Sunday at midnight
	if (now.getDay() === 0 && now.getHours() === 0) {
		await resetCompletedChores('weekly');
	}
}

/** Get chores that are overdue (past their dueDate without being completed) */
export async function getOverdueChores(): Promise<
	Array<{
		id: number;
		name: string;
		dueDate?: string;
		daysOverdue: number;
	}>
> {
	const chores = await getAllChores();
	const today = new Date().toISOString().split('T')[0];

	return chores
		.filter((c) => !c.completed && c.dueDate && c.dueDate < today)
		.map((c) => ({
			id: c.id,
			name: c.name,
			dueDate: c.dueDate,
			daysOverdue: Math.floor(
				(new Date(today).getTime() - new Date(c.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
			)
		}));
}
