import type { Notification, Pool, PoolClient } from "pg";
import {
	getConnection,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import type { iTradingSignal } from "../../shared/interfaces/iTrading";
import API from "../../shared/services/api";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";
import { excuteBuy } from "./orders/buy.order";
import { excuteSell } from "./orders/sell.order";
import { getAccountBalance } from "./services/getAccountBalance";

let pool: Pool;
let client: PoolClient;
let isRunning = false;

/**
 * 현재 포지션
 * BUY: 매수
 * SELL: 매도
 * NONE: 포지션이 없는 상태
 */
let currentPosition: "BUY" | "SELL" | "NONE" = "NONE";
let KRWBalance = 0;
let coinBalance = 0;

// 시장 상태 타입 정의
type MarketCondition = keyof typeof CONDITION_WEIGHTS;

// 가중치 상수 객체
const CONDITION_WEIGHTS = {
	STRONG_UPTREND: { buy: 0.8, sell: 1.2, profitTake: 1.5 },
	WEAK_UPTREND: { buy: 0.9, sell: 1.1, profitTake: 1.2 },
	SIDEWAYS: { buy: 1.0, sell: 1.0, profitTake: 1.0 },
	WEAK_DOWNTREND: { buy: 1.1, sell: 0.9, profitTake: 0.8 },
	STRONG_DOWNTREND: { buy: 1.2, sell: 0.8, profitTake: 0.5 },
} as const;
const BASE_BUY = Number(process.env.BASE_BUY) || 2.5;
const BASE_SELL = Number(process.env.BASE_SELL) || -2.5;
const MAX_BUY_THRESHOLD = Number(process.env.MAX_BUY_THRESHOLD) || 5.0;
// 손절매 임계값 추가 (-5%)
const STOP_LOSS_THRESHOLD = Number(process.env.STOP_LOSS_THRESHOLD) || -2.0;
// 익절매 임계값 추가 (+10%)
const PROFIT_TAKE_THRESHOLD = Number(process.env.PROFIT_TAKE_THRESHOLD) || 5.0;
// 최대 매수 비율 상수 추가 (50%)
const MAX_POSITION_RATIO = 0.5;

const tradingUuids = new Map<string, string>();

const loggerPrefix = "[TRADING]";

async function notifyCallback(msg: Notification) {
	switch (msg.channel.toUpperCase()) {
		case CHANNEL.TRADING_CHANNEL:
			if (isRunning) return;

			isRunning = true;

			await executeOrder(msg.payload as string);
			break;
		default:
			break;
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		await setupPubSub(client, [CHANNEL.TRADING_CHANNEL]);

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

		logger.warn(client, "TRADING_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("TRADING_SERVICE_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${getMsg("TRADING_SERVICE_START_ERROR")}`);
		}
		process.exit(1);
	}
}

async function executeOrder(payload: string) {
	const { coin, score } = JSON.parse(payload) as iTradingSignal;

	if (!coin) {
		logger.error(client, "COIN_NOT_FOUND", loggerPrefix);
		return;
	}

	try {
		const avgBuyPrice = await checkPosition(coin);
		const thresholds = await calculateDynamicThreshold(client, coin);

		const currentPrices = await API.GET_CANDLE_DATA(
			coin,
			1,
			new Date().toISOString(),
		);

		const currentPrice = currentPrices[0].candle_acc_trade_price;

		switch (currentPosition) {
			case "SELL":
			case "NONE":
				if (score >= thresholds.buy) {
					// 비선형 가중치 조정 (하이퍼볼릭 탄젠트 함수 적용)
					const normalizedScore =
						(score - thresholds.buy) / (thresholds.max - thresholds.buy);
					const buyRatio = Math.tanh(normalizedScore * 2) * MAX_POSITION_RATIO;
					const adjustedAmount =
						KRWBalance * Math.min(buyRatio, MAX_POSITION_RATIO);

					// 최소 주문 금액 검증 (10,000원 이상)
					const MIN_ORDER_AMOUNT = 10000;
					if (adjustedAmount < MIN_ORDER_AMOUNT) {
						logger.error(client, "MIN_ORDER_AMOUNT_ERROR", loggerPrefix);
						return;
					}

					const uuid = await excuteBuy(client, coin, adjustedAmount);
					tradingUuids.set(coin, uuid);
				}
				break;
			case "BUY": {
				if (!avgBuyPrice)
					throw new Error(String(getMsg("AVG_BUY_PRICE_NOT_FOUND")));

				const priceChangePercentage =
					((avgBuyPrice - currentPrice) / currentPrice) * 100;

				const shouldSell =
					score <= thresholds.sell ||
					priceChangePercentage <= STOP_LOSS_THRESHOLD ||
					priceChangePercentage >= thresholds.profitTake;

				if (shouldSell) {
					const sellReason =
						priceChangePercentage <= STOP_LOSS_THRESHOLD
							? "STOP_LOSS_TRIGGERED"
							: priceChangePercentage >= thresholds.profitTake
								? "PROFIT_TAKE_TRIGGERED"
								: "REGULAR_SELL";

					logger.warn(
						client,
						sellReason,
						loggerPrefix,
						JSON.stringify({
							coin,
							avgBuyPrice,
							currentPrice,
							changePercentage: priceChangePercentage.toFixed(2),
							profitTakeThreshold: thresholds.profitTake,
						}),
					);

					await excuteSell(client, coin, coinBalance, tradingUuids.get(coin));
					tradingUuids.delete(coin);
				}
				break;
			}
		}
	} catch (error: unknown) {
		errorHandler(client, "TRADING_EXCUTE_ORDER_ERROR", loggerPrefix, error);
	}
}

async function checkPosition(coin: string) {
	try {
		const balances = await getAccountBalance(client, [
			process.env.UNIT || "KRW",
			coin,
		]);

		const coinAccount = balances.find((balance) => balance.coin === coin);

		KRWBalance =
			balances.find((balance) => balance.coin === "KRW")?.balance || 0;
		coinBalance = coinAccount?.balance || 0;

		if (coinBalance > 0) {
			currentPosition = "BUY";
		} else if (KRWBalance > 0) {
			currentPosition = "SELL";
		} else if (KRWBalance <= 0 && coinBalance <= 0) {
			currentPosition = "NONE";
		}

		if (currentPosition === "BUY") {
			return coinAccount?.avg_buy_price;
		}
	} catch (error: unknown) {
		throw new Error(String(getMsg("GET_CURRENT_POSITION_ERROR")));
	}
}

async function calculateDynamicThreshold(
	client: PoolClient,
	coin: string,
): Promise<{ buy: number; sell: number; max: number; profitTake: number }> {
	try {
		// 1. 장기적 추세 분석용 RSI (90 period)
		const longTermRsi = await getRsi(client, coin, 90);

		// 2. 단기적 과매수/과매도 분석용 RSI (14 period)
		const shortTermRsi = await getRsi(client, coin, 14);

		// 3. RSI 기반 시장 상태 분류
		const marketCondition = classifyMarket(longTermRsi, shortTermRsi);

		const weights = CONDITION_WEIGHTS[marketCondition];

		return {
			buy: BASE_BUY * weights.buy,
			sell: BASE_SELL * weights.sell,
			max: MAX_BUY_THRESHOLD * weights.buy,
			profitTake: PROFIT_TAKE_THRESHOLD * weights.profitTake,
		};
	} catch (error: unknown) {
		throw new Error(String(getMsg("CALCULATE_THRESHOLD_ERROR")));
	}
}

// RSI 조회 헬퍼 함수
async function getRsi(client: PoolClient, coin: string, period: number) {
	const result = await client.query<{ rsi: number }>(QUERIES.GET_RSI_ANALYSIS, [
		coin,
		period,
	]);
	return result.rows[0]?.rsi || 50;
}

// 시장 상태 분류 함수
function classifyMarket(longRsi: number, shortRsi: number): MarketCondition {
	const longTermStrength = Math.abs(longRsi - 50) / 50; // 장기 추세 강도
	const shortTermStrength = Math.abs(shortRsi - 50) / 50; // 단기 추세 강도

	// 장/단기 모두 강한 추세를 보일 때
	if (longTermStrength > 0.3 && shortTermStrength > 0.4) {
		return longRsi > 50 && shortRsi > 50
			? "STRONG_UPTREND"
			: "STRONG_DOWNTREND";
	}

	// 장기는 약하고 단기가 강할 때
	if (longTermStrength > 0.1 && shortTermStrength > 0.3) {
		return longRsi > 50 && shortRsi > 50 ? "WEAK_UPTREND" : "WEAK_DOWNTREND";
	}

	return "SIDEWAYS";
}

await setup();
