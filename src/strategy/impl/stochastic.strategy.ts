import type { PoolClient } from "pg";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";
import { StochasticRepository } from "../../shared/indicators/stochastic/stochastic.repository";
import type {
	iStochasticParams,
	iStochasticResult,
} from "../../shared/indicators/stochastic/stochastic.types";
import { calculateStochasticScore } from "../../shared/indicators/stochastic/stochastic.utils";

/**
 * Stochastic Oscillator 기반의 거래 전략을 구현하는 클래스
 * Trading strategy class based on Stochastic Oscillator indicator
 */
export class StochasticStrategy extends CommonStrategy {
	private readonly repository: StochasticRepository;
	readonly params: iStochasticParams;

	/**
	 * 스토캐스틱 전략 클래스의 생성자
	 * Constructor for the Stochastic strategy class
	 *
	 * @param {PoolClient} client - 데이터베이스 연결 클라이언트 / Database connection client
	 * @param {string} uuid - 전략 식별자 / Strategy identifier
	 * @param {string} symbol - 분석할 암호화폐 심볼 / Cryptocurrency symbol to analyze
	 * @param {Partial<iStochasticParams>} params - 스토캐스틱 파라미터 (선택적) / Stochastic parameters (optional)
	 *   - kPeriod: %K 기간 (기본값: 10) / %K period (default: 10)
	 *   - dPeriod: %D 기간 (기본값: 3) / %D period (default: 3)
	 * @param {number} weight - 전략 가중치 (기본값: 0.8) / Strategy weight (default: 0.8)
	 */
	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: Partial<iStochasticParams>,
		weight = 0.8,
	) {
		super(client, uuid, symbol, weight);
		this.repository = new StochasticRepository(client);
		this.params = {
			kPeriod: params?.kPeriod ?? 10,
			dPeriod: params?.dPeriod ?? 3,
		};
	}

	/**
	 * 스토캐스틱 데이터를 기반으로 매매 신호 점수를 계산
	 * Calculates trading signal score based on Stochastic data
	 *
	 * @param {iStochasticResult} data - %K와 %D 값 / %K and %D values
	 * @returns {number} 계산된 매매 신호 점수 (-1 ~ 1) / Calculated trading signal score (-1 to 1)
	 */
	protected calculateScore(data: iStochasticResult): number {
		return calculateStochasticScore(data.k_value, data.d_value);
	}

	/**
	 * 지정된 심볼의 스토캐스틱 값을 조회
	 * Retrieves Stochastic values for the specified symbol
	 *
	 * @returns {Promise<iStochasticResult>} 스토캐스틱 %K, %D 값 / Stochastic %K, %D values
	 */
	protected async getData(): Promise<iStochasticResult> {
		return this.repository.getStochasticValues(
			this.symbol,
			this.params.kPeriod,
			this.params.dPeriod,
		);
	}

	/**
	 * 계산된 스토캐스틱 신호를 데이터베이스에 저장
	 * Saves calculated Stochastic signal to the database
	 *
	 * @param {iStochasticResult} data - 스토캐스틱 데이터 / Stochastic data
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	protected async saveData(
		data: iStochasticResult,
		score: number,
	): Promise<void> {
		await this.repository.saveStochasticSignal(this.uuid, data, score);
	}
}
