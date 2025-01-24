import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iMovingAveragesResult } from "../../shared/interfaces/iMarketDataResult";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * MA (Moving Average) Strategy Implementation
 * Analyzes market data using MA indicators to generate trading signals with weighted scoring
 * - Calculates crossover signals between short-term and long-term moving averages
 * - Applies hyperbolic tangent function for base signal normalization
 * - Incorporates rate of change momentum for trend confirmation
 * - Uses configurable strategy weight for portfolio balance
 * - Implements database persistence for signal tracking
 *
 * MA (이동평균) 전략 구현
 * MA 지표를 사용하여 가중치가 적용된 거래 신호를 생성
 * - 단기 및 장기 이동평균의 크로스오버 신호 계산
 * - 하이퍼볼릭 탄젠트 함수를 사용하여 기본 신호 정규화
 * - 추세 확인을 위한 변화율 모멘텀 반영
 * - 포트폴리오 균형을 위한 전략 가중치 적용
 * - 신호 추적을 위한 데이터베이스 저장 구현
 *
 * @param client - PostgreSQL 데이터베이스 연결
 * @param uuid - 전략 실행 식별자
 * @param symbol - 거래 심볼
 * @param weight - 전략 가중치 (기본값: 0.8)
 */
export class MaStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;

	constructor(client: PoolClient, uuid: string, symbol: string, weight = 0.7) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	async execute(): Promise<number> {
		const data = await this.getData();
		const volatility = await this.calculateVolatility();
		const score = await this.score(data);

		if (!this.isValidSignal(score, volatility)) {
			return 0;
		}

		await this.saveData(data, score);
		return score * this.weight;
	}

	private async score(data: {
		short_ma: number;
		long_ma: number;
		prev_short_ma: number;
	}): Promise<number> {
		const { short_ma, long_ma, prev_short_ma } = data;

		// 기본 스코어 (baseScore)
		const baseScore = Math.tanh((5 * (short_ma - long_ma)) / long_ma);

		// 변화율 반영 스코어 (finalScore)
		const rateOfChange = prev_short_ma
			? (short_ma - prev_short_ma) / prev_short_ma
			: 0; // 이전 값이 없으면 변화율은 0

		return baseScore + 0.1 * rateOfChange;
	}

	private async getData(): Promise<iMovingAveragesResult> {
		const result = await this.client.query<iMovingAveragesResult>({
			name: `get_ma_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_RECENT_MA_SIGNALS,
			values: [this.symbol],
		});

		if (result.rows.length === 0) {
			throw new Error(String(getMsg("SIGNAL_MA_ERROR")));
		}

		return result.rows[0];
	}

	private async saveData(
		data: iMovingAveragesResult,
		score: number,
	): Promise<void> {
		await this.client.query(QUERIES.INSERT_MA_SIGNAL, [
			this.uuid,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);
	}

	private async calculateVolatility(): Promise<number> {
		const result = await this.client.query({
			name: `get_volatility_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_PRICE_VOLATILITY,
			values: [this.symbol],
		});

		return result.rows[0]?.volatility ?? 0.1;
	}

	private isValidSignal(score: number, volatility: number): boolean {
		const threshold = 0.2 * (1 + volatility);
		return Math.abs(score) > threshold;
	}
}
