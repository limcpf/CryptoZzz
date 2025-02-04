import type { PoolClient } from "pg";
import i18n from "../../shared/services/i18n";
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
		period = 20,
		hours = 24,
	) {
		this.client = client;
		this.uuid = uuid;
		this.symbol = symbol;
		this.period = period;
		this.hours = hours;
	}

	private readonly GET_BOLLINGER_BANDS = `
	WITH intraday_data AS (
    SELECT
        symbol,
        timestamp,
        close_price,
        AVG(close_price) OVER (
            PARTITION BY symbol
            ORDER BY timestamp
            ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
        ) AS moving_avg,
        STDDEV(close_price) OVER (
            PARTITION BY symbol
            ORDER BY timestamp
            ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
        ) AS moving_stddev
    FROM Market_Data
    WHERE 
        symbol = $1
        AND timestamp >= NOW() - INTERVAL '1 hour' * $3::integer
)
SELECT
    symbol,
    timestamp,
    close_price,
    ROUND(moving_avg + (2 * moving_stddev), 5) AS bollinger_upper,
    ROUND(moving_avg, 5) AS bollinger_middle,
    ROUND(moving_avg - (2 * moving_stddev), 5) AS bollinger_lower
FROM intraday_data
ORDER BY timestamp DESC;
	`;

	private readonly INSERT_BOLLINGER_SIGNAL = `
		INSERT INTO BollingerSignal (
			signal_id,
			upper_band,
			middle_band,
			lower_band,
			close_price,
			band_width,
			score
		) VALUES ($1, $2, $3, $4, $5, $6, $7);
	`;

	async execute(): Promise<number> {
		let course = "this.getData";
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
			throw new Error(i18n.getMessage("BOLLINGER_DATA_ERROR"));
		}
	}

	private calculateScore(data: {
		bollinger_upper: number;
		bollinger_middle: number;
		bollinger_lower: number;
		close_price: number;
	}): number {
		const { bollinger_upper, bollinger_middle, bollinger_lower, close_price } =
			data;

		// 밴드폭 및 절반 폭 계산
		const bandWidth = bollinger_upper - bollinger_lower;
		const halfBandWidth = bandWidth / 2;

		// 중간선에서의 상대적 위치: 가격이 중간선일 경우 0, 상한이면 +1, 하한이면 -1
		const normalizedDeviation =
			(close_price - bollinger_middle) / halfBandWidth;

		// 폭 가중치: 밴드폭이 좁을수록 (즉, 변동성이 낮을수록) 민감도를 높임
		const widthFactor = Math.tanh(bollinger_middle / bandWidth);
		// 민감도 조절 인자 (필요에 따라 조정 가능)
		const sensitivity = 1;

		// tanh 함수를 사용해 부드러운 비선형 스코어 산출
		// 가격이 중간선보다 위이면 normalizedDeviation > 0 → tanh(양수) > 0,
		// 그런데 과매수(가격이 너무 높음)는 매도 신호이므로 부호 반전하여 음수를 만듦.
		let score = -Math.tanh(normalizedDeviation * sensitivity) * widthFactor;
		// -1 ~ 1 사이로 클램프
		score = Math.max(-1, Math.min(1, score));

		return score;
	}

	private async getData(): Promise<{
		bollinger_upper: number;
		bollinger_middle: number;
		bollinger_lower: number;
		close_price: number;
	}> {
		const result = await this.client.query({
			name: `get_bollinger_${this.symbol}_${this.uuid}`,
			text: this.GET_BOLLINGER_BANDS,
			values: [this.symbol, this.period, this.hours],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("BOLLINGER_DATA_ERROR"));
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

		await this.client.query(this.INSERT_BOLLINGER_SIGNAL, [
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
