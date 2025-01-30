import type { Notification, Pool, PoolClient } from "pg";
import {
	getConnection,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { developmentLog, errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";
import { StrategyFactory } from "../../strategy/strategy.factory";

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

	try {
		const now = new Date();
		const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
		const isoString = koreanTime.toISOString();

		const buyParent = await client.query<{ id: string }>({
			name: `insert_signal_log_${COIN_CODE}_${isoString}`,
			text: QUERIES.INSERT_SIGNAL_LOG,
			values: [COIN_CODE, isoString],
		});

		const uuid = buyParent.rows[0].id;

		if (!uuid) {
			logger.error(client, "SIGNAL_LOG_ERROR", loggerPrefix);
			return;
		}

		const strategies = process.env.STRATEGIES?.split(",") || [];

		if (strategies.length === 0) {
			logger.error(client, "NOT_FOUND_STRATEGY", loggerPrefix);
			return;
		}

		const factory = new StrategyFactory(client, uuid, COIN_CODE);

		const signals = await Promise.all(
			strategies.map(async (strategy) => {
				const strategyInstance = factory.createStrategy(strategy);
				const s = await strategyInstance.execute();
				developmentLog(
					`[${new Date().toLocaleString()}] [ANALYZE] ${strategy} 점수: ${s}`,
				);
				return s;
			}),
		);

		const score = signals.reduce((acc, curr) => acc + curr, 0);

		developmentLog(`[${new Date().toLocaleString()}] [ANALYZE] 점수: ${score}`);

		const result = {
			coin: COIN_CODE,
			score: score,
		};

		notify(client, CHANNEL.TRADING_CHANNEL, JSON.stringify(result));
	} catch (error: unknown) {
		errorHandler(client, "ACCOUNT_STATUS_ERROR", loggerPrefix, error);
		return;
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
