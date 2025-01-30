import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * Bollinger Bands Strategy Implementation
 * Generates trading signals based on price position relative to volatility bands
 * - Calculates score using hyperbolic tangent function for nonlinear normalization
 * - Adjusts sensitivity based on band width changes
 * - Implements boundary enforcement for upper/lower bands
 *
 * 볼린저 밴드 전략 구현
 * 가격의 변동성 밴드 상대 위치를 기반으로 거래 신호 생성
 * - 비선형 정규화를 위해 쌍곡탄젠트 함수 사용
 * - 밴드 폭 변화에 따른 민감도 조절
 * - 상한/하한 밴드 경계 강화
 *
 * @param client - PostgreSQL 데이터베이스 연결
 * @param uuid - 전략 실행 식별자
 * @param symbol - 거래 심볼
 * @param period - 볼린저 밴드 계산 기간 (기본값: 50)
 * @param hours - 데이터 분석 시간 창 (기본값: 2)
 */
export class BollingerStrategy implements iStrategy {
	readonly weight = 0.85;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;
	readonly period: number;
	readonly hours: number;

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		period = 50,
		hours = 2,
	) {
		this.client = client;
		this.uuid = uuid;
		this.symbol = symbol;
		this.period = period;
		this.hours = hours;
	}

	async execute(): Promise<number> {
		const data = await this.getData();
		const score = this.calculateScore(data);
		await this.saveData(data, score);
		return score * this.weight;
	}

	private calculateScore(data: {
		bollinger_upper: number;
		bollinger_middle: number;
		bollinger_lower: number;
		close_price: number;
	}): number {
		const { close_price, bollinger_upper, bollinger_middle, bollinger_lower } =
			data;
		const bandWidth = bollinger_upper - bollinger_lower;

		// 밴드 중간선 대비 현재 가격 위치 (정규화)
		const normalizedPosition =
			(close_price - bollinger_middle) / (bollinger_upper - bollinger_middle);

		// 밴드 폭 가중치 (밴드가 좁을수록 민감도 증가)
		const widthFactor = Math.tanh(1 / (bandWidth / bollinger_middle));

		// 비선형 스코어 계산
		const rawScore = Math.tanh(normalizedPosition * 3) * widthFactor;

		// 상한/하한 경계 강화
		if (close_price > bollinger_upper * 0.98) return -1;
		if (close_price < bollinger_lower * 1.02) return 1;

		return Math.max(-1, Math.min(1, rawScore));
	}

	private async getData(): Promise<{
		bollinger_upper: number;
		bollinger_middle: number;
		bollinger_lower: number;
		close_price: number;
	}> {
		const result = await this.client.query({
			name: `get_bollinger_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_BOLLINGER_BANDS,
			values: [this.symbol, this.period, this.hours],
		});

		if (result.rows.length === 0) {
			throw new Error(String(getMsg("BOLLINGER_DATA_ERROR")));
		}

		return result.rows[0];
	}

	private async saveData(
		data: {
			bollinger_upper: number;
			bollinger_middle: number;
			bollinger_lower: number;
			close_price: number;
		},
		score: number,
	): Promise<void> {
		const bandWidth = data.bollinger_upper - data.bollinger_lower;

		await this.client.query(QUERIES.INSERT_BOLLINGER_SIGNAL, [
			this.uuid,
			data.bollinger_upper,
			data.bollinger_middle,
			data.bollinger_lower,
			data.close_price,
			bandWidth,
			score,
		]);
	}
}
