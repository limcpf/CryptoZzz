import type { PoolClient } from "pg";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";
import { VolumeRepository } from "../../shared/indicators/volume/volume.repository";
import type { iVolumeAnalysisResult } from "../../shared/indicators/volume/volume.types";
import { calculateVolumeScore } from "../../shared/indicators/volume/volume.utils";

/**
 * 거래량 분석 기반의 거래 전략을 구현하는 클래스
 * Trading strategy class based on volume analysis
 */
export class VolumeStrategy extends CommonStrategy {
	private readonly repository: VolumeRepository;
	private readonly period: number;

	/**
	 * 거래량 전략 클래스의 생성자
	 * Constructor for the Volume strategy class
	 *
	 * @param {PoolClient} client - 데이터베이스 연결 클라이언트 / Database connection client
	 * @param {string} uuid - 전략 식별자 / Strategy identifier
	 * @param {string} symbol - 분석할 암호화폐 심볼 / Cryptocurrency symbol to analyze
	 * @param {number} period - 거래량 분석 기간(시간) (기본값: 12) / Volume analysis period in hours (default: 12)
	 * @param {number} weight - 전략 가중치 (기본값: 0.75) / Strategy weight (default: 0.75)
	 */
	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		period = 12,
		weight = 0.75,
	) {
		super(client, uuid, symbol, weight, "SIGNAL_VOLUME_ERROR");
		this.repository = new VolumeRepository(client);
		this.period = period;
	}

	/**
	 * 거래량 데이터를 기반으로 매매 신호 점수를 계산
	 * Calculates trading signal score based on volume data
	 *
	 * @param {iVolumeAnalysisResult} data - 거래량 분석 데이터 / Volume analysis data
	 *   - latest_hour_volume: 최근 1시간 거래량 / Latest hour volume
	 *   - historical_avg_volume: 과거 평균 거래량 / Historical average volume
	 * @returns {number} 계산된 매매 신호 점수 (-1 ~ 1) / Calculated trading signal score (-1 to 1)
	 */
	protected calculateScore(data: iVolumeAnalysisResult): number {
		const { latest_hour_volume, historical_avg_volume } = data;

		if (historical_avg_volume === 0) {
			return 0;
		}

		const volumeRatio = latest_hour_volume / historical_avg_volume;
		return calculateVolumeScore(volumeRatio);
	}

	/**
	 * 지정된 심볼의 거래량 분석 데이터를 조회
	 * Retrieves volume analysis data for the specified symbol
	 *
	 * @returns {Promise<iVolumeAnalysisResult>} 거래량 분석 결과 / Volume analysis result
	 */
	protected async getData(): Promise<iVolumeAnalysisResult> {
		return this.repository.getVolumeAnalysis(this.symbol, this.period);
	}

	/**
	 * 계산된 거래량 신호를 데이터베이스에 저장
	 * Saves calculated volume signal to the database
	 *
	 * @param {iVolumeAnalysisResult} data - 거래량 분석 데이터 / Volume analysis data
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	protected async saveData(
		data: iVolumeAnalysisResult,
		score: number,
	): Promise<void> {
		await this.repository.saveVolumeSignal(this.uuid, data, score);
	}
}
