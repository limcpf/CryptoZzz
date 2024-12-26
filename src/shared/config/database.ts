import { Pool } from "pg";

export const createPool = () => {
	return new Pool({
		user: process.env.DB_USER || "coin",
		host: process.env.DB_HOST || "localhost",
		database: process.env.DB_NAME || "BTC_KRW",
		password: process.env.DB_PASSWORD || "230308",
		port: Number(process.env.DB_PORT) || 5432,
	});
};

export const setupPubSub = async (client, channels: string[]) => {
	for (const channel of channels) {
		await client.query(`LISTEN ${channel}`);
	}
};
