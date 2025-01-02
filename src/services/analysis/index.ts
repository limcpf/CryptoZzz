import { v4 as uuidv4 } from "uuid";
import {
	acquireAdvisoryLock,
	createPool,
	handleNotifications,
	notify,
	releaseAdvisoryLock,
	setupPubSub,
} from "../../shared/config/database";
import { CHANNEL } from "../../shared/const/channel.const";
import { QUERIES } from "../../shared/const/query.const";
import type { iMarketDataResult } from "../../shared/interfaces/iMarketDataResult";
import API from "../../shared/services/api";
import webhook from "../../shared/services/webhook";
import { Signal } from "../../strategy/iStrategy";
import { StrategyFactory } from "../../strategy/strategy.factory";

const developmentLog =
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
					`[${new Date().toISOString()}] [ANALYZE] 알림 수신 후 작업 시작 lock: ${b}`,
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

/**
 * @name checkAccountStatus
 * @description 계좌 상태를 확인하여 매수/매도 상태를 체크하는 함수
 * @returns true : 보유중(매도체크해야함), false : 보유X(매수체크해야함)
 */
async function checkAccountStatus(): Promise<boolean> {
	const account = await API.GET_ACCOUNT();

	const krwAccount = account.find((account) => account.currency === "KRW");
	const btcAccount = account.find((account) => account.currency === "BTC");

	// TODO: 테스트 시에는 테스트 데이터로 처리할 수 있게 수정
	if (btcAccount) {
		developmentLog(btcAccount);

		if (Number(btcAccount.balance) > 0.00001) {
			developmentLog(
				`[${new Date().toISOString()}] [ANALYZE] BTC 보유중입니다. 매도 전략을 실행합니다.`,
			);

			return false;
		}
	}

	if (krwAccount) {
		developmentLog(krwAccount);
		if (Number(krwAccount.balance) > 10000) {
			developmentLog(
				`[${new Date().toISOString()}] [ANALYZE] BTC는 없고, KRW 잔액이 10000원 이상 있습니다. 매수 전략을 실행합니다.`,
			);
			return true;
		}
	}

	throw new Error("매수/매도 전략 실행 조건이 없습니다.");
}

async function getSignal() {
	const analyzeParent = await pool.query<{ id: string }>(
		QUERIES.INSERT_SIGNAL_LOG,
		["KRW-BTC", new Date()],
	);

	const uuid = analyzeParent.rows[0].id;

	if (!uuid) {
		console.error("부모 신호 로그 생성 실패");
		return;
	}

	developmentLog(
		`[${new Date().toISOString()}] [ANALYZE] 부모 신호 로그 생성 성공: ${uuid}`,
	);

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) return;

	let signal: Signal = Signal.HOLD;

	for (const strategy of strategies) {
		const factory = new StrategyFactory(pool);

		const strategyInstance = factory.createStrategy(strategy);

		signal = await strategyInstance.execute(uuid);
	}

	return signal;
}

async function checkSignal() {
	const signal = await getSignal();

	if (signal === Signal.BUY) {
		notify(pool, CHANNEL.TRADING_CHANNEL, "BUY");
	}

	return signal;
}

async function checkSellSignal() {
	const signal = await getSignal();

	if (signal === Signal.SELL) {
		notify(pool, CHANNEL.TRADING_CHANNEL, "SELL");
	}

	return signal;
}

async function main() {
	let signal: Signal = Signal.HOLD;

	if (await checkAccountStatus()) {
		signal = (await checkSellSignal()) || Signal.HOLD;
	} else {
		signal = (await checkSignal()) || Signal.HOLD;
	}

	if (signal === Signal.HOLD) {
		releaseAdvisoryLock(pool, "TRADING");
		developmentLog(
			`[${new Date().toISOString()}] [ANALYZE] HOLD 신호 발생으로 작업 완료 후 잠금 해제`,
		);
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
