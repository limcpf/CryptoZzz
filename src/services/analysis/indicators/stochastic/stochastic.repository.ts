import type { PoolClient } from "pg";
import i18n from "../../../../shared/services/i18n";
import { validateQueryResult } from "../common/common.utils";
import {
	GET_STOCHASTIC_OSCILLATOR,
	INSERT_STOCHASTIC_SIGNAL,
} from "./stochastic.queries";
import type { iStochasticResult } from "./stochastic.types";

/**
 * Stochastic Oscillator 지표 관련 데이터베이스 작업을 처리하는 클래스
 * Repository class for handling Stochastic Oscillator indicator database operations
 */
export class StochasticRepository {
	constructor(private readonly client: PoolClient) {}

	/**
	 * 특정 심볼의 스토캐스틱 값들을 조회합니다.
	 * Retrieves Stochastic Oscillator values for a specific symbol.
	 *
	 * @param {string} symbol - 조회할 암호화폐 심볼 / Cryptocurrency symbol to query
	 * @param {number} kPeriod - %K 계산 기간 / %K calculation period
	 * @param {number} dPeriod - %D 계산 기간 / %D calculation period
	 * @returns {Promise<iStochasticResult>} 스토캐스틱 데이터 (%K, %D 값) / Stochastic data (%K, %D values)
	 * @throws {Error} 데이터가 없을 경우 에러 발생 / Throws error when no data is found
	 */
	async getStochasticValues(
		symbol: string,
		kPeriod: number,
		dPeriod: number,
	): Promise<iStochasticResult> {
		const result = await this.client.query<iStochasticResult>({
			name: `get_stochastic_${symbol}`,
			text: GET_STOCHASTIC_OSCILLATOR,
			values: [symbol, kPeriod, dPeriod],
		});

		return validateQueryResult(
			result,
			i18n.getMessage("STOCHASTIC_DATA_ERROR"),
		);
	}

	/**
	 * 스토캐스틱 신호를 데이터베이스에 저장합니다.
	 * Saves Stochastic signal to the database.
	 *
	 * @param {string} signalId - 신호 식별자 / Signal identifier
	 * @param {Omit<iStochasticResult, "timestamp">} data - 스토캐스틱 데이터 (%K, %D 값) / Stochastic data (%K, %D values)
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	async saveStochasticSignal(
		signalId: string,
		data: Omit<iStochasticResult, "timestamp">,
		score: number,
	): Promise<void> {
		await this.client.query({
			name: `insert_sto_sgn_${signalId}`,
			text: INSERT_STOCHASTIC_SIGNAL,
			values: [signalId, data.k_value, data.d_value, score],
		});
	}
}
