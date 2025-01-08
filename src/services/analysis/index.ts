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

/**
 * @name client
 * @description Database Client
 */
const client = await pool.connect();

async function setup() {
	await setupPubSub(client, [CHANNEL.ANALYZE_CHANNEL]);
	handleNotifications(client, (msg) => {
		if (msg.channel.toUpperCase() === CHANNEL.ANALYZE_CHANNEL) {
			if (isRunning) return;
			isRunning = true;
			main();
		}
	});
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
		console.error(error);
	} finally {
		isRunning = false;
	}
}

await setup();

process.stdin.resume();

process.on("uncaughtException", (error) => {
	console.error("예상치 못한 에러:", error);
	webhook.send("⚠️ 예상치 못한 에러 발생");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("처리되지 않은 Promise 거부:", reason);
	webhook.send("⚠️ 처리되지 않은 Promise 거부 발생");
});

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	webhook.send(
		`[${new Date().toISOString()}] [ANALYZE] 🛑 서비스 종료 신호 수신`,
	);
	await pool.end();
	process.exit(0);
}

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
