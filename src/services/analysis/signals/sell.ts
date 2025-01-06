import type { Pool } from "pg";
import API from "../../../shared/services/api";
import { Signal } from "../../../strategy/iStrategy";
import { developmentLog } from "../index";

const TAKE_PROFIT = 5; // 익절 기준: 5% 이상 수익
const STOP_LOSS = -3; // 손절 기준: -3% 이하 손실

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
		console.error("BTC 계좌 정보를 찾을 수 없습니다.");
		return Signal.HOLD;
	}

	const avgBuyPrice = Number(btcAccount.avg_buy_price);
	const currentPriceNum = Number(currentPrice.trade_price);

	// 수익률 계산 (%)
	const profitRate = ((currentPriceNum - avgBuyPrice) / avgBuyPrice) * 100;

	developmentLog(
		`[${new Date().toISOString()}] [ANALYZE] 현재 수익률: ${profitRate.toFixed(2)}%`,
	);

	if (profitRate >= TAKE_PROFIT) {
		developmentLog(
			`[${new Date().toISOString()}] [ANALYZE] 익절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	if (profitRate <= STOP_LOSS) {
		developmentLog(
			`[${new Date().toISOString()}] [ANALYZE] 손절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	return Signal.HOLD;
}
