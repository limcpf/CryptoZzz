import cron from "node-cron";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { createPool, notify } from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
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
let client: PoolClient;

const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

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
	try {
		IS_CANDLE_ERROR_SENT = false;
		client = await pool.connect();
		await client.query(QUERIES.INIT);

		// 연결 에러 핸들링 추가
		client.on("error", async (err) => {
			console.error(
				`[${new Date().toISOString()}] [CANDLE-SAVE] ⚠️ 데이터베이스 연결 에러: ${err}`,
			);
			webhook.send("[CANDLE-SAVE] ⚠️ DB 연결 에러 발생");
			await reconnect();
		});
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] [CANDLE-SAVE] ⚠️ 초기 설정 중 에러: ${error}`,
		);
		await reconnect();
	}
}

async function reconnect() {
	try {
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error(
				`[${new Date().toISOString()}] [CANDLE-SAVE] ⚠️ 최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}회) 초과`,
			);
			webhook.send(
				`[CANDLE-SAVE] ⚠️ DB 연결 실패 - ${MAX_RECONNECT_ATTEMPTS}회 재시도 후 서비스를 종료합니다.`,
			);
			await handleGracefulShutdown();
			return;
		}

		reconnectAttempts++;
		console.log(
			`[${new Date().toISOString()}] [CANDLE-SAVE] 🔄 DB 재연결 시도 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
		);

		if (client) {
			await client.release();
		}
		await setup();

		reconnectAttempts = 0;
	} catch (error) {
		console.error(
			`[${new Date().toISOString()}] [CANDLE-SAVE] ⚠️ 재연결 중 에러: ${error}`,
		);
		setTimeout(reconnect, 5000);
	}
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
	console.error(`[${new Date().toISOString()}] ⚠️ ${uuid} ${error}`);
	webhook.send(`[CANDLE-SAVE] ⚠️ 예상치 못한 에러 발생 : ${uuid}`);
});

process.on("unhandledRejection", (reason, promise) => {
	const uuid = uuidv4();
	console.error(`[${new Date().toISOString()}] ⚠️ ${uuid} ${reason}`);
	webhook.send(`[CANDLE-SAVE] ⚠️ 처리되지 않은 Promise 거부 발생 : ${uuid}`);
});

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
