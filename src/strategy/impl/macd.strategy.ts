import type { PoolClient } from "pg";
import type { iMACDResult } from "../../shared/interfaces/iMarketDataResult";
import i18n from "../../shared/services/i18n";
import { errorHandler, innerErrorHandler } from "../../shared/services/util";
import type { iStrategy } from "../iStrategy";

/**
 * MACD (Moving Average Convergence Divergence) Strategy Implementation
 * 1시간 봉 기준 MACD 지표를 사용하여 단타 매매 신호 생성
 * - 골든크로스/데드크로스 감지
 * - 히스토그램 변화 분석
 * - 0라인 돌파 확인
 * - 추세 강도 측정
 */
export class MacdStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;
	readonly params: {
		lookbackHours: number;
		shortPeriod: number;
		longPeriod: number;
		signalPeriod: number;
	};

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: {
			lookbackHours: number;
			shortPeriod: number;
			longPeriod: number;
			signalPeriod: number;
		},
		weight = 0.95,
	) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
		this.params = params ?? {
			lookbackHours: 24,
			shortPeriod: 6,
			longPeriod: 13,
			signalPeriod: 5,
		};
	}

	private readonly GET_MACD_ANALYSIS = `
        WITH RECURSIVE time_intervals AS (
            SELECT 
                NOW() as interval_start
            UNION ALL
            SELECT 
                interval_start - INTERVAL '60 minutes'
            FROM time_intervals
            WHERE interval_start > NOW() - ($2 * INTERVAL '60 minutes')
        ),
        hourly_candles AS (
            SELECT
                ti.interval_start,
                md.symbol,
                (array_agg(md.open_price ORDER BY timestamp ASC))[1] as open_price,
                MAX(md.high_price) as high_price,
                MIN(md.low_price) as low_price,
                (array_agg(md.close_price ORDER BY timestamp DESC))[1] as close_price,
                SUM(md.volume) as volume
            FROM time_intervals ti
            LEFT JOIN Market_Data md 
                ON md.symbol = $1 
                AND md.timestamp > ti.interval_start - INTERVAL '60 minutes' 
                AND md.timestamp <= ti.interval_start
            GROUP BY ti.interval_start, md.symbol
        ),
        initial_ema AS (
            SELECT 
                interval_start as timestamp,
                close_price,
                symbol,
                AVG(close_price) OVER (
                    ORDER BY interval_start ASC
                    ROWS BETWEEN ($3 - 1) PRECEDING AND CURRENT ROW
                ) as ema_short,
                AVG(close_price) OVER (
                    ORDER BY interval_start ASC
                    ROWS BETWEEN ($4 - 1) PRECEDING AND CURRENT ROW
                ) as ema_long
            FROM hourly_candles
        ),
        ema_calc AS (
            SELECT 
                timestamp,
                close_price,
                symbol,
                CASE 
                    WHEN LAG(ema_short, 1) OVER (ORDER BY timestamp ASC) IS NULL 
                        THEN close_price 
                        ELSE (close_price * (2.0 / ($3 + 1))) 
                            + (LAG(ema_short, 1) OVER (ORDER BY timestamp ASC) * (1 - (2.0 / ($3 + 1))))
                END as ema_short,
                CASE 
                    WHEN LAG(ema_long, 1) OVER (ORDER BY timestamp ASC) IS NULL 
                        THEN close_price 
                        ELSE (close_price * (2.0 / ($4 + 1))) 
                            + (LAG(ema_long, 1) OVER (ORDER BY timestamp ASC) * (1 - (2.0 / ($4 + 1))))
                END as ema_long
            FROM initial_ema
        ),
        macd_calc AS (
            SELECT 
                timestamp,
                (ema_short - ema_long) as macd_line,
                ema_short,
                ema_long
            FROM ema_calc
            WHERE ema_short IS NOT NULL AND ema_long IS NOT NULL
        ),
        signal_calc AS (
            SELECT 
                timestamp,
                macd_line,
                AVG(macd_line) OVER (
                    ORDER BY timestamp ASC
                    ROWS BETWEEN ($5 - 1) PRECEDING AND CURRENT ROW
                ) as signal_line
            FROM macd_calc
        )
        SELECT 
            macd_line as current_macd,
            signal_line as current_signal,
            LAG(macd_line) OVER (ORDER BY timestamp ASC) as prev_macd,
            LAG(signal_line) OVER (ORDER BY timestamp ASC) as prev_signal,
            (macd_line - signal_line) as histogram,
            LAG(macd_line - signal_line) OVER (ORDER BY timestamp ASC) as prev_histogram
        FROM signal_calc
        ORDER BY timestamp DESC
        LIMIT 1;
	`;

	private readonly INSERT_MACD_SIGNAL = `
        INSERT INTO MacdSignal (
            signal_id,
            macd_line,
            signal_line,
            histogram,
            zero_cross,
        trend_strength,
            score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);
    `;

	async execute(): Promise<number> {
		let course = "this.getData";
		let score = 0;
		try {
			const macdData = await this.getData();

			course = "this.calculateScore";
			score = this.calculateScore(macdData);

			course = "score = score * this.weight";
			score = Number((score * this.weight).toFixed(2));

			course = "this.saveData";
			await this.saveData(macdData, score);

			return score;
		} catch (error) {
			if (error instanceof Error && "code" in error && error.code === "42P01") {
				errorHandler(this.client, "TABLE_NOT_FOUND", "MACD_SIGNAL", error);
			} else {
				innerErrorHandler("MACD_DATA_ERROR", error, course);
			}
		}

		return 0;
	}

	private calculateScore(data: iMACDResult): number {
		const {
			current_macd,
			current_signal,
			prev_macd,
			prev_signal,
			histogram,
			prev_histogram,
		} = data;

		let score = 0;

		// 1. 크로스오버 신호 (최대 가중치: 0.4)
		const currentCross = current_macd - current_signal;
		const prevCross = prev_macd - prev_signal;
		if (Math.sign(currentCross) !== Math.sign(prevCross)) {
			const crossStrength =
				Math.abs(currentCross - prevCross) / Math.abs(current_signal);
			score += Math.sign(currentCross) * 0.4 * Math.min(1, crossStrength);
		}

		// 2. 히스토그램 변화 (최대 가중치: 0.3)
		const histogramChange = histogram - prev_histogram;
		const histogramStrength =
			Math.abs(histogramChange) / Math.abs(prev_histogram);
		score += Math.sign(histogramChange) * 0.3 * Math.min(1, histogramStrength);
		// 3. 0라인 돌파 (최대 가중치: 0.3)
		const zeroLineDistance = Math.abs(current_macd);
		const zeroLineCrossStrength = Math.min(
			1,
			zeroLineDistance / Math.abs(prev_macd),
		);
		if (Math.sign(current_macd) !== Math.sign(prev_macd)) {
			score += Math.sign(current_macd) * 0.3 * zeroLineCrossStrength;
		} else {
			// 0라인에 가까워지는 정도도 반영
			score += Math.sign(current_macd) * 0.15 * (1 - zeroLineCrossStrength);
		}
		// 추세 강도에 따른 스코어 조정
		const trendStrength = Math.abs(histogram) / Math.abs(current_signal);
		score *= 1 + Math.tanh(trendStrength);

		// 최종 스코어를 -1에서 1 사이로 정규화
		score = Math.max(-1, Math.min(1, score));
		return score;
	}

	private async getData(): Promise<iMACDResult> {
		const result = await this.client.query<iMACDResult>({
			name: `get_macd_${this.symbol}_${this.uuid}`,
			text: this.GET_MACD_ANALYSIS,
			values: [
				this.symbol, // $1: 심볼
				this.params.lookbackHours, // $2: 분석 기간 (시간)
				this.params.shortPeriod, // $3: 단기 EMA 기간
				this.params.longPeriod, // $4: 장기 EMA 기간
				this.params.signalPeriod, // $5: 시그널 라인 기간
			],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("SIGNAL_MACD_ERROR"));
		}

		return result.rows[0];
	}

	private async saveData(data: iMACDResult, score: number): Promise<void> {
		const zeroCross =
			Math.sign(data.current_macd) !== Math.sign(data.prev_macd);
		const trendStrength =
			Math.abs(data.histogram) / Math.abs(data.current_signal);

		await this.client.query(this.INSERT_MACD_SIGNAL, [
			this.uuid,
			data.current_macd,
			data.current_signal,
			data.histogram,
			zeroCross,
			trendStrength,
			score,
		]);
	}
}
