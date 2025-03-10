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
import i18n from "../../shared/services/i18n";
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
let currentPosition: "BUY" | "WAIT" | "NONE" = "NONE";
let KRWBalance = "0";
let coinBalance = "0";
const tradingUuids = new Map<string, string>();

// 시장 상태 타입 정의
type MarketCondition = keyof typeof CONDITION_WEIGHTS;

// Threshold 인터페이스 추가
interface IThreshold {
	buy: number;
	sell: number;
	max: number;
	profitTake: number;
	stopLoss: number;
}

// 가중치 상수 객체
const CONDITION_WEIGHTS = {
	STRONG_UPTREND: { buy: 0.8, sell: 1.2, profitTake: 1.5, stopLoss: 1.2 },
	WEAK_UPTREND: { buy: 0.9, sell: 1.1, profitTake: 1.2, stopLoss: 1.1 },
	SIDEWAYS: { buy: 1.0, sell: 1.0, profitTake: 1.0, stopLoss: 1.0 },
	WEAK_DOWNTREND: { buy: 1.1, sell: 0.9, profitTake: 0.8, stopLoss: 0.9 },
	STRONG_DOWNTREND: { buy: 1.2, sell: 0.8, profitTake: 0.5, stopLoss: 0.8 },
} as const;
const BASE_BUY = Number(process.env.BASE_BUY) || 1.5;
const BASE_SELL = Number(process.env.BASE_SELL) || -1.5;
const MAX_BUY_THRESHOLD = Number(process.env.MAX_BUY_THRESHOLD) || 5.0;
// 손절매 임계값 추가 (-5%)
const STOP_LOSS_THRESHOLD = Number(process.env.STOP_LOSS_THRESHOLD) || -2.0;
// 익절매 임계값 추가 (+10%)
const PROFIT_TAKE_THRESHOLD = Number(process.env.PROFIT_TAKE_THRESHOLD) || 5.0;
// 최대 매수 비율 상수 추가 (50%)
const MAX_POSITION_RATIO = 0.5;

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
				`${loggerPrefix} ${i18n.getMessage("TRADING_SERVICE_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(
				`${loggerPrefix} ${i18n.getMessage("TRADING_SERVICE_START_ERROR")}`,
			);
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
		const currentPrices = await API.GET_CANDLE_DATA(
			coin,
			1,
			new Date().toISOString(),
		);
		const currentPrice = currentPrices[0].trade_price;
		const avgBuyPrice = await checkPosition(coin, currentPrice);
		const thresholds = await calculateDynamicThreshold(client, coin);

		switch (currentPosition) {
			case "WAIT":
				await handleWaitPosition(score, thresholds, coin);
				break;
			case "BUY":
				await handleBuyPosition(
					avgBuyPrice,
					currentPrice,
					score,
					thresholds,
					coin,
				);
				break;
			case "NONE":
				break;
		}
	} catch (error: unknown) {
		errorHandler(client, "TRADING_EXCUTE_ORDER_ERROR", loggerPrefix, error);
	} finally {
		isRunning = false;
	}
}

async function handleWaitPosition(
	score: number,
	thresholds: IThreshold,
	coin: string,
) {
	if (score >= thresholds.buy) {
		const normalizedScore =
			(score - thresholds.buy) / (thresholds.max - thresholds.buy);
		const rawBuyRatio = Math.tanh(normalizedScore * 2) * MAX_POSITION_RATIO;

		const MIN_BUY_RATIO = 0.3;
		const buyRatio = Math.min(
			MAX_POSITION_RATIO,
			Math.max(rawBuyRatio, MIN_BUY_RATIO),
		);

		const adjustedAmount = Number(KRWBalance) * buyRatio;
		const MIN_ORDER_AMOUNT = 5000;

		if (adjustedAmount < MIN_ORDER_AMOUNT) {
			logger.error(client, "MIN_ORDER_AMOUNT_ERROR", loggerPrefix);
			return;
		}

		const uuid = await excuteBuy(
			client,
			coin,
			adjustedAmount,
			score,
			thresholds.buy,
		);
		tradingUuids.set(coin, uuid);
	}
}

async function handleBuyPosition(
	avgBuyPrice: number | undefined,
	currentPrice: number,
	score: number,
	thresholds: IThreshold,
	coin: string,
) {
	if (!avgBuyPrice) {
		throw new Error(i18n.getMessage("AVG_BUY_PRICE_NOT_FOUND"));
	}

	const priceChangePercentage =
		((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;

	const shouldSell =
		score <= thresholds.sell ||
		priceChangePercentage <= thresholds.stopLoss ||
		priceChangePercentage >= thresholds.profitTake;

	if (shouldSell) {
		const sellReason =
			priceChangePercentage <= thresholds.stopLoss
				? "STOP_LOSS_TRIGGERED"
				: priceChangePercentage >= thresholds.profitTake
					? "PROFIT_TAKE_TRIGGERED"
					: "REGULAR_SELL";

		logger.warn(client, sellReason, loggerPrefix);

		await excuteSell(client, coin, coinBalance, tradingUuids.get(coin) || "");
	}
}

async function checkPosition(coin: string, currentPrice: number) {
	try {
		const coinName = coin.replaceAll("KRW-", "");
		const unit = process.env.UNIT || "KRW";

		const balances = await getAccountBalance([unit, coinName]);
		const coinAccount = balances.find((balance) => balance.coin === coinName);

		KRWBalance =
			balances.find((balance) => balance.coin === "KRW")?.balance || "0";
		coinBalance = coinAccount?.balance || "0";
		const numKRWBalance = Number(KRWBalance);
		const numCoinBalance = Number(coinBalance);

		const coinValue = numCoinBalance * currentPrice;
		const MIN_COIN_VALUE = 100;

		if (numCoinBalance > 0 && coinValue >= MIN_COIN_VALUE) {
			currentPosition = "BUY";
		} else if (numKRWBalance > 0) {
			currentPosition = "WAIT";
		} else if (
			numKRWBalance <= 0 &&
			(numCoinBalance <= 0 || coinValue < MIN_COIN_VALUE)
		) {
			currentPosition = "NONE";
		}

		return currentPosition === "BUY" ? coinAccount?.avg_buy_price : undefined;
	} catch (error: unknown) {
		throw new Error(i18n.getMessage("GET_CURRENT_POSITION_ERROR"));
	}
}

async function calculateDynamicThreshold(
	client: PoolClient,
	coin: string,
): Promise<IThreshold> {
	try {
		// 1. 장기적 추세 분석용 RSI (14 period)
		const longTermRsi = await getRsi(client, coin, 14);

		// 2. 단기적 과매수/과매도 분석용 RSI (9 period)
		const shortTermRsi = await getRsi(client, coin, 9);
		// 3. RSI 기반 시장 상태 분류
		const marketCondition = classifyMarket(longTermRsi, shortTermRsi);

		const weights = CONDITION_WEIGHTS[marketCondition];

		return {
			buy: BASE_BUY * weights.buy,
			sell: BASE_SELL * weights.sell,
			max: MAX_BUY_THRESHOLD * weights.buy,
			profitTake: PROFIT_TAKE_THRESHOLD * weights.profitTake,
			stopLoss: STOP_LOSS_THRESHOLD * weights.stopLoss,
		};
	} catch (error: unknown) {
		console.error(error);
		throw new Error(i18n.getMessage("CALCULATE_THRESHOLD_ERROR"));
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
