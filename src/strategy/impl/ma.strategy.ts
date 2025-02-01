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

	constructor(client: PoolClient, uuid: string, symbol: string, weight = 0.9) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	private readonly GET_MA_SCORE = `
		WITH
			-- 실시간(오늘) 데이터 집계
			today_data AS (
				SELECT
					symbol,
					NOW()::DATE AS date,
					AVG(close_price) AS avg_close_price,
					NULL::NUMERIC AS high_price,  -- Daily_Market_Data 구조에 맞게 추가
					NULL::NUMERIC AS low_price,   -- 누락된 컬럼 보완
					SUM(volume) AS total_volume
				FROM Market_Data
				WHERE symbol = $1
					AND timestamp >= NOW()::DATE
				GROUP BY symbol
			),
			-- 과거 데이터와 실시간 데이터 결합
			combined_data AS (
				SELECT symbol, date, avg_close_price, high_price, low_price, total_volume 
				FROM Daily_Market_Data
				UNION ALL
				SELECT symbol, date, avg_close_price, high_price, low_price, total_volume 
				FROM today_data
			),
			-- MA 계산
			ma_calculations AS (
				SELECT
					symbol,
					date,
					avg_close_price,
					-- 단기 MA (5일)
					AVG(avg_close_price) OVER (
						PARTITION BY symbol
						ORDER BY date
						ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
					) AS short_ma,
					-- 장기 MA (20일)
					AVG(avg_close_price) OVER (
						PARTITION BY symbol
						ORDER BY date
						ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
					) AS long_ma
				FROM combined_data
			),
			-- 이전 단기 MA 계산 (분리된 단계에서 처리)
			prev_ma_calculations AS (
				SELECT
					*,
					COALESCE(
						LAG(short_ma) OVER (
							PARTITION BY symbol
							ORDER BY date
						),
						0
					) AS prev_short_ma
				FROM ma_calculations
			)
		SELECT
			symbol,
			date,
			short_ma,
			long_ma,
			prev_short_ma
		FROM prev_ma_calculations
		WHERE date >= NOW()::DATE - INTERVAL '20 days'
		ORDER BY symbol, date;
	`;

	private readonly INSERT_MA_SIGNAL = `
	    INSERT INTO MaSignal (signal_id, short_ma, long_ma, prev_short_ma, score)
		VALUES ($1, $2, $3, $4, $5);
	`;

	private readonly GET_PRICE_VOLATILITY = `
        WITH hourly_prices AS (
            SELECT 
                symbol,
                date_trunc('hour', timestamp) as hour,
                AVG(close_price) as avg_price
            FROM Market_Data
            WHERE 
                symbol = $1
                AND timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY symbol, date_trunc('hour', timestamp)
        ),
        price_changes AS (
            SELECT 
                symbol,
                hour,
                avg_price,
                ((avg_price - LAG(avg_price) OVER (ORDER BY hour)) / LAG(avg_price) OVER (ORDER BY hour)) as price_change
            FROM hourly_prices
        )
        SELECT 
            symbol,
            COALESCE(
                STDDEV(price_change) * SQRT(24), -- 24시간 기준으로 변동성 연율화
                0.1 -- 데이터가 부족할 경우 기본값
            ) as volatility
        FROM price_changes
        GROUP BY symbol;
    `;

	async execute(): Promise<number> {
		let course = "this.getData";
		let score = 0;

		try {
			const data = await this.getData();

			course = "this.calculateVolatility";
			const volatility = await this.calculateVolatility();

			course = "this.score";
			score = await this.score(data);

			course = "this.isValidSignal";

			if (!this.isValidSignal(score, volatility)) {
				score = 0;
			}

			course = "this.saveData";
			await this.saveData(data, score);
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "42P01") {
				errorHandler(this.client, "TABLE_NOT_FOUND", "MA_SIGNAL", error);
			} else {
				innerErrorHandler("SIGNAL_MA_ERROR", error, course);
			}
		}

		return score * this.weight;
	}

	private async score(data: {
		short_ma: number;
		long_ma: number;
		prev_short_ma: number;
	}): Promise<number> {
		const { short_ma, long_ma, prev_short_ma } = data;

		console.log("short_ma : ", short_ma);
		console.log("long_ma : ", long_ma);
		console.log("prev_short_ma : ", prev_short_ma);

		// 유효하지 않은 MA 값 필터링
		if (short_ma <= 0 || long_ma <= 0) {
			return 0;
		}

		const maRatio = (short_ma - long_ma) / long_ma;

		// 비정상적으로 큰 값 방지를 위한 클램핑
		const clampedRatio = Math.max(-0.5, Math.min(0.5, maRatio));
		console.log("clampedRatio : ", clampedRatio);
		const baseScore = Math.tanh(5 * clampedRatio);
		console.log("baseScore : ", baseScore);

		// 변화율 계산 시 이전 값 유효성 검사
		const rateOfChange =
			prev_short_ma > 0 ? (short_ma - prev_short_ma) / prev_short_ma : 0;
		console.log("rateOfChange : ", rateOfChange);
		return Number((baseScore + 0.1 * rateOfChange).toFixed(2));
	}

	private async getData(): Promise<iMovingAveragesResult> {
		const result = await this.client.query<iMovingAveragesResult>({
			name: `get_ma_${this.symbol}_${this.uuid}`,
			text: this.GET_MA_SCORE,
			values: [this.symbol],
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
		console.log("[MA] saveData");

		const { command } = await this.client.query(this.INSERT_MA_SIGNAL, [
			this.uuid,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);

		console.log("command : ", command);
	}

	private async calculateVolatility(): Promise<number> {
		const result = await this.client.query<{ volatility: number }>({
			name: `get_volatility_${this.symbol}_${this.uuid}`,
			text: this.GET_PRICE_VOLATILITY,
			values: [this.symbol],
		});

		return result.rows[0]?.volatility ?? 0.1;
	}

	private isValidSignal(score: number, volatility: number): boolean {
		const threshold = 0.2 * (1 + volatility);
		console.log("score : ", score);
		console.log("threshold : ", threshold);
		return Math.abs(score) > threshold;
	}
}
