import type { Icon as IconType } from 'lucide-svelte';

/** One entry in a MobileTabBar. Separate module (rather than exported from
 *  the component file) because a generic type can't be re-exported from a
 *  Svelte component's instance script for another file to import. */
export interface TabBarItem<V extends string> {
	value: V;
	label: string;
	icon: typeof IconType;
	/** Present for an item that's a real navigation (e.g. Settings) rather
	 *  than an in-page tab switch — rendered as a link, not a button. */
	href?: string;
	/** Side effect to run just before an href item navigates away (e.g.
	 *  telling a paired display which section to follow) — fires in
	 *  addition to the browser's own navigation, never instead of it. */
	onclick?: () => void;
}
