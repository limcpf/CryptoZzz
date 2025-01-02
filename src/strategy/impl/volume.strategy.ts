import type { Pool } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iVolumeAnalysisResult } from "../../shared/interfaces/iMarketDataResult";
import type { Singnal, iStrategy } from "../iStrategy";

/**
 * Volume Strategy Implementation
 * Analyzes market data using volume to generate trading signals
 * - Returns BUY signal when current volume is 50% higher than average volume
 * - Returns SELL signal when current volume is lower than average volume
 * - Returns HOLD signal in other cases
 *
 * 거래량 전략 구현
 * - 현재 거래량이 평균 거래량보다 50% 이상 높을 때 매수 신호 반환
 * - 현재 거래량이 평균 거래량보다 낮을 때 매도 신호 반환
 * - 그 외의 경우 홀드 신호 반환
 */
export class VolumeStrategy implements iStrategy {
	pool: Pool;

	constructor(pool: Pool) {
		this.pool = pool;
	}

	async execute(uuid: string): Promise<Singnal> {
		const result = await this.pool.query<iVolumeAnalysisResult>(
			QUERIES.GET_VOLUME_ANALYSIS,
		);

		if (result.rowCount === 0) {
			console.error(
				`[${new Date().toISOString()}] [VOLUME-STRATEGY] 거래량 데이터 조회 실패`,
			);
			return "HOLD";
		}

		const { current_volume, avg_volume } = result.rows[0];

		this.saveResult(uuid, { current_volume, avg_volume });

		// 현재 거래량이 평균 거래량의 1.5배 이상일 때 매수 신호
		if (current_volume > avg_volume * 1.5) {
			return "BUY";
		}

		// 현재 거래량이 평균 거래량보다 낮을 때 매도 신호
		if (current_volume < avg_volume) {
			return "SELL";
		}

		return "HOLD";
	}

	private saveResult(
		uuid: string,
		data: { current_volume: number; avg_volume: number },
	): void {
		this.pool.query(QUERIES.INSERT_VOLUME_SIGNAL, [
			uuid,
			data.current_volume,
			data.avg_volume,
		]);
	}
}
