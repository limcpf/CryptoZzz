import type { PoolClient } from "pg";
import i18n from "../../../shared/services/i18n";
import { GET_RSI_QUERY, INSERT_RSI_SIGNAL } from "./rsi.queries";
import type { iRSIResult } from "./rsi.types";

/**
 * RSI(Relative Strength Index) 지표 관련 데이터베이스 작업을 처리하는 클래스입니다.
 * Repository class for handling RSI (Relative Strength Index) indicator database operations.
 */
export class RSIRepository {
	constructor(private readonly client: PoolClient) {}

	/**
	 * 특정 심볼의 RSI 값들을 조회합니다.
	 * Retrieves RSI values for a specific symbol.
	 *
	 * @param {string} symbol - 조회할 암호화폐 심볼 / Cryptocurrency symbol to query
	 * @param {number} period - RSI 계산 기간 / RSI calculation period
	 * @returns {Promise<number[]>} RSI 값 배열 / Array of RSI values
	 * @throws {Error} 데이터가 없을 경우 에러 발생 / Throws error when no data is found
	 */
	async getRSIValues(symbol: string, period: number): Promise<number[]> {
		const result = await this.client.query<iRSIResult>({
			name: `get_rsi_${symbol}`,
			text: GET_RSI_QUERY,
			values: [symbol, period, period - 1],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("SIGNAL_RSI_ERROR_NO_DATA"));
		}

		return result.rows.filter((row) => row.rsi !== null).map((row) => row.rsi);
	}

	/**
	 * RSI 신호를 데이터베이스에 저장합니다.
	 * Saves RSI signal to the database.
	 *
	 * @param {string} signalId - 신호 식별자 / Signal identifier
	 * @param {number} rsi - RSI 값 / RSI value
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	async saveRSISignal(
		signalId: string,
		rsi: number,
		score: number,
	): Promise<void> {
		await this.client.query(INSERT_RSI_SIGNAL, [signalId, rsi, score]);
	}
}
