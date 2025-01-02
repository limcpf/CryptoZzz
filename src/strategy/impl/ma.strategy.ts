import type { Pool } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iMovingAveragesResult } from "../../shared/interfaces/iMarketDataResult";
import type { Singnal, iStrategy } from "../iStrategy";

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
	pool: Pool;

	constructor(pool: Pool) {
		this.pool = pool;
	}

	async execute(uuid: string): Promise<Singnal> {
		const result = await this.pool.query<iMovingAveragesResult>(
			QUERIES.GET_MOVING_AVERAGES,
		);

		if (result.rowCount === 0) {
			console.error(
				`[${new Date().toISOString()}] [MA-STRATEGY] MA 지표 조회 실패`,
			);
			return "HOLD";
		}

		const { short_ma, long_ma } = result.rows[0];

		this.saveResult(uuid, { short_ma, long_ma });

		// 단기 이동평균이 장기 이동평균을 상향 돌파
		if (short_ma > long_ma) {
			return "BUY";
		}

		// 단기 이동평균이 장기 이동평균을 하향 돌파
		if (short_ma < long_ma) {
			return "SELL";
		}

		return "HOLD";
	}

	private saveResult(
		uuid: string,
		data: { short_ma: number; long_ma: number },
	): void {
		this.pool.query(QUERIES.INSERT_MA_SIGNAL, [
			uuid,
			data.short_ma,
			data.long_ma,
		]);
	}
}
