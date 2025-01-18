import { type Notification, Pool, type PoolClient } from "pg";
import { CHANNEL, type ChannelType } from "../const/channel.const";
import { developmentLog, errorHandler } from "../services/util";
import webhook from "../services/webhook";
import logger from "./logger";

function createPool(): Pool {
	return new Pool({
		user: process.env.DB_USER || "coin",
		host: process.env.DB_HOST || "localhost",
		database: process.env.DB_NAME || "BTC_KRW",
		password: process.env.DB_PASSWORD || "230308",
		port: Number(process.env.DB_PORT) || 5433,
	});
}

export async function getConnection(
	loggerPrefix: string,
): Promise<[Pool, PoolClient]> {
	const maxReconnectAttempts = Number(process.env.MAX_RECONNECT_ATTEMPTS) || 5;
	let reconnectAttempts = 0;

	const reconnect = async (): Promise<[Pool, PoolClient]> => {
		try {
			if (reconnectAttempts >= maxReconnectAttempts) {
				webhook.send(
					`[${new Date().toLocaleString()}] [${loggerPrefix}] 최대 재연결 시도 횟수(${maxReconnectAttempts}회) 초과`,
				);
				process.exit(1);
			}

			reconnectAttempts++;
			logger.info("RECONNECT_ATTEMPTS", loggerPrefix);

			const pool = createPool();
			const client = await pool.connect();

			return [pool, client];
		} catch (error: unknown) {
			developmentLog(error);
			if (error instanceof Error) {
				logger.info("RECONNECT_ERROR", loggerPrefix, `${error.message}`);
			}
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return reconnect();
		}
	};

	try {
		const pool = createPool();
		const client = await pool.connect();

		return [pool, client];
	} catch (error) {
		developmentLog(error);
		return reconnect();
	}
}

export async function setupPubSub(client: PoolClient, channels: string[]) {
	for (const channel of channels) {
		await client.query(`LISTEN ${channel}`);
	}
}

export function handleNotifications(
	client: PoolClient,
	callback: (message: Notification) => void,
): () => void {
	const handler = (msg: Notification) => {
		try {
			callback(msg);
		} catch (error) {
			errorHandler(client, "NOTIFICATION_ERROR", "NOTIFICATION_ERROR", error);
		}
	};

	client.on("notification", handler);

	return () => {
		client.removeListener("notification", handler);
	};
}

export function notify(client: PoolClient, channel: ChannelType, message = "") {
	return client.query(`NOTIFY ${CHANNEL[channel]}, '${message}'`);
}
