import type { PoolClient } from "pg";
import i18n from "../../../../shared/services/i18n";
import { validateQueryResult } from "../common/common.utils";
import {
	GET_BOLLINGER_BANDS,
	INSERT_BOLLINGER_SIGNAL,
} from "./bollinger.queries";
import type { iBollingerData, iBollingerSignal } from "./bollinger.types";

/**
 * Bollinger Bands 지표 관련 데이터베이스 작업을 처리하는 클래스
 * Repository class for handling Bollinger Bands indicator database operations
 */
export class BollingerRepository {
	constructor(private readonly client: PoolClient) {}

	/**
	 * 특정 심볼의 볼린저 밴드 값을 조회합니다.
	 * Retrieves Bollinger Bands values for a specific symbol.
	 *
	 * @param {string} symbol - 조회할 암호화폐 심볼 / Cryptocurrency symbol to query
	 * @param {number} period - 이동평균 계산 기간 / Moving average calculation period
	 * @param {number} hours - 조회할 시간 범위 / Lookback period in hours
	 * @returns {Promise<iBollingerData>} 볼린저 밴드 데이터 / Bollinger Bands data
	 * @throws {Error} 데이터가 없을 경우 에러 발생 / Throws error when no data is found
	 */
	async getBollingerBands(
		symbol: string,
		period: number,
		hours: number,
	): Promise<iBollingerData> {
		const result = await this.client.query<iBollingerData>({
			name: `get_bollinger_${symbol}`,
			text: GET_BOLLINGER_BANDS,
			values: [symbol, period, hours],
		});

		return validateQueryResult(result, i18n.getMessage("BOLLINGER_DATA_ERROR"));
	}

	/**
	 * 볼린저 밴드 신호를 데이터베이스에 저장합니다.
	 * Saves Bollinger Bands signal to the database.
	 *
	 * @param {string} signalId - 신호 식별자 / Signal identifier
	 * @param {iBollingerSignal} signal - 볼린저 밴드 신호 데이터 / Bollinger Bands signal data
	 * @returns {Promise<void>}
	 */
	async saveBollingerSignal(
		signalId: string,
		signal: iBollingerSignal,
	): Promise<void> {
		await this.client.query(INSERT_BOLLINGER_SIGNAL, [
			signalId,
			signal.bollinger_upper,
			signal.bollinger_middle,
			signal.bollinger_lower,
			signal.close_price,
			signal.band_width,
			signal.score,
		]);
	}
}
