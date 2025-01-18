import type { Notification, Pool, PoolClient } from "pg";
import {
	getConnection,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { errorHandler } from "../../shared/services/util";
import { executeBuyOrder, executeSellOrder } from "./orders";

export const developmentLog =
	process.env.NODE_ENV === "development" ? console.log : () => {};

let pool: Pool;
let client: PoolClient;
let isRunning = false;

const loggerPrefix = "[TRADING]";

async function notifyCallback(msg: Notification) {
	switch (msg.channel.toUpperCase()) {
		case CHANNEL.TRADING_CHANNEL:
			if (isRunning) return;

			isRunning = true;

			await executeOrder(msg.payload as string);
			break;
		default:
			break;
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix, async (pool, client) => {
			await setupPubSub(client, [CHANNEL.TRADING_CHANNEL]);

			handleNotifications(client, async (msg) => {
				await notifyCallback(msg);
			});

			client.on("error", (err: unknown) => {
				errorHandler(client, "DB_CONNECTION_ERROR", loggerPrefix, err);
			});
		});

		setupProcessHandlers({
			loggerPrefix,
			pool,
			client,
		});

		logger.warn(client, "TRADING_SERVICE_START", loggerPrefix);
	} catch (error: unknown) {
		errorHandler(client, "INIT_SETUP_ERROR", loggerPrefix, error);
		process.exit(1);
	}
}

async function executeOrder(signal: string) {
	const [signalType, symbol] = signal.split(":");

	try {
		switch (signalType) {
			case "BUY":
				await executeBuyOrder(client, symbol, loggerPrefix);
				break;
			case "SELL":
				await executeSellOrder(client, symbol, loggerPrefix);
				break;
		}
	} catch (error: unknown) {
		errorHandler(client, "EXECUTE_ORDER_ERROR", loggerPrefix, error);
	} finally {
		isRunning = false;
	}
}

await setup();
