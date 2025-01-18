import type { PoolClient } from "pg";
import { developmentLog } from "../../services/analysis";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iVolumeAnalysisResult } from "../../shared/interfaces/iMarketDataResult";
import { Signal, type iStrategy } from "../iStrategy";

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
	client: PoolClient;
	private loggerPrefix = "VOLUME-STRATEGY";
	constructor(client: PoolClient) {
		this.client = client;
	}

	async execute(uuid: string, symbol: string): Promise<Signal> {
		const result = await this.client.query<iVolumeAnalysisResult>(
			QUERIES.GET_VOLUME_ANALYSIS,
			[symbol],
		);

		if (result.rowCount === 0) {
			logger.error(this.client, "SIGNAL_VOLUME_ERROR", this.loggerPrefix);
			return Signal.HOLD;
		}

		const { current_volume, avg_volume } = result.rows[0];

		this.saveResult(uuid, { current_volume, avg_volume });

		if (current_volume > avg_volume * 1.5) {
			developmentLog(
				`[${new Date().toLocaleString()}] [VOLUME-STRATEGY] 매수 신호 발생`,
			);
			return Signal.BUY;
		}

		if (current_volume < avg_volume) {
			developmentLog(
				`[${new Date().toLocaleString()}] [VOLUME-STRATEGY] 매도 신호 발생`,
			);
			return Signal.SELL;
		}

		developmentLog(
			`[${new Date().toLocaleString()}] [VOLUME-STRATEGY] 홀드 신호 발생`,
		);
		return Signal.HOLD;
	}

	private saveResult(
		uuid: string,
		data: { current_volume: number; avg_volume: number },
	): void {
		if (data.current_volume && data.avg_volume) {
			this.client.query(QUERIES.INSERT_VOLUME_SIGNAL, [
				uuid,
				data.current_volume,
				data.avg_volume,
			]);
		}
	}
}
