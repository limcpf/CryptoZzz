import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
	createPool,
	handleNotifications,
	notify,
	setupPubSub,
} from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
import webhook from "../../shared/services/webhook";
import { Signal } from "../../strategy/iStrategy";
import { checkAccountStatus } from "./services/check-account-status";
import { executeBuySignal, executeSellSignal } from "./signals";

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

		// 연결 에러 핸들링 추가
		client.on("error", async (err) => {
			console.error(
				`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 데이터베이스 연결 에러: ${err}`,
			);
			webhook.send("[ANALYZE] ⚠️ DB 연결 에러 발생");
			await reconnect();
		});
	} catch (error) {
		console.error(
			`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 초기 설정 중 에러: ${error}`,
		);
		await reconnect();
	}
}

async function reconnect() {
	try {
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error(
				`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}회) 초과`,
			);
			webhook.send(
				`[ANALYZE] ⚠️ DB 연결 실패 - ${MAX_RECONNECT_ATTEMPTS}회 재시도 후 서비스를 종료합니다.`,
			);
			await handleGracefulShutdown();
			return;
		}

		reconnectAttempts++;
		console.log(
			`[${new Date().toLocaleString()}] [ANALYZE] 🔄 DB 재연결 시도 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
		);

		if (client) {
			await client.release();
		}
		await setup();

		// 연결 성공시 재시도 카운트 초기화
		reconnectAttempts = 0;
	} catch (error) {
		console.error(
			`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 재연결 중 에러: ${error}`,
		);
		setTimeout(reconnect, 5000);
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
	} catch (error) {
		console.error(`[${new Date().toLocaleString()}] ⚠️ ${error}`);
	} finally {
		isRunning = false;
	}
}

await setup();

process.stdin.resume();

process.on("uncaughtException", (error) => {
	const uuid = uuidv4();
	console.error(
		`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 예상치 못한 에러 발생 : ${uuid}`,
	);
	webhook.send(`[ANALYZE] ⚠️ 예상치 못한 에러 발생 : ${uuid}`);
});

process.on("unhandledRejection", (reason, promise) => {
	const uuid = uuidv4();
	console.error(
		`[${new Date().toLocaleString()}] [ANALYZE] ⚠️ 처리되지 않은 Promise 거부 발생 : ${uuid}`,
	);
	webhook.send(`[ANALYZE] ⚠️ 처리되지 않은 Promise 거부 발생 : ${uuid}`);
});

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	webhook.send("[ANALYZE] 🛑 서비스 종료 신호 수신");
	if (client) {
		await client.release();
	}
	await pool.end();
	process.exit(0);
}

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
