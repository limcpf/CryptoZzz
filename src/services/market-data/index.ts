import cron from "node-cron";
import { createPool, setupPubSub } from "../../shared/config/database";
import API_URL from "../../shared/const/api.const";
import type { Candle } from "../../shared/types/Candle.type";
import { sendNotifyDiscord } from "../../shared/utils/webhook/webhook.factory";

const pool = createPool();

const CHECK_MESSAGE = "현재 캔들 차트 데이터 정상 수집중입니다.";
const client = await pool.connect();

client.query("LISTEN data_channel");

client.on("notification", (msg) => {
	sendNotifyDiscord(msg.payload ?? "");
});

// OKX REST API Base URL
const BASE_URL = "https://api.upbit.com";

/**
 * @name getCandleData
 * @description Get Candle Data / Execute every 3 seconds / Fetch 3 one-second candles and save data
 * @description 캔들 데이터 가져오기 / 3초마다 실행 / 1초 단위 캔들 3개 가져와서 데이터 저장
 * @param count
 */
async function getCandleData(count = 3) {
	const endpoint = API_URL.GET_CANDLE_DATA(
		process.env.CRYPTO_CODE || "",
		count,
	);

	const url = `${process.env.MARKET_URL}${endpoint}`;

	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json", // JSON 형식 요청
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`);
		}

		const data = (await response.json()) as [Candle, Candle, Candle];
		await saveMarketData(data); // 데이터베이스에 저장
		return data;
	} catch (error) {
		console.error("API 요청 실패:", error);
	}
}

async function saveMarketData(data: Candle[]) {
	try {
		const query = `
			INSERT INTO Market_Data (symbol, timestamp, open_price, high_price, low_price, close_price, volume)
				VALUES ($1, $2, $3, $4, $5, $6, $7)
				ON CONFLICT (symbol, timestamp)
				DO UPDATE
				SET open_price = EXCLUDED.open_price,
					high_price = EXCLUDED.high_price,
					low_price = EXCLUDED.low_price,
					close_price = EXCLUDED.close_price,
					volume = EXCLUDED.volume;
		`;

		await Promise.all(
			data.map((candle) =>
				client.query(query, [
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

		console.log("데이터 저장 완료");
	} catch (error) {
		pool.query(`NOTIFY data_channel, '⚠️ 데이터베이스 저장 실패\n'`);
		console.error("데이터베이스 저장 실패:", error);
	}
}

await setupPubSub(client, ["data_channel"]);

// 기존 크론 작업 유지
cron.schedule("*/3 * * * * *", () => {
	getTickerData();
});

cron.schedule("0 0 8-21 * * *", () => {
	pool.query(`NOTIFY data_channel, '${CHECK_MESSAGE}'`);
});

// 프로그램 종료 시 pool 정리를 위한 이벤트 핸들러 추가
process.on("SIGINT", async () => {
	await pool.end();
	process.exit();
});
