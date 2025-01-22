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
let READY_COUNT = 0;

const loggerPrefix = "[MANAGER]";

async function notifyCallback(notify: Notification) {
	if (notify.payload) {
		const [cmd, msg] = notify.payload.split(":");

		if (cmd === "SEND") {
			await send(msg);
		} else if (cmd === "READY") {
			READY_COUNT++;
			if (READY_COUNT === Number(process.env.INSTANCES_CNT)) {
				logger.warn(client, "ALL_INSTANCES_STARTED", loggerPrefix);
			}
		}
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		// 데이터베이스 초기 설정
		await client.query(QUERIES.CREATE_TABLES);

		// 테이블 생성 후 나머지 설정들은 병렬로 실행
		await Promise.all([
			client.query(QUERIES.SETUP_HYPERTABLE),
			client.query(QUERIES.CREATE_INDEXES),
			client.query(QUERIES.SETUP_RETENTION_POLICY),
		]);

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

		if (process.send) {
			process.send("ready");
			logger.warn(client, "MANAGER_START", loggerPrefix);
		} else {
			logger.error(
				client,
				"MANAGER_START_ERROR",
				loggerPrefix,
				"process.send is not available",
			);
		}
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

	try {
		result = await client.query<{
			date: string;
			avg_close_price: number;
			total_volume: number;
		}>(QUERIES.AGGREGATE_DAILY_METRICS);
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
			loggerPrefix,
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

await setup();
