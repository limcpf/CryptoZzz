import cron from "node-cron";
import {
	createPool,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
import { CANDLE_SAVE_QUERY } from "../../shared/const/query/candle-save";
import API_URL from "../../shared/services/api";
import i18n from "../../shared/services/i18n";
import webhook from "../../shared/services/webhook";
import type { Candle } from "../../shared/types/Candle.type";

/** 전역변수 */

/**
 * @name pool
 * @description Database Pool
 */
const pool = createPool();

/**
 * @name client
 * @description Database Client
 */
const client = await pool.connect();

/**
 * @name IS_CANDLE_ERROR_SENT
 * @description 5분마다 한번씩만 오류 메시지를 전송하기 위한 구분 값
 */
let IS_CANDLE_ERROR_SENT = false;

/**
 * @name setup
 * @description Setup
 */
async function setup() {
	IS_CANDLE_ERROR_SENT = false;
	await setupPubSub(client, [CHANNEL.WEBHOOK_CHANNEL]);
	handleNotifications(client, (msg) => webhook.send(msg.payload ?? ""));
}

/**
 * @name fetchAndSaveCandles
 * @description 캔들 데이터를 가져와서 저장하는 핵심 로직
 * @param count 가져올 캔들의 수
 */
async function fetchAndSaveCandles(count = 3) {
	const endpoint = API_URL.GET_CANDLE_DATA(
		process.env.CRYPTO_CODE || "",
		count,
	);

	const url = `${process.env.MARKET_URL}${endpoint}`;

	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(
			`[CANDLE-SAVE] ${i18n.getMessage("CANDLE_SAVE_API_ERROR")} : ${response.status}`,
		);
	}

	const data = (await response.json()) as [Candle, Candle, Candle];
	await saveCandleData(data);
}

/**
 * @name saveMarketData
 * @description 캔들 데이터를 데이터베이스에 저장하는 핵심 로직
 * @param data 저장할 캔들 데이터
 */
async function saveCandleData(data: [Candle, Candle, Candle]) {
	try {
		await Promise.all(
			data.map((candle) =>
				client.query(CANDLE_SAVE_QUERY.UPSERT_MARKET_DATA, [
					candle.market,
					new Date(candle.candle_date_time_kst),
					candle.opening_price,
					candle.high_price,
					candle.low_price,
					candle.trade_price,
					candle.candle_acc_trade_volume,
				]),
			),
		).then(() => {
			// TODO : NOTIFY 매수/매도 판단
		});
	} catch (error: unknown) {
		if (error instanceof Error) {
			await notify(pool, "WEBHOOK_CHANNEL", `[CANDLE-SAVE] ${error.message}\n`);
		} else {
			await notify(
				pool,
				"WEBHOOK_CHANNEL",
				`[CANDLE-SAVE] ${i18n.getMessage("CANDLE_SAVE_DB_ERROR")}\n`,
			);
		}
	}
}

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	webhook.send("🛑 서비스 종료 신호 수신");
	await pool.end();
	process.exit(0);
}

await setup();

cron.schedule("*/3 * * * * *", async () => {
	try {
		await fetchAndSaveCandles();
		if (process.env.NODE_ENV === "development") {
			console.log(
				`[${new Date().toISOString()}] [CANDLE-SAVE] ${i18n.getMessage(
					"CANDLE_SAVE_NORMAL_COLLECTING",
				)}`,
			);
		}
	} catch (error: unknown) {
		if (!IS_CANDLE_ERROR_SENT) {
			IS_CANDLE_ERROR_SENT = true;
			if (error instanceof Error) {
				await notify(
					pool,
					"WEBHOOK_CHANNEL",
					`[CANDLE-SAVE] ${error.message}\n`,
				);
			} else {
				await notify(
					pool,
					"WEBHOOK_CHANNEL",
					`[CANDLE-SAVE] ${i18n.getMessage("CANDLE_SAVE_API_ERROR")}\n`,
				);
			}
		}
	}
});

cron.schedule("0 0 8-21 * * *", () => {
	notify(pool, "WEBHOOK_CHANNEL", i18n.getMessage("CHECK_MESSAGE"));
});

cron.schedule(process.env.CANDLE_SAVE_INTERVAL || "0 */5 * * * *", () => {
	IS_CANDLE_ERROR_SENT = false;
});

process.stdin.resume();

process.on("uncaughtException", (error) => {
	console.error("예상치 못한 에러:", error);
	webhook.send("⚠️ 예상치 못한 에러 발생");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("처리되지 않은 Promise 거부:", reason);
	webhook.send("⚠️ 처리되지 않은 Promise 거부 발생");
});

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
