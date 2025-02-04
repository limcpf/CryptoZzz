import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import i18n from "../../shared/services/i18n";
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

	private readonly GET_STOCHASTIC_OSCILLATOR = `
	WITH 
	daily_data AS (
		SELECT 
			symbol,
			date,
			high_price,
			low_price,
			avg_close_price AS close
		FROM Daily_Market_Data
		WHERE symbol = $1
			AND date < CURRENT_DATE
	),
	minute_data AS (
		SELECT
			time_bucket(($4::integer || ' minutes')::interval, timestamp) AS bucket,
			symbol,
			MAX(high_price) AS high,
			MIN(low_price) AS low,
			LAST(close_price, timestamp) AS close
		FROM Market_Data
		WHERE symbol = $1
			AND timestamp >= NOW() - ($4::integer * INTERVAL '1 minute')
		GROUP BY bucket, symbol
	),
	combined_data AS (
		SELECT 
			date::timestamp AS bucket, 
			symbol,
			high_price AS high,
			low_price AS low,
			close
		FROM daily_data
		UNION ALL
		SELECT 
			bucket,
			symbol,
			high,
			low,
			close
		FROM minute_data
	),
	raw_k_values AS (
		SELECT
			bucket,
			symbol,
			close,
			MIN(low) OVER w AS period_low,
			MAX(high) OVER w AS period_high,
			close - MIN(low) OVER w AS numerator,
			NULLIF(MAX(high) OVER w - MIN(low) OVER w, 0) AS denominator
		FROM combined_data
		WINDOW w AS (PARTITION BY symbol ORDER BY bucket ROWS BETWEEN ($2::integer * 1440) PRECEDING AND CURRENT ROW)
	),
	k_values AS (
		SELECT
			bucket,
			symbol,
			(numerator / denominator * 100) AS percent_k
		FROM raw_k_values
	)
	SELECT
		bucket AS timestamp,
		ROUND(percent_k::numeric, 2) AS k_value,
		ROUND(AVG(percent_k) OVER (ORDER BY bucket ROWS BETWEEN $3::integer PRECEDING AND CURRENT ROW)::numeric, 2) AS d_value
	FROM k_values
	ORDER BY bucket DESC
	LIMIT 1;
	`;

	private readonly INSERT_STOCHASTIC_SIGNAL = `
		INSERT INTO StochasticSignal (signal_id, k_value, d_value, score)
		VALUES ($1, $2, $3, $4);
	`;

	async execute(): Promise<number> {
		let course = "this.execute";
		let score = 0;

		try {
			const data = await this.getData();

			course = "this.calculateScore";
			score = this.calculateScore(data);

			course = "this.weight";
			score = Number((score * this.weight).toFixed(2));

			course = "this.saveData";
			await this.saveData(data, score);

			return score;
		} catch (error) {
			throw new Error(i18n.getMessage("STOCHASTIC_DATA_ERROR"));
		}
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
			text: this.GET_STOCHASTIC_OSCILLATOR,
			values: [
				this.symbol,
				this.params.lookbackDays,
				this.params.kPeriod,
				this.params.dPeriod,
			],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("STOCHASTIC_DATA_ERROR"));
		}

		return result.rows[0];
	}

	private async saveData(
		data: { k_value: number; d_value: number },
		score: number,
	): Promise<void> {
		// 스토캐스틱 신호 저장
		await this.client.query({
			name: `insert_sto_sgn_${this.symbol}_${this.uuid}`,
			text: this.INSERT_STOCHASTIC_SIGNAL,
			values: [
				this.uuid, // SignalLog ID
				data.k_value,
				data.d_value,
				score,
			],
		});
	}
}
