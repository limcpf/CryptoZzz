import cron from "node-cron";
import {
	createPool,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import API_URL from "../../shared/const/api.const";
import { CHANNEL } from "../../shared/const/channel.const";
import { getMsg } from "../../shared/const/i13n/msg.const";
import { CANDLE_SAVE_QUERY } from "../../shared/const/query/candle-save";
import type { Candle } from "../../shared/types/Candle.type";
import { webhookFactory } from "../../shared/utils/webhook/webhook.factory";

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
 * @name msg
 * @description Message
 */
const msg = getMsg(process.env.LANGUAGE || "ko");

/**
 * @name webhook
 * @description Webhook
 */
const webhook = webhookFactory();

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
			`[CANDLE-SAVE] ${msg.CANDLE_SAVE_API_ERROR} : ${response.status}`,
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
				`[CANDLE-SAVE] ${msg.CANDLE_SAVE_DB_ERROR}\n`,
			);
		}
	}
}

/**
 * @name main
 * @description Main
 */
async function main() {
	await setup();

	cron.schedule("*/3 * * * * *", async () => {
		try {
			await fetchAndSaveCandles();
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
						`[CANDLE-SAVE] ${msg.CANDLE_SAVE_API_ERROR}\n`,
					);
				}
			}
		}
	});

	cron.schedule("0 0 8-21 * * *", () => {
		notify(pool, "WEBHOOK_CHANNEL", msg.CHECK_MESSAGE);
	});

	cron.schedule(process.env.CANDLE_SAVE_INTERVAL || "0 */5 * * * *", () => {
		IS_CANDLE_ERROR_SENT = false;
	});

	process.on("SIGINT", async () => {
		webhookFactory().send(msg.SERVER_OFF_MESSAGE);
		await pool.end();
		process.exit();
	});
}

main();
