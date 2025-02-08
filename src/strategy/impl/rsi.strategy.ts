import type { PoolClient } from "pg";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";
import { RSIRepository } from "../../shared/indicators/rsi/rsi.repository";
import type { iRSIParams } from "../../shared/indicators/rsi/rsi.types";
import {
	calculateFinalScore,
	calculateMomentumScore,
	calculateRSIScore,
} from "../../shared/indicators/rsi/rsi.utils";

/**
 * RSI(Relative Strength Index) 기반의 거래 전략을 구현하는 클래스입니다.
 * CommonStrategy를 상속받아 RSI 지표를 사용한 매매 신호를 생성합니다.
 *
 * A trading strategy class based on RSI (Relative Strength Index).
 * Extends CommonStrategy to generate trading signals using the RSI indicator.
 */
export class RsiStrategy extends CommonStrategy {
	private readonly repository: RSIRepository;
	private readonly params: iRSIParams;

	/**
	 * RSI 전략 클래스의 생성자
	 * Constructor for the RSI strategy class
	 *
	 * @param {PoolClient} client - 데이터베이스 연결 클라이언트 / Database connection client
	 * @param {string} uuid - 전략 식별자 / Strategy identifier
	 * @param {string} symbol - 분석할 암호화폐 심볼 / Cryptocurrency symbol to analyze
	 * @param {Partial<iRSIParams>} params - RSI 전략 파라미터 (선택적) / RSI strategy parameters (optional)
	 * @param {number} weight - 전략 가중치 (기본값: 1) / Strategy weight (default: 1)
	 */
	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: Partial<iRSIParams>,
		weight = 1,
	) {
		super(client, uuid, symbol, weight);
		this.repository = new RSIRepository(client);
		this.params = {
			period: params?.period ?? 14,
			oversoldThreshold: params?.oversoldThreshold ?? 30,
			overboughtThreshold: params?.overboughtThreshold ?? 70,
			momentumWeight: params?.momentumWeight ?? 0.1,
		};
	}

	/**
	 * RSI 값을 기반으로 매매 신호 점수를 계산합니다.
	 * Calculates trading signal score based on RSI values.
	 *
	 * @param {unknown} data - RSI 값 배열 / Array of RSI values
	 * @returns {number} 계산된 매매 신호 점수 (-1 ~ 1) / Calculated trading signal score (-1 to 1)
	 */
	protected calculateScore(data: unknown): number {
		const rsiValues = data as number[];
		const currentRsi = rsiValues[0];
		const prevRsiValues = rsiValues.slice(1);

		const baseScore = calculateRSIScore(
			currentRsi,
			this.params.oversoldThreshold,
			this.params.overboughtThreshold,
		);

		const momentumScore = calculateMomentumScore(
			currentRsi,
			prevRsiValues,
			this.params.momentumWeight,
		);

		return calculateFinalScore(baseScore, momentumScore);
	}

	/**
	 * 지정된 심볼의 RSI 값들을 조회합니다.
	 * Retrieves RSI values for the specified symbol.
	 *
	 * @returns {Promise<number[]>} RSI 값 배열 / Array of RSI values
	 */
	protected async getData(): Promise<number[]> {
		return this.repository.getRSIValues(this.symbol, this.params.period);
	}

	/**
	 * 계산된 RSI 신호를 데이터베이스에 저장합니다.
	 * Saves the calculated RSI signal to the database.
	 *
	 * @param {number[]} data - RSI 값 배열 / Array of RSI values
	 * @param {number} score - 계산된 매매 신호 점수 / Calculated trading signal score
	 * @returns {Promise<void>}
	 */
	protected async saveData(data: number[], score: number): Promise<void> {
		await this.repository.saveRSISignal(this.uuid, data[0], score);
	}
}
