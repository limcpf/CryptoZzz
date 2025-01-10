import cron from "node-cron";
import { v4 as uuidv4 } from "uuid";
import {
	acquireAdvisoryLock,
	createPool,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
import { DATABASE_LOCKS } from "../../shared/const/lock.const";
import { QUERIES } from "../../shared/const/query.const";
import type { iCandle } from "../../shared/interfaces/iCandle";
import API from "../../shared/services/api";
import i18n from "../../shared/services/i18n";
import webhook from "../../shared/services/webhook";

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
	await client.query(QUERIES.INIT);
}

/**
 * @name fetchAndSaveCandles
 * @description 캔들 데이터를 가져와서 저장하는 핵심 로직
 * @param count 가져올 캔들의 수
 */
async function fetchAndSaveCandles(count = 3) {
	const data = await API.GET_CANDLE_DATA(process.env.CRYPTO_CODE || "", count);

	await saveCandleData(data);
}

/**
 * @name saveMarketData
 * @description 캔들 데이터를 데이터베이스에 저장하는 핵심 로직
 * @param data 저장할 캔들 데이터
 */
async function saveCandleData(data: iCandle[]) {
	try {
		await Promise.all(
			data.map((candle) =>
				client.query<iCandle>(QUERIES.UPSERT_MARKET_DATA, [
					candle.market,
					new Date(candle.candle_date_time_kst),
					candle.opening_price,
					candle.high_price,
					candle.low_price,
					candle.trade_price,
					candle.candle_acc_trade_volume,
				]),
			),
		);

		if (process.env.NODE_ENV === "development") {
			console.log(
				`[${new Date().toISOString()}] [CANDLE-SAVE] ${i18n.getMessage(
					"CANDLE_SAVE_NORMAL_COLLECTING",
				)}`,
			);
		}

		notify(pool, CHANNEL.ANALYZE_CHANNEL);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(`[CANDLE-SAVE] ${error.message}`);
		} else {
			webhook.send(`[CANDLE-SAVE] ${i18n.getMessage("CANDLE_SAVE_DB_ERROR")}`);
		}
	}
}

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	webhook.send("[CANDLE-SAVE] 🛑 서비스 종료 신호 수신");
	await pool.end();
	process.exit(0);
}

await setup();

cron.schedule("*/3 * * * * *", async () => {
	try {
		await fetchAndSaveCandles();
	} catch (error: unknown) {
		if (!IS_CANDLE_ERROR_SENT) {
			IS_CANDLE_ERROR_SENT = true;
			if (error instanceof Error) {
				webhook.send(`[CANDLE-SAVE] ${error.message}`);
			} else {
				webhook.send(
					`[CANDLE-SAVE] ${i18n.getMessage("CANDLE_SAVE_API_ERROR")}`,
				);
			}
		}
	}
});

cron.schedule("0 0 8-21 * * *", () => {
	webhook.send(i18n.getMessage("CHECK_MESSAGE"));
});

cron.schedule(process.env.CANDLE_SAVE_INTERVAL || "0 */5 * * * *", () => {
	IS_CANDLE_ERROR_SENT = false;
});

process.stdin.resume();

process.on("uncaughtException", (error) => {
	const uuid = uuidv4();
	console.error(`${uuid} ${error}`);
	webhook.send(`[CANDLE-SAVE] ⚠️ 예상치 못한 에러 발생 : ${uuid}`);
});

process.on("unhandledRejection", (reason, promise) => {
	const uuid = uuidv4();
	console.error(`${uuid} ${reason}`);
	webhook.send(`[CANDLE-SAVE] ⚠️ 처리되지 않은 Promise 거부 발생 : ${uuid}`);
});

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
