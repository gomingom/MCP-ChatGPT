import { drizzle } from 'drizzle-orm/d1';
import { cartItems, products, reviews } from './schema';
import { and, eq, like, or } from 'drizzle-orm';

const getDB = (d1: D1Database) => {
	return drizzle(d1);
};

export const searchProducts = async (d1: D1Database, query?: string, category?: string) => {
	const db = getDB(d1);
	const conditions = [];

	if (query) {
		const q = `%${query}%`;
		conditions.push(or(like(products.name, q), like(products.description, q)));
	}

	if (category) {
		conditions.push(eq(products.category, category));
	}

	return await db
		.select()
		.from(products)
		.where(conditions.length > 0 ? and(...conditions) : undefined);
};

export const getProduct = async (d1: D1Database, productId: string) => {
	const db = getDB(d1);
	const product = await db.select().from(products).where(eq(products.id, productId)).get();
	return product;
};

export const getReviewsByProductId = async (d1: D1Database, productId: string) => {
	const db = getDB(d1);
	const productReviews = await db.select().from(reviews).where(eq(reviews.productId, productId));
	return productReviews;
};

export const modifyCart = async (d1: D1Database, userId: string, productId: string, quantity: number) => {
	const db = getDB(d1);
	const existing = await db
		.select()
		.from(cartItems)
		.where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
		.get();
	if (existing) {
		const newQuantity = existing.quantity + quantity;
		if (newQuantity <= 0) {
			await db.delete(cartItems).where(eq(cartItems.productId, productId));
		} else {
			await db.update(cartItems).set({ quantity: newQuantity }).where(eq(cartItems.productId, productId));
		}
	} else {
		await db.insert(cartItems).values({ userId, productId, quantity });
	}
};

export const getCartProducts = async (d1: D1Database, userId: string) => {
	const db = getDB(d1);
	return await db
		.select({ id: products.id, name: products.name, price: products.price, image: products.image, quantity: cartItems.quantity })
		.from(cartItems)
		.innerJoin(products, eq(cartItems.productId, products.id))
		.where(eq(cartItems.userId, userId));
};

export const clearCart = async (d1: D1Database, userId: string) => {
	const db = getDB(d1);
	await db.delete(cartItems).where(eq(cartItems.userId, userId));
};
