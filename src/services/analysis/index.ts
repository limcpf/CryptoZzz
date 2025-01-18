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
import { Signal } from "../../strategy/iStrategy";
import { checkAccountStatus } from "./services/check-account-status";
import { executeBuySignal, executeSellSignal } from "./signals";

const loggerPrefix = "[ANALYZE]";

let pool: Pool;
let client: PoolClient;

async function notifyCallback(msg: Notification) {
	switch (msg.channel.toUpperCase()) {
		case CHANNEL.ANALYZE_CHANNEL:
			await main(msg.payload);
			break;
		default:
			break;
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		await setupPubSub(client, [CHANNEL.ANALYZE_CHANNEL]);

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

		logger.warn(client, "ANALYZE_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("ANALYZE_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${getMsg("ANALYZE_START_ERROR")}`);
		}
		process.exit(1);
	}
}

async function main(COIN_CODE: string | undefined) {
	if (!COIN_CODE) {
		logger.error(client, "PAYLOAD_ERROR", loggerPrefix);
		return;
	}

	let status: "BUY" | "SELL" | "HOLD";
	const coin = COIN_CODE.replace("KRW-", "");

	/* Determine buy/sell based on account status */
	/* 계좌 상태로 매수/매도 판단 */
	try {
		status = await checkAccountStatus(coin);
	} catch (error) {
		logger.error(client, "ACCOUNT_STATUS_ERROR", loggerPrefix);
		return;
	}

	/* Execute buy/sell signal */
	/* 매수/매도 신호 실행 */
	try {
		switch (status) {
			case "BUY": {
				const signal = await executeBuySignal(client, COIN_CODE);
				if (signal === Signal.BUY)
					notify(client, CHANNEL.TRADING_CHANNEL, `BUY:${COIN_CODE}`);
				break;
			}
			case "SELL": {
				const signal = await executeSellSignal(client, COIN_CODE, coin);
				if (signal === Signal.SELL)
					notify(client, CHANNEL.TRADING_CHANNEL, `SELL:${COIN_CODE}`);
				break;
			}
			case "HOLD":
				break;
		}
	} catch (error: unknown) {
		errorHandler(client, "SIGNAL_ERROR", loggerPrefix, error);
	}
}

const init = async () => {
	await setup();
};

init().catch((error) => {
	webhook.send(
		`${loggerPrefix} ${getMsg("ANALYZE_START_ERROR")} ${error.message}`,
	);
	process.exit(1);
});
