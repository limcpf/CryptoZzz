import { sleepSync } from "bun";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
	createPool,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import API from "../../shared/services/api";
import webhook from "../../shared/services/webhook";

export const developmentLog =
	process.env.NODE_ENV === "development" ? console.log : () => {};

let isRunning = false;

/**
 * @name pool
 * @description Database Pool
 */
const pool = createPool();
let client: PoolClient;

const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;
const loggerPrefix = "TRADING";

logger.warn("TRADING_SERVICE_START", loggerPrefix);

async function setup() {
	try {
		client = await pool.connect();
		await setupPubSub(client, [CHANNEL.TRADING_CHANNEL]);
		handleNotifications(client, async (msg) => {
			if (msg.channel.toUpperCase() === CHANNEL.TRADING_CHANNEL) {
				if (isRunning) return;
				isRunning = true;
				await executeOrder(msg.payload as string);
			}
		});

		client.on("error", async (err) => {
			logger.error("DB_CONNECTION_ERROR", loggerPrefix);
			await reconnect();
		});
	} catch (error) {
		logger.error("INIT_SETUP_ERROR", loggerPrefix);
		await reconnect();
	}
}

async function reconnect() {
	try {
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			logger.error(
				"DB_CONNECTION_ERROR",
				loggerPrefix,
				`최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}회) 초과`,
			);
			await handleGracefulShutdown();
			return;
		}

		reconnectAttempts++;
		logger.info("RECONNECT_ATTEMPTS", loggerPrefix);

		if (client) {
			await client.release();
		}
		await setup();

		reconnectAttempts = 0;
	} catch (error) {
		logger.error("RECONNECT_ERROR", loggerPrefix);
		sleepSync(5000);
	}
}

/**
 * @name executeOrder
 * @description 매수/매도 주문 실행
 * @param signal ${"SELL" | "BUY"}:${SYMBOL}
 */
async function executeOrder(signal: string) {
	const [signalType, symbol] = signal.split(":");
	const coin = symbol.replace("KRW-", "");

	const account = await API.GET_ACCOUNT();
	const krwAccount = account.find((acc) => acc.currency === "KRW");
	const cryptoAccount = account.find((acc) => acc.currency === coin);

	if (signalType === "BUY" && krwAccount) {
		const availableKRW = Number(krwAccount.balance);
		if (availableKRW < 10000) {
			logger.error("BUY_SIGNAL_ERROR", loggerPrefix);
			return;
		}

		try {
			const order = await API.ORDER(
				symbol,
				"bid",
				"",
				availableKRW.toString(),
				"price",
				uuidv4(),
			);

			const insertResult = await client.query<{ identifier: string }>(
				QUERIES.INSERT_ORDER,
				[order.market, order.price, order.volume, "BUY", order.identifier],
			);

			webhook.send(
				`✅ 매수 주문 실행
                    주문 ID: ${insertResult.rows[0].identifier}
                    수량: ${order.volume}${coin}
                    매수가: ${order.price.toLocaleString()}KRW`,
			);

			developmentLog(
				`[${new Date().toLocaleString()}] [TRADING] 매수 주문 실행: $availableKRWKRW`,
			);

			logger.info("BUY_SIGNAL_SUCCESS", loggerPrefix);
		} catch (error) {
			if (error instanceof Error) {
				logger.error("BUY_SIGNAL_ERROR", loggerPrefix, error.message);
			}
		} finally {
			isRunning = false;
		}
	} else if (signalType === "SELL" && cryptoAccount) {
		const availableCrypto = Number(cryptoAccount.balance);
		if (availableCrypto < 0.00001) {
			logger.error("SELL_SIGNAL_ERROR", loggerPrefix);
			return;
		}

		try {
			const order = await API.ORDER(
				symbol,
				"ask",
				availableCrypto.toString(),
				"",
				"market",
				uuidv4(),
			);

			const lastOrder = await client.query<{ id: string }>(
				QUERIES.GET_LAST_ORDER,
				[symbol],
			);

			const id = lastOrder.rows[0].id;

			const result = await client.query(QUERIES.UPDATE_ORDER, [
				id,
				order.price,
				"SELL",
			]);

			const { quantity, buy_price, sell_price } = result.rows[0];

			const profitAmount = (sell_price - buy_price) * quantity;
			const profitRate = ((sell_price - buy_price) / buy_price) * 100;

			webhook.send(
				`✅ 매도 주문 실행
                    주문 ID: ${id}
                    수량: ${quantity}BTC
                    매수가: ${buy_price.toLocaleString()}KRW
                    매도가: ${sell_price.toLocaleString()}KRW
                    손익금: ${profitAmount.toLocaleString()}KRW (${profitRate.toFixed(2)}%)`,
			);

			developmentLog(
				`[${new Date().toLocaleString()}] [TRADING] 매도 주문 실행: ${availableCrypto}${coin}`,
			);

			logger.info("SELL_SIGNAL_SUCCESS", loggerPrefix);
		} catch (error) {
			if (error instanceof Error) {
				logger.error("SELL_SIGNAL_ERROR", loggerPrefix, error.message);
			}
		} finally {
			isRunning = false;
		}
	}
}

await setup();

process.stdin.resume();

process.on("uncaughtException", (error) => {
	logger.error("UNEXPECTED_ERROR", loggerPrefix, error.message);
});

process.on("unhandledRejection", (reason, promise) => {
	if (reason instanceof Error) {
		logger.error("UNEXPECTED_ERROR", loggerPrefix, reason.message);
	} else if (typeof reason === "string") {
		logger.error("UNEXPECTED_ERROR", loggerPrefix, reason);
	} else {
		logger.error("UNEXPECTED_ERROR", loggerPrefix, "unhandledRejection");
	}
});

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	logger.warn("SERVICE_SHUTDOWN", loggerPrefix);

	if (client) {
		await client.release();
	}

	await pool.end();
	process.exit(0);
}

process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
