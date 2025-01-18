import { type Notification, Pool, type PoolClient } from "pg";
import { developmentLog } from "../../services/analysis";
import { CHANNEL, type ChannelType } from "../const/channel.const";
import { errorHandler } from "../services/util";
import logger from "./logger";

const createPool: () => Pool = () => {
	return new Pool({
		user: process.env.DB_USER || "coin",
		host: process.env.DB_HOST || "localhost",
		database: process.env.DB_NAME || "BTC_KRW",
		password: process.env.DB_PASSWORD || "230308",
		port: Number(process.env.DB_PORT) || 5433,
	});
};

export const getConnection = async (
	loggerPrefix: string,
	setupCallback?: (pool: Pool, client: PoolClient) => Promise<void>,
): Promise<[Pool, PoolClient]> => {
	const maxReconnectAttempts = Number(process.env.MAX_RECONNECT_ATTEMPTS) || 5;
	let reconnectAttempts = 0;

	const reconnect = async (): Promise<[Pool, PoolClient]> => {
		try {
			if (reconnectAttempts >= maxReconnectAttempts) {
				logger.error(
					"DB_CONNECTION_ERROR",
					loggerPrefix,
					`최대 재연결 시도 횟수(${maxReconnectAttempts}회) 초과`,
				);
				process.exit(1);
			}

			reconnectAttempts++;
			logger.info("RECONNECT_ATTEMPTS", loggerPrefix);

			const pool = createPool();
			const client = await pool.connect();

			if (setupCallback) {
				await setupCallback(pool, client);
			}

			return [pool, client];
		} catch (error: unknown) {
			errorHandler("RECONNECT_ERROR", loggerPrefix, error);
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return reconnect();
		}
	};

	try {
		const pool = createPool();
		const client = await pool.connect();

		if (setupCallback) {
			await setupCallback(pool, client);
		}

		return [pool, client];
	} catch (error) {
		return reconnect();
	}
};

export const setupPubSub = async (client: PoolClient, channels: string[]) => {
	for (const channel of channels) {
		await client.query(`LISTEN ${channel}`);
	}
};

export const handleNotifications = (
	client: PoolClient,
	callback: (message: Notification) => void,
) => {
	client.on("notification", callback);
};

export const notify = async (
	client: PoolClient,
	channel: ChannelType,
	message = "",
) => {
	developmentLog(
		`[${new Date().toLocaleString()}] [NOTIFY] ${CHANNEL[channel]} ${message}`,
	);
	await client.query(`NOTIFY ${CHANNEL[channel]}, '${message}'`);
};
