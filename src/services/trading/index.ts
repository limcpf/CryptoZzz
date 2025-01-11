import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import {
	createPool,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
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

		// 연결 에러 핸들링 추가
		client.on("error", async (err) => {
			console.error(
				`[${new Date().toLocaleString()}] [TRADING] ⚠️ 데이터베이스 연결 에러: ${err}`,
			);
			webhook.send("[TRADING] ⚠️ DB 연결 에러 발생");
			await reconnect();
		});
	} catch (error) {
		console.error(
			`[${new Date().toLocaleString()}] [TRADING] ⚠️ 초기 설정 중 에러: ${error}`,
		);
		await reconnect();
	}
}

async function reconnect() {
	try {
		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error(
				`[${new Date().toLocaleString()}] [TRADING] ⚠️ 최대 재연결 시도 횟수(${MAX_RECONNECT_ATTEMPTS}회) 초과`,
			);
			webhook.send(
				`[TRADING] ⚠️ DB 연결 실패 - ${MAX_RECONNECT_ATTEMPTS}회 재시도 후 서비스를 종료합니다.`,
			);
			await handleGracefulShutdown();
			return;
		}

		reconnectAttempts++;
		console.log(
			`[${new Date().toLocaleString()}] [TRADING] 🔄 DB 재연결 시도 ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`,
		);

		if (client) {
			await client.release();
		}
		await setup();

		reconnectAttempts = 0;
	} catch (error) {
		console.error(
			`[${new Date().toLocaleString()}] [TRADING] ⚠️ 재연결 중 에러: ${error}`,
		);
		setTimeout(reconnect, 5000);
	}
}

/**
 * @name executeOrder
 * @description 매수/매도 주문 실행
 * @param signal 매수/매도 신호
 */
async function executeOrder(signal: string) {
	const account = await API.GET_ACCOUNT();
	const krwAccount = account.find((acc) => acc.currency === "KRW");
	const btcAccount = account.find((acc) => acc.currency === "BTC");

	if (signal === "BUY" && krwAccount) {
		const availableKRW = Number(krwAccount.balance);
		if (availableKRW < 10000) {
			webhook.send("⚠️ 매수 가능한 KRW 잔액이 부족합니다.");
			return;
		}

		try {
			const order = await API.ORDER(
				"KRW-BTC",
				"bid",
				"",
				availableKRW.toString(),
				"price",
			);

			// 주문 정보 데이터베이스에 저장
			const insertResult = await client.query<{ id: string }>(
				QUERIES.INSERT_ORDER,
				[order.market, order.price, order.volume, "BUY"],
			);

			developmentLog(
				`[${new Date().toLocaleString()}] [TRADING] 매수 주문 실행: ${availableKRW}KRW`,
			);
			webhook.send(`✅ 매수 주문 실행: ${availableKRW}KRW`);
		} catch (error) {
			if (error instanceof Error) {
				webhook.send(`⚠️ 매수 주문 실패: ${error.message}`);
			}
		} finally {
			isRunning = false;
		}
	} else if (signal === "SELL" && btcAccount) {
		const availableBTC = Number(btcAccount.balance);
		if (availableBTC < 0.00001) {
			webhook.send("⚠️ 매도 가능한 BTC 잔액이 부족합니다.");
			return;
		}

		try {
			// TODO: 실제 거래소 API를 통한 시장가 매도 주문 실행
			const order = await API.ORDER(
				"KRW-BTC",
				"ask",
				availableBTC.toString(),
				"",
				"market",
			);

			const uuid = order.uuid;

			// 주문 정보 데이터베이스에 저장
			const result = await client.query(QUERIES.UPDATE_ORDER, [
				uuid,
				order.price,
				"SELL",
			]);

			const { id, quantity, buy_price, sell_price } = result.rows[0];

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
				`[${new Date().toLocaleString()}] [TRADING] 매도 주문 실행: ${availableBTC}BTC`,
			);
			webhook.send(`✅ 매도 주문 실행: ${availableBTC}BTC`);
		} catch (error) {
			if (error instanceof Error) {
				webhook.send(`⚠️ 매도 주문 실패: ${error.message}`);
			}
		} finally {
			isRunning = false;
		}
	}
}

await setup();

process.stdin.resume();

process.on("uncaughtException", (error) => {
	const uuid = uuidv4();
	console.error(`[${new Date().toLocaleString()}] ⚠️ ${uuid} ${error}`);
	webhook.send(` [TRADING] ⚠️ 예상치 못한 에러 발생 : ${uuid}`);
});

process.on("unhandledRejection", (reason, promise) => {
	const uuid = uuidv4();
	console.error(`[${new Date().toLocaleString()}] ⚠️ ${uuid} ${reason}`);
	webhook.send(`[TRADING] ⚠️ 처리되지 않은 Promise 거부 발생 : ${uuid}`);
});

/**
 * @name handleGracefulShutdown
 * @description 프로세스 종료 처리를 위한 공통 함수
 */
async function handleGracefulShutdown() {
	webhook.send("[TRADING] 🛑 서비스 종료 신호 수신");
	await pool.end();
	process.exit(0);
}

// SIGINT (Ctrl+C)와 SIGTERM 모두 동일한 종료 처리
process.on("SIGINT", handleGracefulShutdown);
process.on("SIGTERM", handleGracefulShutdown);
