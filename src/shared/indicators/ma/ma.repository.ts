import type { PoolClient } from "pg";
import i18n from "../../services/i18n";
import { GET_MA_SCORE, INSERT_MA_SIGNAL } from "./ma.queries";
import type { iMAResult } from "./ma.types";

/**
 * Repository class for Moving Average (MA) data operations
 * - Manages database interactions for MA calculations
 * - Handles MA signal data persistence
 * - Provides data validation and error handling
 *
 * 이동평균(MA) 데이터 작업을 위한 저장소 클래스
 * - MA 계산을 위한 데이터베이스 상호작용 관리
 * - MA 신호 데이터 영속성 처리
 * - 데이터 유효성 검사 및 오류 처리 제공
 */
export class MARepository {
	/**
	 * Creates a new MA repository instance
	 * MA 저장소 인스턴스 생성
	 *
	 * @param {PoolClient} client - PostgreSQL database client connection
	 *                             (PostgreSQL 데이터베이스 클라이언트 연결)
	 */
	constructor(private readonly client: PoolClient) {}

	/**
	 * Retrieves MA score data for a given symbol and periods
	 * - Executes MA calculation query
	 * - Validates result data existence and values
	 *
	 * 주어진 심볼과 기간에 대한 MA 점수 데이터 조회
	 * - MA 계산 쿼리 실행
	 * - 결과 데이터 존재 여부 및 값 검증
	 *
	 * @param {string} symbol - Trading symbol (거래 심볼)
	 * @param {number} shortPeriod - Short-term MA period (단기 MA 기간)
	 * @param {number} longPeriod - Long-term MA period (장기 MA 기간)
	 * @throws {Error} MA_DATA_NOT_FOUND - When no data exists (데이터가 없는 경우)
	 * @throws {Error} MA_INVALID_DATA - When MA values are invalid (MA 값이 유효하지 않은 경우)
	 * @returns {Promise<iMAResult>} MA calculation results (MA 계산 결과)
	 */
	async getMAScore(
		symbol: string,
		shortPeriod: number,
		longPeriod: number,
	): Promise<iMAResult> {
		const result = await this.client.query<iMAResult>({
			name: `get_ma_${symbol}`,
			text: GET_MA_SCORE,
			values: [symbol, shortPeriod, longPeriod],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("MA_DATA_NOT_FOUND"));
		}

		const data = result.rows[0];
		if (data.short_ma <= 0 || data.long_ma <= 0) {
			throw new Error(i18n.getMessage("MA_INVALID_DATA"));
		}

		return data;
	}

	/**
	 * Saves MA signal data to the database
	 * - Persists signal calculation results
	 * - Stores MA values and signal score
	 *
	 * MA 신호 데이터를 데이터베이스에 저장
	 * - 신호 계산 결과 영속화
	 * - MA 값과 신호 점수 저장
	 *
	 * @param {string} signalId - Unique signal identifier (고유 신호 식별자)
	 * @param {iMAResult} data - MA calculation results (MA 계산 결과)
	 * @param {number} score - Normalized signal score (정규화된 신호 점수)
	 * @returns {Promise<void>} No return value (반환값 없음)
	 */
	async saveMASignal(
		signalId: string,
		data: iMAResult,
		score: number,
	): Promise<void> {
		await this.client.query(INSERT_MA_SIGNAL, [
			signalId,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);
	}
}
