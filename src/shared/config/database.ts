import { type Notification, Pool, type PoolClient } from "pg";
import { CHANNEL, type ChannelType } from "../const/channel.const";
import { DATABASE_LOCKS, type DatabaseLockType } from "../const/lock.const";
export const createPool = () => {
	return new Pool({
		user: process.env.DB_USER || "coin",
		host: process.env.DB_HOST || "localhost",
		database: process.env.DB_NAME || "BTC_KRW",
		password: process.env.DB_PASSWORD || "230308",
		port: Number(process.env.DB_PORT) || 5432,
	});
};

export const setupPubSub = async (client: PoolClient, channels: string[]) => {
	for (const channel of channels) {
		await client.query(`LISTEN ${channel}`);
		console.log(`Listening to ${channel}`);
	}
};

export const handleNotifications = (
	client: PoolClient,
	callback: (message: Notification) => void,
) => {
	client.on("notification", callback);
};

export const notify = async (
	pool: Pool,
	channel: ChannelType,
	message = "",
) => {
	if (process.env.NODE_ENV === "development") {
		console.log(
			`[${new Date().toISOString()}] [NOTIFY] ${CHANNEL[channel]} ${message}`,
		);
	}
	await pool.query(`NOTIFY ${CHANNEL[channel]}, '${message}'`);
};

export const acquireAdvisoryLock = async (
	pool: Pool,
	lockType: DatabaseLockType,
): Promise<boolean> => {
	const result = await pool.query(
		`SELECT pg_try_advisory_lock(${DATABASE_LOCKS[lockType]});`,
	);
	return result.rows[0].pg_try_advisory_lock;
};

export const releaseAdvisoryLock = async (
	pool: Pool,
	lockType: DatabaseLockType,
) => {
	await pool.query(`SELECT pg_advisory_unlock(${DATABASE_LOCKS[lockType]});`);
};
