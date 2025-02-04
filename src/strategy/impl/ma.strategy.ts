import type { PoolClient } from "pg";
import type { iMovingAveragesResult } from "../../shared/interfaces/iMarketDataResult";
import i18n from "../../shared/services/i18n";
import { errorHandler, innerErrorHandler } from "../../shared/services/util";
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
	readonly params: {
		shortPeriod: number;
		longPeriod: number;
	};

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: {
			shortPeriod: number;
			longPeriod: number;
		},
		weight = 0.9,
	) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
		this.params = params ?? {
			shortPeriod: 10,
			longPeriod: 20,
		};
	}

	private readonly GET_MA_SCORE = `
	WITH RECURSIVE time_series AS (
    -- 현재 시각부터 15분 단위로 과거 시점들 생성
    SELECT 
        date_trunc('minute', NOW()) AS ts
    UNION ALL
    SELECT 
        ts - INTERVAL '15 minutes'
    FROM time_series
    WHERE ts > NOW() - INTERVAL '6 hours'
),
fifteen_minute_data AS (
    SELECT
        time_series.ts AS bucket,
        symbol,
        AVG(close_price) AS avg_close_price
    FROM time_series
    LEFT JOIN Market_Data md ON 
        md.symbol = $1 AND
        md.timestamp >= time_series.ts - INTERVAL '15 minutes' AND
        md.timestamp < time_series.ts
    GROUP BY time_series.ts, symbol
    HAVING COUNT(symbol) > 0
),
ma_calculations AS (
    SELECT
        bucket,
        symbol,
        avg_close_price,
        -- 단기 MA (10봉 = 약 150분)
        AVG(avg_close_price) OVER (
            ORDER BY bucket
            ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
        ) AS short_ma,
        -- 장기 MA (20봉 = 약 300분)
        AVG(avg_close_price) OVER (
            ORDER BY bucket
            ROWS BETWEEN $3::integer - 1 PRECEDING AND CURRENT ROW
        ) AS long_ma
    FROM fifteen_minute_data
)
SELECT
    symbol,
    bucket as date,
    short_ma,
    long_ma,
    COALESCE(
        LAG(short_ma) OVER (ORDER BY bucket),
        0
    ) AS prev_short_ma
FROM ma_calculations
ORDER BY bucket DESC
LIMIT 1;
	`;

	private readonly INSERT_MA_SIGNAL = `
	    INSERT INTO MaSignal (signal_id, short_ma, long_ma, prev_short_ma, score)
		VALUES ($1, $2, $3, $4, $5);
	`;

	async execute(): Promise<number> {
		let course = "this.getData";
		let score = 0;

		try {
			const data = await this.getData();

			course = "this.score";
			score = await this.score(data);

			course = "score = score * this.weight";
			score = Number((score * this.weight).toFixed(2));

			course = "this.saveData";
			await this.saveData(data, score);

			return score;
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "42P01") {
				errorHandler(this.client, "TABLE_NOT_FOUND", "MA_SIGNAL", error);
			} else {
				innerErrorHandler("SIGNAL_MA_ERROR", error, course);
			}
		}

		return 0;
	}

	private async score(data: {
		short_ma: number;
		long_ma: number;
		prev_short_ma: number;
	}): Promise<number> {
		const { short_ma, long_ma, prev_short_ma } = data;
		// 유효하지 않은 MA 값 필터링
		if (short_ma <= 0 || long_ma <= 0) {
			return 0;
		}

		const maRatio = (short_ma - long_ma) / long_ma;

		// tanh 특성상 자체 클램핑(-1~1) 적용되지만 추가 보정 필요
		const baseScore = Math.tanh(maRatio * 5); // 민감도 3배 증가
		const rateOfChange =
			prev_short_ma > 0 ? (short_ma - prev_short_ma) / prev_short_ma : 0;

		// 최종 점수 클램핑 추가
		const result = Math.max(
			-1,
			Math.min(1, Number((baseScore + 0.1 * rateOfChange).toFixed(2))),
		);
		return result;
	}

	private async getData(): Promise<iMovingAveragesResult> {
		const result = await this.client.query<iMovingAveragesResult>({
			name: `get_ma_${this.symbol}_${this.uuid}`,
			text: this.GET_MA_SCORE,
			values: [this.symbol, this.params.shortPeriod, this.params.longPeriod],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("MA_DATA_NOT_FOUND"));
		}

		const data = result.rows[0];
		// 데이터 유효성 검사 추가
		if (data.short_ma <= 0 || data.long_ma <= 0) {
			throw new Error(i18n.getMessage("MA_INVALID_DATA"));
		}

		return data;
	}

	private async saveData(
		data: iMovingAveragesResult,
		score: number,
	): Promise<void> {
		await this.client.query(this.INSERT_MA_SIGNAL, [
			this.uuid,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);
	}
}
