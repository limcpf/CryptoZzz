import type { PoolClient } from "pg";
import i18n from "../../../shared/services/i18n";
import { validateQueryResult } from "../common/common.utils";
import { GET_VOLUME_ANALYSIS, INSERT_VOLUME_SIGNAL } from "./volume.queries";
import type { iVolumeAnalysisResult } from "./volume.types";

/**
 * 거래량 분석 관련 데이터베이스 작업을 처리하는 클래스
 * Repository class for handling volume analysis database operations
 */
export class VolumeRepository {
	constructor(private readonly client: PoolClient) {}

	/**
	 * 특정 심볼의 거래량 분석 데이터를 조회합니다.
	 * Retrieves volume analysis data for a specific symbol.
	 *
	 * @param {string} symbol - 조회할 암호화폐 심볼 / Cryptocurrency symbol to query
	 * @param {number} period - 분석 기간(시간) / Analysis period in hours
	 * @returns {Promise<iVolumeAnalysisResult>} 거래량 분석 결과 / Volume analysis result
	 *   - latest_hour_volume: 최근 1시간 거래량 / Latest hour volume
	 *   - historical_avg_volume: 과거 평균 거래량 / Historical average volume
	 * @throws {Error} 데이터가 없을 경우 에러 발생 / Throws error when no data is found
	 */
	async getVolumeAnalysis(
		symbol: string,
		period: number,
	): Promise<iVolumeAnalysisResult> {
		const result = await this.client.query<iVolumeAnalysisResult>({
			name: `get_volume_${symbol}`,
			text: GET_VOLUME_ANALYSIS,
			values: [symbol, period],
		});

		return validateQueryResult(
			result,
			i18n.getMessage("VOLUME_DATA_NOT_FOUND"),
		);
	}

	/**
	 * 거래량 분석 신호를 데이터베이스에 저장합니다.
	 * Saves volume analysis signal to the database.
	 *
	 * @param {string} signalId - 신호 식별자 / Signal identifier
	 * @param {iVolumeAnalysisResult} data - 거래량 분석 데이터 / Volume analysis data
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	async saveVolumeSignal(
		signalId: string,
		data: iVolumeAnalysisResult,
		score: number,
	): Promise<void> {
		await this.client.query(INSERT_VOLUME_SIGNAL, [
			signalId,
			data.latest_hour_volume,
			data.historical_avg_volume,
			score,
		]);
	}
}
