import {
	acquireAdvisoryLock,
	createPool,
	handleNotifications,
	notify,
	releaseAdvisoryLock,
	setupPubSub,
} from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
import webhook from "../../shared/services/webhook";
import { Signal } from "../../strategy/iStrategy";
import { checkAccountStatus } from "./services/check-account-status";
import { executeBuySignal, executeSellSignal } from "./signals";

export const developmentLog =
	process.env.NODE_ENV === "development" ? console.log : () => {};

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
			acquireAdvisoryLock(pool, "TRADING").then((b) => {
				developmentLog(
					`[${new Date().toISOString()}] [ANALYZE] 알림 수신 후 작업 시작 lock: ${b ? "성공" : "실패"}`,
				);
				try {
					if (b) main();
				} catch (error) {
					console.error(error);
				}
			});
		}
	});
}

async function main() {
	if (await checkAccountStatus()) {
		if ((await executeBuySignal(pool)) === Signal.BUY) {
			notify(pool, CHANNEL.TRADING_CHANNEL, "BUY");
			return;
		}
	} else {
		if ((await executeSellSignal(pool)) === Signal.SELL) {
			notify(pool, CHANNEL.TRADING_CHANNEL, "SELL");
			return;
		}
	}

	releaseAdvisoryLock(pool, "TRADING");
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
