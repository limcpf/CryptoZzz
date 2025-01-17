import type { Pool } from "pg";
import { developmentLog } from "../../services/analysis";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iRSIResult } from "../../shared/interfaces/iMarketDataResult";
import { Signal, type iStrategy } from "../iStrategy";

/**
 * RSI (Relative Strength Index) Strategy Implementation
 * Analyzes market data using RSI indicator to generate trading signals
 * - Returns BUY signal when RSI falls below 30 (oversold)
 * - Returns SELL signal when RSI rises above 70 (overbought)
 * - Returns HOLD signal in other cases
 *
 * RSI (상대강도지수) 전략 구현
 * RSI 지표를 사용하여 시장 데이터를 분석하고 거래 신호를 생성
 * - RSI가 30 이하로 떨어질 때 매수 신호 반환 (과매도)
 * - RSI가 70 이상으로 상승할 때 매도 신호 반환 (과매수)
 * - 그 외의 경우 홀드 신호 반환
 */
export class RsiStrategy implements iStrategy {
	pool: Pool;
	private loggerPrefix = "RSI-STRATEGY";

	constructor(pool: Pool) {
		this.pool = pool;
	}

	async execute(uuid: string, symbol: string): Promise<Signal> {
		const result = await this.pool.query<iRSIResult>(
			QUERIES.GET_RSI_INDICATOR,
			[symbol],
		);

		if (result.rowCount === 0) {
			logger.error("SIGNAL_RSI_ERROR", this.loggerPrefix);
			return Signal.HOLD;
		}

		const rsi = Number(result.rows[0].rsi);

		this.saveResult(uuid, rsi);

		if (rsi < 30) {
			developmentLog(
				`[${new Date().toLocaleString()}] [RSI-STRATEGY] 매수 신호 발생`,
			);
			return Signal.BUY;
		}

		if (rsi > 70) {
			developmentLog(
				`[${new Date().toLocaleString()}] [RSI-STRATEGY] 매도 신호 발생`,
			);
			return Signal.SELL;
		}

		developmentLog(
			`[${new Date().toLocaleString()}] [RSI-STRATEGY] 홀드 신호 발생`,
		);
		return Signal.HOLD;
	}

	private saveResult(uuid: string, data: unknown): void {
		if (data && typeof data === "number") {
			this.pool.query(QUERIES.INSERT_RSI_SIGNAL, [uuid, data]);
		}
	}
}
