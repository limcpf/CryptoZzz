import * as cron from "node-cron";
import type { Notification, Pool, PoolClient } from "pg";
import type { QueryResult } from "pg";
import {
	getConnection,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";
let pool: Pool;
let client: PoolClient;

const loggerPrefix = "[MANAGER]";

async function notifyCallback(notify: Notification) {
	if (notify.payload) {
		const [cmd, msg] = notify.payload.split(":");

		if (cmd === "SEND") {
			await send(msg);
		}
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		console.log("모냥3");

		// 데이터베이스 초기 설정
		await client.query(QUERIES.CREATE_TABLES);

		client.query(QUERIES.SETUP_HYPERTABLE);
		client.query(QUERIES.CREATE_INDEXES);
		client.query(QUERIES.SETUP_RETENTION_POLICY);

		await setupPubSub(client, [CHANNEL.MANAGER_CHANNEL]);

		await setupCronJobs();

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

		logger.warn(client, "MANAGER_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("MANAGER_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${getMsg("MANAGER_START_ERROR")}`);
		}
		process.exit(1);
	}
}

async function aggregateDailyMetrics() {
	logger.warn(client, "AGGREGATE_DAILY_METRICS", loggerPrefix);

	let result: QueryResult<{
		date: string;
		avg_close_price: number;
		total_volume: number;
	}> | null = null;

	// KST 기준으로 어제 날짜 계산
	const yesterday = new Date(
		Date.now() + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000,
	);
	const yesterdayStr = yesterday.toISOString().split("T")[0];

	try {
		result = await client.query<{
			date: string;
			avg_close_price: number;
			total_volume: number;
		}>(QUERIES.AGGREGATE_DAILY_METRICS, [yesterdayStr]);

		console.log(result);
	} catch (error: unknown) {
		errorHandler(client, "AGGREGATE_DAILY_METRICS_ERROR", loggerPrefix, error);
	}

	if (result) {
		const { date, avg_close_price, total_volume } = result.rows[0];
		logger.send(
			client,
			`
**날짜:** ${date}
**평균 종가:** ${avg_close_price}
**총 거래량:** ${total_volume}
			`,
		);
		logger.warn(client, "AGGREGATE_DAILY_METRICS_SUCCESS", loggerPrefix);
	}
}

async function send(msg: string) {
	webhook.send(msg);
}

async function setupCronJobs() {
	if (process.env.NODE_ENV === "production") {
		cron.schedule("0 0 * * *", aggregateDailyMetrics);
	} else {
		cron.schedule("*/1 * * * *", aggregateDailyMetrics);
	}
}

console.log("hi");
await setup();
