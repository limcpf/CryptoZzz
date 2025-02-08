import type { PoolClient } from "pg";
import i18n from "../../../../shared/services/i18n";
import { GET_MACD_ANALYSIS, INSERT_MACD_SIGNAL } from "./macd.queries";
import type { iMACDResult } from "./macd.types";

export class MACDRepository {
	constructor(private readonly client: PoolClient) {}

	/**
	 * MACD(Moving Average Convergence Divergence) 지표의 분석 결과를 조회합니다.
	 *
	 * @param {string} symbol - 분석할 암호화폐 심볼
	 * @param {number} lookbackHours - 분석할 과거 데이터 기간 (시간)
	 * @param {number} shortPeriod - 단기 이동평균 기간
	 * @param {number} longPeriod - 장기 이동평균 기간
	 * @param {number} signalPeriod - 시그널 라인 기간
	 * @returns {Promise<iMACDResult>} MACD 분석 결과
	 * @throws {Error} 데이터가 없을 경우 에러 발생
	 */
	async getMACDScore(
		symbol: string,
		lookbackHours: number,
		shortPeriod: number,
		longPeriod: number,
		signalPeriod: number,
	): Promise<iMACDResult> {
		const result = await this.client.query<iMACDResult>({
			name: `get_macd_${symbol}`,
			text: GET_MACD_ANALYSIS,
			values: [symbol, lookbackHours, shortPeriod, longPeriod, signalPeriod],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("MACD_DATA_NOT_FOUND"));
		}

		return result.rows[0];
	}

	/**
	 * MACD 신호를 데이터베이스에 저장합니다.
	 *
	 * @param {string} signalId - 신호 식별자
	 * @param {iMACDResult} data - MACD 분석 결과 데이터
	 * @param {number} score - MACD 신호 점수
	 * @param {boolean} zeroCross - 0선 돌파 여부
	 * @param {number} trendStrength - 추세 강도
	 * @returns {Promise<void>}
	 */
	async saveMACDSignal(
		signalId: string,
		data: iMACDResult,
		score: number,
		zeroCross: boolean,
		trendStrength: number,
	): Promise<void> {
		await this.client.query(INSERT_MACD_SIGNAL, [
			signalId,
			data.current_macd,
			data.current_signal,
			data.histogram,
			zeroCross,
			trendStrength,
			score,
		]);
	}
}
