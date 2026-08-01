/**
 * Meal helpers: cuisine dish libraries + emoji suggestion from a typed name.
 * Used by the meal-plan editor so a no-touch TV (driven from a phone) can pick
 * dishes and icons quickly, and so typing a name auto-fills a sensible emoji.
 */

export interface Dish {
	name: string;
	emoji: string;
}

export interface Cuisine {
	id: string;
	label: string;
	emoji: string;
	dishes: Dish[];
}

export const CUISINES: Cuisine[] = [
	{
		id: 'indian',
		label: 'Indian',
		emoji: '🍛',
		dishes: [
			{ name: 'Paneer Butter Masala', emoji: '🧀' },
			{ name: 'Chicken Biryani', emoji: '🍚' },
			{ name: 'Veg Biryani', emoji: '🍚' },
			{ name: 'Dal Tadka', emoji: '🍲' },
			{ name: 'Chole Bhature', emoji: '🍛' },
			{ name: 'Rajma Chawal', emoji: '🍛' },
			{ name: 'Masala Dosa', emoji: '🥞' },
			{ name: 'Idli Sambar', emoji: '🍥' },
			{ name: 'Aloo Paratha', emoji: '🫓' },
			{ name: 'Roti & Sabzi', emoji: '🫓' },
			{ name: 'Samosa', emoji: '🥟' },
			{ name: 'Butter Chicken', emoji: '🍗' },
			{ name: 'Palak Paneer', emoji: '🥬' },
			{ name: 'Pav Bhaji', emoji: '🍞' },
			{ name: 'Poha', emoji: '🍚' },
			{ name: 'Upma', emoji: '🥣' },
			{ name: 'Chana Masala', emoji: '🫘' },
			{ name: 'Gulab Jamun', emoji: '🍮' },
			{ name: 'Masala Chai', emoji: '🍵' },
			{ name: 'Vada Pav', emoji: '🍔' }
		]
	},
	{
		id: 'american',
		label: 'American',
		emoji: '🍔',
		dishes: [
			{ name: 'Cheeseburger', emoji: '🍔' },
			{ name: 'Hot Dog', emoji: '🌭' },
			{ name: 'Mac & Cheese', emoji: '🧀' },
			{ name: 'BBQ Ribs', emoji: '🍖' },
			{ name: 'Fried Chicken', emoji: '🍗' },
			{ name: 'Pancakes', emoji: '🥞' },
			{ name: 'Waffles', emoji: '🧇' },
			{ name: 'Grilled Cheese', emoji: '🧀' },
			{ name: 'Meatloaf', emoji: '🍖' },
			{ name: 'Caesar Salad', emoji: '🥗' },
			{ name: 'Steak & Potatoes', emoji: '🥩' },
			{ name: 'Pot Roast', emoji: '🍲' }
		]
	},
	{
		id: 'italian',
		label: 'Italian',
		emoji: '🍝',
		dishes: [
			{ name: 'Spaghetti', emoji: '🍝' },
			{ name: 'Margherita Pizza', emoji: '🍕' },
			{ name: 'Lasagna', emoji: '🍝' },
			{ name: 'Penne Alfredo', emoji: '🍝' },
			{ name: 'Risotto', emoji: '🍚' },
			{ name: 'Minestrone Soup', emoji: '🍲' },
			{ name: 'Garlic Bread', emoji: '🥖' },
			{ name: 'Ravioli', emoji: '🥟' }
		]
	},
	{
		id: 'oriental',
		label: 'Oriental',
		emoji: '🥡',
		dishes: [
			{ name: 'Fried Rice', emoji: '🍚' },
			{ name: 'Hakka Noodles', emoji: '🍜' },
			{ name: 'Ramen', emoji: '🍜' },
			{ name: 'Sushi', emoji: '🍣' },
			{ name: 'Dumplings', emoji: '🥟' },
			{ name: 'Spring Rolls', emoji: '🥢' },
			{ name: 'Pad Thai', emoji: '🍜' },
			{ name: 'Manchurian', emoji: '🍢' },
			{ name: 'Sweet & Sour', emoji: '🥡' },
			{ name: 'Bao Buns', emoji: '🥟' }
		]
	},
	{
		id: 'mexican',
		label: 'Mexican',
		emoji: '🌮',
		dishes: [
			{ name: 'Tacos', emoji: '🌮' },
			{ name: 'Burrito', emoji: '🌯' },
			{ name: 'Quesadilla', emoji: '🫓' },
			{ name: 'Nachos', emoji: '🧀' },
			{ name: 'Enchiladas', emoji: '🌶️' },
			{ name: 'Guacamole & Chips', emoji: '🥑' }
		]
	},
	{
		id: 'quick',
		label: 'Quick & Kids',
		emoji: '⚡',
		dishes: [
			{ name: 'Sandwiches', emoji: '🥪' },
			{ name: 'Wrap', emoji: '🌯' },
			{ name: 'Cereal', emoji: '🥣' },
			{ name: 'Fruit Bowl', emoji: '🍓' },
			{ name: 'Smoothie', emoji: '🥤' },
			{ name: 'Boiled Eggs', emoji: '🥚' },
			{ name: 'Salad', emoji: '🥗' },
			{ name: 'Soup', emoji: '🍲' },
			{ name: 'Nuggets & Fries', emoji: '🍟' },
			{ name: 'Toast', emoji: '🍞' }
		]
	}
];

/** A broad palette for manual emoji picking. */
export const FOOD_EMOJIS = [
	'🍽️',
	'🍛',
	'🍚',
	'🍲',
	'🥘',
	'🍜',
	'🍝',
	'🍕',
	'🍔',
	'🌭',
	'🌮',
	'🌯',
	'🥙',
	'🥪',
	'🫓',
	'🥟',
	'🍗',
	'🍖',
	'🥩',
	'🍤',
	'🍣',
	'🥗',
	'🥣',
	'🥞',
	'🧇',
	'🍳',
	'🥚',
	'🧀',
	'🥦',
	'🥬',
	'🫘',
	'🌶️',
	'🥔',
	'🍞',
	'🥖',
	'🥐',
	'🍟',
	'🍿',
	'🥤',
	'🍵',
	'☕',
	'🧃',
	'🍓',
	'🍎',
	'🍌',
	'🍇',
	'🍊',
	'🥑',
	'🍮',
	'🍰',
	'🧁',
	'🍨',
	'🍪',
	'🍫',
	'🍩'
];

// Keyword → emoji, checked as substrings of the lower-cased name. Ordered so
// more specific keys win (first match wins).
const KEYWORDS: [string, string][] = [
	// Compound names first so they win over their substrings (e.g. cheeseburger).
	['cheeseburger', '🍔'],
	['hamburger', '🍔'],
	['vada pav', '🍔'],
	['biryani', '🍚'],
	['fried rice', '🍚'],
	['rice', '🍚'],
	['pulao', '🍚'],
	['paneer', '🧀'],
	['mac', '🧀'],
	['cheese', '🧀'],
	['dosa', '🥞'],
	['pancake', '🥞'],
	['waffle', '🧇'],
	['idli', '🍥'],
	['dal', '🍲'],
	['daal', '🍲'],
	['soup', '🍲'],
	['curry', '🍛'],
	['chole', '🍛'],
	['rajma', '🍛'],
	['chana', '🫘'],
	['bean', '🫘'],
	['roti', '🫓'],
	['paratha', '🫓'],
	['naan', '🫓'],
	['quesadilla', '🫓'],
	['tortilla', '🫓'],
	['samosa', '🥟'],
	['dumpling', '🥟'],
	['momo', '🥟'],
	['ravioli', '🥟'],
	['bao', '🥟'],
	['chicken', '🍗'],
	['tikka', '🍗'],
	['wing', '🍗'],
	['nugget', '🍟'],
	['mutton', '🍖'],
	['lamb', '🍖'],
	['rib', '🍖'],
	['bbq', '🍖'],
	['pork', '🥓'],
	['steak', '🥩'],
	['beef', '🥩'],
	['meat', '🥩'],
	['shrimp', '🍤'],
	['prawn', '🍤'],
	['sushi', '🍣'],
	['fish', '🐟'],
	['pizza', '🍕'],
	['burger', '🍔'],
	['vada pav', '🍔'],
	['hot dog', '🌭'],
	['sausage', '🌭'],
	['taco', '🌮'],
	['burrito', '🌯'],
	['wrap', '🌯'],
	['sandwich', '🥪'],
	['toast', '🍞'],
	['bread', '🍞'],
	['pav', '🍞'],
	['noodle', '🍜'],
	['ramen', '🍜'],
	['pad thai', '🍜'],
	['pasta', '🍝'],
	['spaghetti', '🍝'],
	['lasagna', '🍝'],
	['penne', '🍝'],
	['alfredo', '🍝'],
	['salad', '🥗'],
	['egg', '🥚'],
	['omelet', '🍳'],
	['poha', '🍚'],
	['upma', '🥣'],
	['cereal', '🥣'],
	['oats', '🥣'],
	['porridge', '🥣'],
	['smoothie', '🥤'],
	['juice', '🧃'],
	['shake', '🥤'],
	['chai', '🍵'],
	['tea', '🍵'],
	['coffee', '☕'],
	['fry', '🍟'],
	['fries', '🍟'],
	['chips', '🍟'],
	['popcorn', '🍿'],
	['fruit', '🍓'],
	['apple', '🍎'],
	['banana', '🍌'],
	['avocado', '🥑'],
	['guac', '🥑'],
	['gulab', '🍮'],
	['jamun', '🍮'],
	['pudding', '🍮'],
	['cake', '🍰'],
	['ice cream', '🍨'],
	['cookie', '🍪'],
	['chocolate', '🍫'],
	['dessert', '🧁'],
	['spring roll', '🥢'],
	['manchurian', '🍢'],
	['veg', '🥦'],
	['spinach', '🥬'],
	['palak', '🥬']
];

/** Guess a food emoji from a meal name. Falls back to the generic plate. */
export function autoEmojiFor(name: string): string {
	const n = name.toLowerCase();
	for (const [kw, emoji] of KEYWORDS) {
		if (n.includes(kw)) return emoji;
	}
	return '🍽️';
}
