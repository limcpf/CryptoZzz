import cron from "node-cron";
import type { Pool, PoolClient } from "pg";
import { getConnection, notify } from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import type { iCandle } from "../../shared/interfaces/iCandle";
import type { iStrategyInfo } from "../../shared/interfaces/iStrategy";
import API from "../../shared/services/api";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { developmentLog, errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";

/** 전역변수 */
let pool: Pool;
let client: PoolClient;
let IS_CANDLE_ERROR_SENT = false;
let COIN = "";

const loggerPrefix = `[CANDLE-SAVE_${process.env.CRYPTO_CODE}]`;

/**
 * @name setup
 * @description Setup
 */
async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		client.on("error", (err: unknown) => {
			errorHandler(client, "DB_CONNECTION_ERROR", loggerPrefix, err);
		});

		setupProcessHandlers({
			loggerPrefix,
			pool,
			client,
		});

		IS_CANDLE_ERROR_SENT = false;
		COIN = (process.env.CRYPTO_CODE || "BTC").replace("KRW-", "");

		setupCronJobs();
		checkAndSendStatus();

		logger.warn(client, "CANDLE_COLLECTING_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("CANDLE_SAVE_START_ERROR")}_${process.env.CRYPTO_CODE} ${error.message}`,
			);
		} else {
			webhook.send(
				`${loggerPrefix} ${getMsg("CANDLE_SAVE_START_ERROR")}_${process.env.CRYPTO_CODE}`,
			);
		}
		process.exit(1);
	}
}

function setupCronJobs() {
	cron.schedule(`${process.env.TIME} * * * * *`, () => fetchAndSaveCandles());

	// 코인 상태 체크 크론
	cron.schedule("*/15 8-21 * * *", () => sendCoinStatus(COIN));

	// 상태 체크 크론
	cron.schedule(`${process.env.TIME} * * * *`, checkAndSendStatus);

	// 에러 플래그 초기화 크론
	cron.schedule(process.env.CANDLE_SAVE_INTERVAL || "0 */5 * * * *", () => {
		IS_CANDLE_ERROR_SENT = false;
	});
}

/**
 * @name fetchAndSaveCandles
 * @description 캔들 데이터를 가져와서 저장하는 핵심 로직
 * @param count 가져올 캔들의 수
 */
async function fetchAndSaveCandles(count = 1) {
	try {
		const data = await API.GET_CANDLE_DATA(
			process.env.CRYPTO_CODE || "",
			count,
			new Date(Date.now() - 60 * 1000).toISOString(),
		);

		const result = await saveCandleData(data);
	} catch (error: unknown) {
		errorHandler(client, "CANDLE_SAVE_API_ERROR", loggerPrefix, error);
	}
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
				client.query<iCandle>(QUERIES.INSERT_MARKET_DATA, [
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

		developmentLog(
			`[${new Date().toLocaleString()}] ${loggerPrefix} ${getMsg(
				"CANDLE_SAVE_NORMAL_COLLECTING",
			)}`,
		);

		// KST 시간 계산
		const kstTime = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9
		const hour = kstTime.getUTCHours();
		const minute = kstTime.getUTCMinutes();

		// TODO : 후에 레디스 도입 후에 상태값으로 막자...
		if (!(hour === 0 && minute < 15)) {
			notify(client, CHANNEL.ANALYZE_CHANNEL, `${process.env.CRYPTO_CODE}`);
		}
	} catch (error: unknown) {
		errorHandler(client, "CANDLE_SAVE_DB_ERROR", loggerPrefix, error);
	}
}

async function sendCoinStatus(coin: string) {
	const status = await API.GET_ACCOUNT_STATUS(coin);

	if (!status.haveCrypto) return;

	const currentPriceQuery = await client.query<{ close_price: number }>(
		QUERIES.GET_CURRENT_PRICE,
		[process.env.CRYPTO_CODE || ""],
	);
	const { close_price } = currentPriceQuery.rows[0];

	const evaluationAmount = status.cryptoBalance * close_price;

	if (evaluationAmount < 1) return;

	const fluctuationRate = Number(
		(
			((close_price - status.cryptoBuyPrice) / status.cryptoBuyPrice) *
			100
		).toFixed(2),
	);

	webhook.send(`
### [현재 ${coin} 등락율 ${fluctuationRate > 0 ? "🔼😊" : "🔽😢"} ${fluctuationRate}%🔍]
**평균 매수 금액**: ${status.cryptoBuyPrice}
**총 매수 금액**: ${status.cryptoEvalAmount}
**현재 평가 금액**: ${evaluationAmount}
	`);
}

async function checkAndSendStatus() {
	try {
		const strategyQuery = await client.query<iStrategyInfo>(
			QUERIES.GET_LATEST_STRATEGY,
			[process.env.CRYPTO_CODE || ""],
		);
		const strategy = strategyQuery.rows[0];

		if (strategy) {
			webhook.send(
				`
### [${process.env.CRYPTO_CODE} 분석 정보 🔍]
**기준 시간**: ${strategy.hour_time}
**RSI**: ${strategy.rsi}
**단기 MA**: ${strategy.short_ma}
**장기 MA**: ${strategy.long_ma}
**현재 거래량**: ${strategy.current_volume}
**평균 거래량**: ${strategy.avg_volume}`,
			);
		}
	} catch (error: unknown) {
		errorHandler(client, "CHECK_STATUS_ERROR", loggerPrefix, error);
	}
}

const init = async () => {
	await setup();
};

init().catch((error) => {
	webhook.send(
		`${loggerPrefix} ${getMsg("CANDLE_SAVE_START_ERROR")}_${process.env.CRYPTO_CODE} ${error.message}`,
	);
	process.exit(1);
});
