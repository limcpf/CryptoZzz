import type { PoolClient } from "pg";
import { developmentLog } from "../../services/analysis";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iMovingAveragesResult } from "../../shared/interfaces/iMarketDataResult";
import { Signal, type iStrategy } from "../iStrategy";

/**
 * MA (Moving Average) Strategy Implementation
 * Analyzes market data using MA indicator to generate trading signals
 * - Returns BUY signal when short MA crosses above long MA
 * - Returns SELL signal when short MA crosses below long MA
 * - Returns HOLD signal in other cases
 *
 * MA (이동평균) 전략 구현
 * MA 지표를 사용하여 시장 데이터를 분석하고 거래 신호를 생성
 * - 단기 MA가 장기 MA를 상향 돌파할 때 매수 신호 반환
 * - 단기 MA가 장기 MA를 하향 돌파할 때 매도 신호 반환
 * - 그 외의 경우 홀드 신호 반환
 */
export class MaStrategy implements iStrategy {
	client: PoolClient;
	private loggerPrefix = "MA-STRATEGY";

	constructor(client: PoolClient) {
		this.client = client;
	}

	async execute(uuid: string, symbol: string): Promise<Signal> {
		const result = await this.client.query<iMovingAveragesResult>(
			QUERIES.GET_MOVING_AVERAGES,
			[symbol],
		);

		if (result.rowCount === 0) {
			logger.error(this.client, "SIGNAL_MA_ERROR", this.loggerPrefix);
			return Signal.HOLD;
		}

		const { short_ma, long_ma } = result.rows[0];

		this.saveResult(uuid, { short_ma, long_ma });

		if (short_ma > long_ma) {
			developmentLog(
				`[${new Date().toLocaleString()}] [MA-STRATEGY] 매수 신호 발생`,
			);
			return Signal.BUY;
		}

		if (short_ma < long_ma) {
			developmentLog(
				`[${new Date().toLocaleString()}] [MA-STRATEGY] 매도 신호 발생`,
			);
			return Signal.SELL;
		}

		developmentLog(
			`[${new Date().toLocaleString()}] [MA-STRATEGY] 홀드 신호 발생`,
		);
		return Signal.HOLD;
	}

	private saveResult(
		uuid: string,
		data: { short_ma: number; long_ma: number },
	): void {
		this.client.query(QUERIES.INSERT_MA_SIGNAL, [
			uuid,
			data.short_ma,
			data.long_ma,
		]);
	}
}
