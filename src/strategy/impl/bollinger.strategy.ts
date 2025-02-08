import type { PoolClient } from "pg";
import { BollingerRepository } from "../../shared/indicators/bollinger/bollinger.repository";
import type {
	iBollingerData,
	iBollingerParams,
} from "../../shared/indicators/bollinger/bollinger.types";
import {
	calculateBandWidth,
	calculateBollingerScore,
} from "../../shared/indicators/bollinger/bollinger.utils";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";

/**
 * Bollinger Bands 기반의 거래 전략을 구현하는 클래스
 * Trading strategy class based on Bollinger Bands indicator
 */
export class BollingerStrategy extends CommonStrategy {
	private readonly repository: BollingerRepository;
	readonly params: iBollingerParams;

	/**
	 * 볼린저 밴드 전략 클래스의 생성자
	 * Constructor for the Bollinger Bands strategy class
	 *
	 * @param {PoolClient} client - 데이터베이스 연결 클라이언트 / Database connection client
	 * @param {string} uuid - 전략 식별자 / Strategy identifier
	 * @param {string} symbol - 분석할 암호화폐 심볼 / Cryptocurrency symbol to analyze
	 * @param {Partial<iBollingerParams>} params - 볼린저 밴드 파라미터 (선택적) / Bollinger Bands parameters (optional)
	 * @param {number} weight - 전략 가중치 (기본값: 0.85) / Strategy weight (default: 0.85)
	 */
	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: Partial<iBollingerParams>,
		weight = 0.85,
	) {
		super(client, uuid, symbol, weight);
		this.repository = new BollingerRepository(client);
		this.params = {
			period: params?.period ?? 20,
			hours: params?.hours ?? 10,
		};
	}

	/**
	 * 볼린저 밴드 데이터를 기반으로 매매 신호 점수를 계산
	 * Calculates trading signal score based on Bollinger Bands data
	 *
	 * @param {iBollingerData} data - 볼린저 밴드 데이터 / Bollinger Bands data
	 * @returns {number} 계산된 매매 신호 점수 (-1 ~ 1) / Calculated trading signal score (-1 to 1)
	 */
	protected calculateScore(data: iBollingerData): number {
		return calculateBollingerScore(data);
	}

	/**
	 * 지정된 심볼의 볼린저 밴드 데이터를 조회
	 * Retrieves Bollinger Bands data for the specified symbol
	 *
	 * @returns {Promise<iBollingerData>} 볼린저 밴드 데이터 / Bollinger Bands data
	 */
	protected async getData(): Promise<iBollingerData> {
		return this.repository.getBollingerBands(
			this.symbol,
			this.params.period,
			this.params.hours,
		);
	}

	/**
	 * 계산된 볼린저 밴드 신호를 데이터베이스에 저장
	 * Saves calculated Bollinger Bands signal to the database
	 *
	 * @param {iBollingerData} data - 볼린저 밴드 데이터 / Bollinger Bands data
	 * @param {number} score - 계산된 신호 점수 / Calculated signal score
	 * @returns {Promise<void>}
	 */
	protected async saveData(data: iBollingerData, score: number): Promise<void> {
		const bandWidth = calculateBandWidth(
			data.bollinger_upper,
			data.bollinger_lower,
		);

		await this.repository.saveBollingerSignal(this.uuid, {
			...data,
			band_width: bandWidth,
			score,
		});
	}
}
