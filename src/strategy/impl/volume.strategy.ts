import type { PoolClient } from "pg";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iVolumeAnalysisResult } from "../../shared/interfaces/iMarketDataResult";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * Volume Strategy Implementation
 * Analyzes market data using volume to generate trading signals with weighted scoring
 * - Uses hyperbolic tangent function for non-linear signal normalization
 * - Calculates buy signals when current volume is significantly higher than average
 * - Calculates sell signals when current volume is significantly lower than average
 * - Applies configurable strategy weight for portfolio balance
 *
 * 거래량 전략 구현
 * 거래량을 사용하여 가중치가 적용된 거래 신호를 생성
 * - 하이퍼볼릭 탄젠트 함수를 사용하여 비선형 신호 정규화
 * - 현재 거래량이 평균보다 현저히 높을 때 매수 신호 계산
 * - 현재 거래량이 평균보다 현저히 낮을 때 매도 신호 계산
 * - 포트폴리오 균형을 위한 전략 가중치 적용
 */
export class VolumeStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;
	private readonly period: number = 24; // 24시간 기준
	private readonly loggerPrefix = "VOLUME-STRATEGY";

	constructor(client: PoolClient, uuid: string, symbol: string, weight = 0.5) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	async execute(): Promise<number> {
		const volumeData = await this.getData();
		if (!volumeData) {
			return 0;
		}

		const score = this.score(volumeData);
		await this.saveData(volumeData, score);

		return score * this.weight;
	}

	private async getData(): Promise<iVolumeAnalysisResult | null> {
		try {
			const result = await this.client.query<iVolumeAnalysisResult>({
				name: `get_volume_${this.symbol}_${this.uuid}`,
				text: QUERIES.GET_VOLUME_ANALYSIS,
				values: [this.symbol, this.period],
			});

			if (result.rowCount === 0) {
				throw new Error(String(getMsg("VOLUME_DATA_NOT_FOUND")));
			}

			return result.rows[0];
		} catch (error) {
			throw new Error(String(getMsg("VOLUME_DATA_ERROR")));
		}
	}

	private score(data: iVolumeAnalysisResult): number {
		const { latest_hour_volume, historical_avg_volume } = data;

		if (historical_avg_volume === 0) {
			return 0;
		}

		// 거래량 비율 계산
		const volumeRatio = latest_hour_volume / historical_avg_volume;

		// 하이퍼볼릭 탄젠트 함수를 사용하여 비선형 스코어링
		// volumeRatio가 1일 때는 0,
		// 1보다 크게 높을 때는 1에 가까워지고,
		// 1보다 크게 낮을 때는 -1에 가까워지도록 조정
		const normalizedRatio = Math.log(volumeRatio); // 로그를 취해 비율의 비대칭성 해결
		return Math.tanh(normalizedRatio);
	}

	private async saveData(
		data: iVolumeAnalysisResult,
		score: number,
	): Promise<void> {
		await this.client.query(QUERIES.INSERT_VOLUME_SIGNAL, [
			this.uuid,
			data.latest_hour_volume,
			data.historical_avg_volume,
			score,
		]);
	}
}
