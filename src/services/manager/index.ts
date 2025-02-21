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
import type { GetOrderResponse } from "../../shared/interfaces/iOrder";
import API from "../../shared/services/api";
import i18n from "../../shared/services/i18n";
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
		} else if (cmd === "ORDER_UPDATE") {
			await updateOrder(msg);
		}
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		// 데이터베이스 초기 설정
		await client.query(QUERIES.init);
		await client.query(QUERIES.SETUP_HYPERTABLE);
		await client.query(QUERIES.SETUP_RETENTION_POLICY);

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
				`${loggerPrefix} ${i18n.getMessage("MANAGER_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${i18n.getMessage("MANAGER_START_ERROR")}`);
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

async function delete48HoursAgoData() {
	logger.warn(client, "DELETE_48_HOURS_AGO_DATA", loggerPrefix);

	try {
		const result = await client.query(
			"DELETE FROM Market_Data WHERE timestamp < (NOW() - INTERVAL '48 hours');",
		);

		const msg = `
			**48시간 전 데이터 삭제 완료**
			**삭제된 행 수:** ${result.rowCount}
		`;

		logger.send(client, msg);
	} catch (error: unknown) {
		errorHandler(client, "DELETE_48_HOURS_AGO_DATA_ERROR", loggerPrefix, error);
	}
}

async function send(msg: string) {
	webhook.send(msg);
}

async function setupCronJobs() {
	if (process.env.NODE_ENV === "production") {
		cron.schedule("0 0 * * *", async () => {
			await delete48HoursAgoData();
			await aggregateDailyMetrics();
		});
	}
}

async function updateOrder(msg: string, retryCount = 0) {
	const uuid = msg.split(",");

	if (uuid.length !== 2) {
		throw new Error("유효하지 않은 UUID 형식입니다");
	}

	for (const id of uuid) {
		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
				id,
			)
		) {
			throw new Error("유효하지 않은 UUID 형식입니다");
		}
	}

	let order: GetOrderResponse;
	try {
		order = await API.GET_ORDER(uuid[0]);
		console.log(order);
	} catch (error: unknown) {
		errorHandler(client, "ORDER_UPDATE_ERROR", loggerPrefix, error);
		throw new Error("주문 정보를 찾을 수 없습니다");
	}

	const maxRetries = 3;
	const retryInterval = 3000;

	if (order.trades_count === 0 && retryCount < maxRetries) {
		return new Promise((resolve) => {
			setTimeout(() => {
				resolve(updateOrder(msg, retryCount + 1));
			}, retryInterval);
		});
	}
	if (retryCount >= maxRetries) {
		logger.send(client, "주문 업데이트 실패");
		return;
	}

	if (order.trades_count > 0) {
		try {
			const trade = order.trades[0];

			await client.query(QUERIES.UPDATE_TRADE, [
				uuid[1],
				trade.side === "bid" ? "BUY" : "SELL",
				trade.market,
				trade.funds,
				trade.volume,
				order.paid_fee,
			]);

			logger.send(
				client,
				`${uuid[1]} 거래 완료 ${trade.side === "bid" ? "매수" : "매도"} ${trade.market} ${trade.funds}`,
			);
		} catch (error: unknown) {
			errorHandler(client, "ORDER_UPDATE_ERROR", loggerPrefix, error);
		}

		return;
	}

	logger.send(client, "거래 없음");
}

await setup();
