import { sleepSync } from "bun";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
	createPool,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import webhook from "../../shared/services/webhook";
import { Signal } from "../../strategy/iStrategy";
import { checkAccountStatus } from "./services/check-account-status";
import { executeBuySignal, executeSellSignal } from "./signals";

export const developmentLog =
	process.env.NODE_ENV === "development" ? console.log : () => {};

let isRunning = false;
const loggerPrefix = "[ANALYZE]";

/**
 * @name pool
 * @description Database Pool
 */
const pool = createPool();
let client: PoolClient;

const MAX_RECONNECT_ATTEMPTS = 5;
let reconnectAttempts = 0;

async function setup() {
	try {
		client = await pool.connect();
		await setupPubSub(client, [CHANNEL.ANALYZE_CHANNEL]);
		handleNotifications(client, async (msg) => {
			if (msg.channel.toUpperCase() === CHANNEL.ANALYZE_CHANNEL) {
				if (isRunning) return;
				isRunning = true;
				await main();
			}
		});

		logger.warn("ANALYZE_START", loggerPrefix);

		// 연결 에러 핸들링 추가
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

		// 연결 성공시 재시도 카운트 초기화
		reconnectAttempts = 0;
	} catch (error) {
		logger.error("RECONNECT_ERROR", loggerPrefix);
		sleepSync(5000);
	}
}

async function main() {
	try {
		if (await checkAccountStatus()) {
			if ((await executeBuySignal(pool)) === Signal.BUY) {
				notify(pool, CHANNEL.TRADING_CHANNEL, "BUY");
			}
		} else {
			if ((await executeSellSignal(pool)) === Signal.SELL) {
				notify(pool, CHANNEL.TRADING_CHANNEL, "SELL");
			}
		}
	} catch (error: unknown) {
		if (error instanceof Error) {
			logger.error("UNEXPECTED_ERROR", loggerPrefix, error.message);
		} else {
			logger.error("UNEXPECTED_ERROR", loggerPrefix);
		}
	} finally {
		isRunning = false;
	}
}

await setup();

process.stdin.resume();

process.on("uncaughtException", (error) => {
	logger.error(
		"UNEXPECTED_ERROR",
		`${loggerPrefix} ${uuidv4()}`,
		error.message,
	);
});

process.on("unhandledRejection", (reason, promise) => {
	if (reason instanceof Error) {
		logger.error(
			"UNEXPECTED_ERROR",
			`${loggerPrefix} ${uuidv4()}`,
			reason.message,
		);
	} else if (typeof reason === "string") {
		logger.error("UNEXPECTED_ERROR", `${loggerPrefix} ${uuidv4()}`, reason);
	} else {
		logger.error(
			"UNEXPECTED_ERROR",
			`${loggerPrefix} ${uuidv4()}`,
			"unhandledRejection",
		);
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

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
