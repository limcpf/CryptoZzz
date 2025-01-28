import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * Stochastic Oscillator Strategy Implementation
 * 스토캐스틱 오실레이터 전략 구현
 * - %K와 %D의 상호 관계 분석
 * - 과매수/과매도 구간에서의 신호 강화
 * - 크로스오버 패턴 감지
 * - 비선형 점수 변환을 위한 쌍곡탄젠트 함수 적용
 */
export class StochasticStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;
	readonly params: {
		kPeriod: number;
		dPeriod: number;
		lookbackDays: number;
	};

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: {
			kPeriod: number;
			dPeriod: number;
			lookbackDays: number;
		},
		weight = 0.8,
	) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
		this.params = params ?? {
			kPeriod: 14,
			dPeriod: 3,
			lookbackDays: 3,
		};
	}

	async execute(): Promise<number> {
		const data = await this.getData();
		const score = this.calculateScore(data);
		await this.saveData(data, score);
		return score * this.weight;
	}

	private calculateScore(data: {
		k_value: number;
		d_value: number;
	}): number {
		const { k_value, d_value } = data;

		// 기본 크로스오버 점수
		const crossoverScore = Math.tanh((k_value - d_value) / 10);

		// 과매수/과매도 구간 가중치
		const overboughtWeight = Math.max(0, (k_value - 80) / 20);
		const oversoldWeight = Math.max(0, (20 - k_value) / 20);

		// 비선형 점수 조합
		let score = Math.tanh(crossoverScore * 2) * 0.6;
		score += Math.tanh(overboughtWeight) * -0.3;
		score += Math.tanh(oversoldWeight) * 0.3;

		return Math.max(-1, Math.min(1, score));
	}

	private async getData(): Promise<{
		k_value: number;
		d_value: number;
	}> {
		const result = await this.client.query({
			name: `get_stochastic_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_STOCHASTIC_OSCILLATOR,
			values: [
				this.symbol,
				this.params.lookbackDays * 1440, // days to minutes
				this.params.kPeriod,
				this.params.dPeriod,
			],
		});

		if (result.rows.length === 0) {
			throw new Error(String(getMsg("STOCHASTIC_DATA_ERROR")));
		}

		return result.rows[0];
	}

	private async saveData(
		data: { k_value: number; d_value: number },
		score: number,
	): Promise<void> {
		// 시그널 로그 생성
		const signalLog = await this.client.query({
			name: `insert_signal_log_${this.symbol}_${this.uuid}`,
			text: QUERIES.INSERT_SIGNAL_LOG,
			values: [this.symbol, new Date().toISOString()],
		});

		// 스토캐스틱 신호 저장
		await this.client.query({
			name: `insert_stochastic_signal_${this.symbol}_${this.uuid}`,
			text: QUERIES.INSERT_STOCHASTIC_SIGNAL,
			values: [
				signalLog.rows[0].id, // SignalLog ID
				data.k_value,
				data.d_value,
				score,
			],
		});
	}
}
