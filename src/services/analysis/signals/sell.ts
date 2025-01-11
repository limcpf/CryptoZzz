import type { Pool } from "pg";
import { QUERIES } from "../../../shared/const/query.const";
import API from "../../../shared/services/api";
import { Signal } from "../../../strategy/iStrategy";
import { StrategyFactory } from "../../../strategy/strategy.factory";
import { developmentLog } from "../index";

const TAKE_PROFIT = Number(process.env.TAKE_PROFIT) || 5; // 익절 기준: 5% 이상 수익
const STOP_LOSS = Number(process.env.STOP_LOSS) || -3; // 손절 기준: -3% 이하 손실

export async function executeSellSignal(pool: Pool): Promise<Signal> {
	// 현재 BTC 가격 조회
	const currentPrices = await API.GET_CANDLE_DATA("KRW-BTC", 1);

	if (currentPrices.length === 0) {
		return Signal.HOLD;
	}

	const currentPrice = currentPrices[0];

	// 보유 중인 BTC의 평균 매수가 조회
	const account = await API.GET_ACCOUNT();
	const btcAccount = account.find((acc) => acc.currency === "BTC");

	if (!btcAccount || !btcAccount.avg_buy_price) {
		console.error(
			`[${new Date().toISOString()}] [SELL-SIGNAL] BTC 계좌 정보를 찾을 수 없습니다.`,
		);
		return Signal.HOLD;
	}

	const avgBuyPrice = Number(btcAccount.avg_buy_price);
	const currentPriceNum = Number(currentPrice.trade_price);

	// 수익률 계산 (%)
	const profitRate = ((currentPriceNum - avgBuyPrice) / avgBuyPrice) * 100;

	developmentLog(
		`[${new Date().toISOString()}] [SELL-SIGNAL] 현재 수익률: ${profitRate.toFixed(2)}%`,
	);

	if (profitRate >= TAKE_PROFIT) {
		developmentLog(
			`[${new Date().toISOString()}] [SELL-SIGNAL] 익절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	if (profitRate <= STOP_LOSS) {
		developmentLog(
			`[${new Date().toISOString()}] [SELL-SIGNAL] 손절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	const analyzeParent = await pool.query<{ id: string }>(
		QUERIES.INSERT_SIGNAL_LOG,
		["KRW-BTC", new Date()],
	);

	const uuid = analyzeParent.rows[0].id;

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) return Signal.HOLD;

	const signals = await Promise.all(
		strategies.map(async (strategy) => {
			const factory = new StrategyFactory(pool);
			const strategyInstance = factory.createStrategy(strategy);
			return strategyInstance.execute(uuid);
		}),
	);

	developmentLog(
		`[${new Date().toISOString()}] [SELL-SIGNAL] 신호: ${signals.join(", ")}`,
	);

	return signals.every((signal) => signal === Signal.SELL)
		? Signal.SELL
		: Signal.HOLD;
}
