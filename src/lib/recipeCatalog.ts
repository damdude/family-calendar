/**
 * Curated recipe catalog — the "background recipe sources" the family browses.
 * Each entry links to a real recipe page; opening one scrapes the full
 * ingredients + steps (server-side, robots-aware). The blurb shows immediately
 * and as an offline fallback. Source URLs are verified to expose schema.org
 * Recipe JSON-LD so the scrape returns structured ingredients + steps.
 */

export interface CatalogRecipe {
	name: string;
	emoji: string;
	cuisine: string;
	category: string;
	sourceUrl: string;
	blurb: string;
}

export const RECIPE_CATEGORIES = [
	'Indian',
	'American',
	'Oriental',
	'Italian',
	'Quick & Kids',
	'Desserts'
] as const;

export const RECIPE_CATALOG: CatalogRecipe[] = [
	// --- Indian ---
	{
		name: 'Paneer Butter Masala',
		emoji: '🧀',
		cuisine: 'Indian',
		category: 'Indian',
		sourceUrl: 'https://www.cookwithmanali.com/paneer-butter-masala/',
		blurb:
			'Soft paneer in a rich, mildly sweet tomato-butter gravy. A family favourite with naan or rice.'
	},
	{
		name: 'Chicken Biryani',
		emoji: '🍚',
		cuisine: 'Indian',
		category: 'Indian',
		sourceUrl: 'https://www.indianhealthyrecipes.com/chicken-biryani-recipe/',
		blurb: 'Fragrant layered rice with spiced chicken, saffron and fried onions.'
	},
	{
		name: 'Dal Tadka',
		emoji: '🍲',
		cuisine: 'Indian',
		category: 'Indian',
		sourceUrl: 'https://www.cookwithmanali.com/dal-tadka/',
		blurb: 'Comforting yellow lentils finished with a sizzling garlic-cumin tempering.'
	},
	{
		name: 'Masala Dosa',
		emoji: '🥞',
		cuisine: 'Indian',
		category: 'Indian',
		sourceUrl: 'https://www.indianhealthyrecipes.com/masala-dosa-recipe/',
		blurb: 'Crisp fermented crepe wrapped around a spiced potato filling.'
	},
	{
		name: 'Chana Masala',
		emoji: '🫘',
		cuisine: 'Indian',
		category: 'Indian',
		sourceUrl: 'https://www.cookwithmanali.com/chana-masala/',
		blurb: 'Chickpeas simmered in an onion-tomato masala — hearty and vegan.'
	},
	// --- American ---
	{
		name: 'Classic Cheeseburger',
		emoji: '🍔',
		cuisine: 'American',
		category: 'American',
		sourceUrl: 'https://www.spendwithpennies.com/cheeseburger/',
		blurb: 'Juicy grilled beef patty with melted cheese on a toasted bun.'
	},
	{
		name: 'Buttermilk Pancakes',
		emoji: '🥞',
		cuisine: 'American',
		category: 'American',
		sourceUrl: 'https://www.loveandlemons.com/pancakes/',
		blurb: 'Fluffy stacks perfect for weekend breakfasts.'
	},
	{
		name: 'Mac & Cheese',
		emoji: '🧀',
		cuisine: 'American',
		category: 'American',
		sourceUrl: 'https://www.loveandlemons.com/mac-and-cheese/',
		blurb: 'Creamy baked macaroni with a golden cheesy top.'
	},
	{
		name: 'BBQ Chicken',
		emoji: '🍗',
		cuisine: 'American',
		category: 'American',
		sourceUrl: 'https://www.spendwithpennies.com/bbq-chicken/',
		blurb: 'Sticky, smoky baked chicken the whole table reaches for.'
	},
	// --- Oriental ---
	{
		name: 'Vegetable Fried Rice',
		emoji: '🍚',
		cuisine: 'Chinese',
		category: 'Oriental',
		sourceUrl: 'https://www.loveandlemons.com/fried-rice/',
		blurb: 'Quick wok-tossed rice loaded with crunchy vegetables.'
	},
	{
		name: 'Veg Hakka Noodles',
		emoji: '🍜',
		cuisine: 'Indo-Chinese',
		category: 'Oriental',
		sourceUrl: 'https://www.indianhealthyrecipes.com/veg-noodles-recipe/',
		blurb: 'Street-style stir-fried noodles with soy and veggies.'
	},
	// --- Italian ---
	{
		name: 'Spaghetti Aglio e Olio',
		emoji: '🍝',
		cuisine: 'Italian',
		category: 'Italian',
		sourceUrl: 'https://www.loveandlemons.com/spaghetti-aglio-e-olio/',
		blurb: 'Garlic, olive oil and chilli — a 20-minute classic.'
	},
	{
		name: 'Margherita Pizza',
		emoji: '🍕',
		cuisine: 'Italian',
		category: 'Italian',
		sourceUrl: 'https://www.loveandlemons.com/margherita-pizza/',
		blurb: 'Tomato, fresh mozzarella and basil on a crisp base.'
	},
	// --- Quick & Kids ---
	{
		name: 'Grilled Cheese',
		emoji: '🧀',
		cuisine: 'American',
		category: 'Quick & Kids',
		sourceUrl: 'https://www.loveandlemons.com/grilled-cheese/',
		blurb: 'Golden, gooey and ready in minutes — a kid classic.'
	},
	{
		name: 'Veggie Quesadilla',
		emoji: '🫓',
		cuisine: 'Mexican',
		category: 'Quick & Kids',
		sourceUrl: 'https://www.loveandlemons.com/quesadilla-recipe/',
		blurb: 'Crispy tortilla folded over melty cheese and veggies.'
	},
	{
		name: 'Green Smoothie',
		emoji: '🥤',
		cuisine: 'American',
		category: 'Quick & Kids',
		sourceUrl: 'https://www.loveandlemons.com/green-smoothie/',
		blurb: 'A fresh, fruity blend that sneaks in the greens.'
	},
	// --- Desserts ---
	{
		name: 'Gulab Jamun',
		emoji: '🍮',
		cuisine: 'Indian',
		category: 'Desserts',
		sourceUrl: 'https://www.indianhealthyrecipes.com/gulab-jamun-recipe/',
		blurb: 'Soft milk-solid dumplings soaked in rose-cardamom syrup.'
	},
	{
		name: 'Chocolate Chip Cookies',
		emoji: '🍪',
		cuisine: 'American',
		category: 'Desserts',
		sourceUrl: 'https://sallysbakingaddiction.com/chocolate-chip-cookies/',
		blurb: 'Chewy centres, crisp edges, loads of chocolate.'
	}
];
