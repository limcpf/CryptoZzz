import type { Notification, Pool, PoolClient } from "pg";
import {
	getConnection,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";
import { executeBuyOrder, executeSellOrder } from "./orders";

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
		[pool, client] = await getConnection(loggerPrefix);

		await setupPubSub(client, [CHANNEL.TRADING_CHANNEL]);

		handleNotifications(client, async (msg) => {
			await notifyCallback(msg);
		});

		client.on("error", (err: unknown) => {
			errorHandler(client, "DB_CONNECTION_ERROR", loggerPrefix, err);
		});

		setupProcessHandlers({
			loggerPrefix,
			pool,
			client,
		});

		logger.warn(client, "TRADING_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("TRADING_SERVICE_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${getMsg("TRADING_SERVICE_START_ERROR")}`);
		}
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
