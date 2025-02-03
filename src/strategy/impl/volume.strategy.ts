import type { PoolClient } from "pg";
import type { iVolumeAnalysisResult } from "../../shared/interfaces/iMarketDataResult";
import i18n from "../../shared/services/i18n";
import { errorHandler, innerErrorHandler } from "../../shared/services/util";
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

	constructor(client: PoolClient, uuid: string, symbol: string, weight = 0.75) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	private readonly GET_VOLUME_ANALYSIS = `
		WITH RECURSIVE time_intervals AS (
			SELECT 
				NOW() as interval_start
			UNION ALL
			SELECT 
				interval_start - INTERVAL '60 minutes'
			FROM time_intervals
			WHERE interval_start > NOW() - ($2 * INTERVAL '60 minutes')
		),
		volume_by_interval AS (
			SELECT
				ti.interval_start,
				md.symbol,
				AVG(md.volume) AS avg_volume
			FROM time_intervals ti
			LEFT JOIN Market_Data md ON 
				md.symbol = $1 AND
				md.timestamp > ti.interval_start - INTERVAL '60 minutes' AND
				md.timestamp <= ti.interval_start
			GROUP BY ti.interval_start, md.symbol
		),
		volume_analysis AS (
			SELECT 
				symbol,
				interval_start,
				avg_volume as current_volume,
				(
					SELECT AVG(avg_volume)
					FROM volume_by_interval
					WHERE interval_start < NOW() - INTERVAL '60 minutes'
				) as historical_avg_volume,
				(
					SELECT avg_volume
					FROM volume_by_interval
					WHERE interval_start = (SELECT MAX(interval_start) FROM volume_by_interval)
				) as latest_hour_volume
			FROM volume_by_interval
			WHERE interval_start = (SELECT MAX(interval_start) FROM volume_by_interval)
		)
		SELECT 
			COALESCE(symbol, $1) as symbol,
			COALESCE(latest_hour_volume, 0) as latest_hour_volume,
			COALESCE(historical_avg_volume, 0) as historical_avg_volume
		FROM volume_analysis;
	`;

	private readonly INSERT_VOLUME_SIGNAL = `
		INSERT INTO VolumeSignal (signal_id, current_volume, avg_volume, score)
		VALUES ($1, $2, $3, $4);
	`;

	async execute(): Promise<number> {
		let course = "this.getData";
		let score = 0;

		try {
			const volumeData = await this.getData();

			course = "this.score";
			score = this.score(volumeData);

			course = "this.saveData";
			await this.saveData(volumeData, score);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "42P01") {
				errorHandler(this.client, "TABLE_NOT_FOUND", "VOLUME_SIGNAL", error);
			} else {
				innerErrorHandler("SIGNAL_VOLUME_ERROR", error, course);
			}
		}

		return score * this.weight;
	}

	private async getData(): Promise<iVolumeAnalysisResult> {
		try {
			const result = await this.client.query<iVolumeAnalysisResult>({
				name: `get_volume_${this.symbol}_${this.uuid}`,
				text: this.GET_VOLUME_ANALYSIS,
				values: [this.symbol, this.period],
			});

			if (result.rowCount === 0) {
				throw new Error(i18n.getMessage("VOLUME_DATA_NOT_FOUND"));
			}

			return result.rows[0];
		} catch (error) {
			throw new Error(i18n.getMessage("VOLUME_DATA_ERROR"));
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

		return Number(Math.tanh(normalizedRatio).toFixed(2));
	}

	private async saveData(
		data: iVolumeAnalysisResult,
		score: number,
	): Promise<void> {
		await this.client.query(this.INSERT_VOLUME_SIGNAL, [
			this.uuid,
			data.latest_hour_volume,
			data.historical_avg_volume,
			score,
		]);
	}
}
