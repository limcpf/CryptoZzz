import type { PoolClient } from "pg";
import { CommonStrategy } from "../../indicators/common/common.strategy";
import { clampScore } from "../../indicators/common/common.utils";
import {
	calculateCrossoverScore,
	calculateHistogramScore,
	calculateTrendStrength,
	calculateZeroLineScore,
} from "../../indicators/common/common.utils";
import { MACDRepository } from "../../indicators/macd/macd.repository";
import type { iMACDResult } from "../../indicators/macd/macd.types";

/**
 * MACD (Moving Average Convergence Divergence) Strategy Implementation
 * - Extends CommonStrategy to provide MACD-specific trading signals
 * - Calculates signals based on MACD, Signal line, and Histogram
 * - Considers trend strength and zero-line crossings
 * - Provides historical data tracking and performance analysis
 *
 * MACD (이동평균수렴확산) 전략 구현
 * - CommonStrategy를 확장하여 MACD 특화 거래 신호 제공
 * - MACD, 시그널 라인, 히스토그램 기반 신호 계산
 * - 추세 강도와 제로라인 크로싱 고려
 * - 과거 데이터 추적 및 성과 분석 제공
 *
 * @extends CommonStrategy
 */
export class MacdStrategy extends CommonStrategy {
	/**
	 * MACD Repository instance for database operations
	 * - Handles MACD data retrieval and signal storage
	 * - Manages database queries for MACD calculations
	 *
	 * MACD 저장소 인스턴스 (데이터베이스 작업용)
	 * - MACD 데이터 조회 및 신호 저장 처리
	 * - MACD 계산을 위한 데이터베이스 쿼리 관리
	 *
	 * @private
	 * @readonly
	 */
	private readonly repository: MACDRepository;

	/**
	 * MACD calculation parameters
	 * MACD 계산 파라미터
	 *
	 * @property {number} lookbackHours - Historical data period in hours (과거 데이터 조회 기간(시간))
	 * @property {number} shortPeriod - Short-term EMA period (단기 지수이동평균 기간)
	 * @property {number} longPeriod - Long-term EMA period (장기 지수이동평균 기간)
	 * @property {number} signalPeriod - Signal line EMA period (시그널 라인 지수이동평균 기간)
	 * @readonly
	 */
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
		super(client, uuid, symbol, weight);
		this.repository = new MACDRepository(client);
		this.params = params ?? {
			lookbackHours: 24,
			shortPeriod: 6,
			longPeriod: 13,
			signalPeriod: 5,
		};
	}

	/**
	 * Implements BaseStrategy's calculateScore method for MACD strategy
	 * - Calculates crossover signal between MACD and signal line
	 * - Evaluates histogram momentum and zero-line crossings
	 * - Applies trend strength as a multiplier
	 *
	 * MACD 전략을 위한 BaseStrategy의 calculateScore 메서드 구현
	 * - MACD와 시그널 라인 간의 크로스오버 신호 계산
	 * - 히스토그램 모멘텀과 제로라인 크로싱 평가
	 * - 추세 강도를 승수로 적용
	 *
	 * @param {iMACDResult} data - MACD calculation results (MACD 계산 결과)
	 * @returns {number} Normalized score between -1 and 1 (정규화된 점수, -1에서 1 사이)
	 */
	protected calculateScore(data: iMACDResult): number {
		const {
			current_macd,
			current_signal,
			prev_macd,
			prev_signal,
			histogram,
			prev_histogram,
		} = data;

		const crossoverScore = calculateCrossoverScore(
			current_macd,
			current_signal,
			prev_macd,
			prev_signal,
		);

		const histogramScore = calculateHistogramScore(histogram, prev_histogram);
		const zeroLineScore = calculateZeroLineScore(current_macd, prev_macd);

		let totalScore = crossoverScore + histogramScore + zeroLineScore;
		totalScore *= calculateTrendStrength(histogram, current_signal);

		return clampScore(totalScore);
	}

	/**
	 * Implements BaseStrategy's getData method for MACD strategy
	 * - Uses MACDRepository to fetch MACD indicator data
	 *
	 * MACD 전략을 위한 BaseStrategy의 getData 메서드 구현
	 * - MACDRepository를 사용하여 MACD 지표 데이터 조회
	 *
	 * @inheritdoc
	 */
	protected async getData(): Promise<iMACDResult> {
		return this.repository.getMACDScore(
			this.symbol,
			this.params.lookbackHours,
			this.params.shortPeriod,
			this.params.longPeriod,
			this.params.signalPeriod,
		);
	}

	/**
	 * Implements BaseStrategy's saveData method for MACD strategy
	 * - Calculates additional MACD-specific metrics (zero crossings and trend strength)
	 * - Delegates signal data persistence to MACDRepository
	 *
	 * MACD 전략을 위한 BaseStrategy의 saveData 메서드 구현
	 * - MACD 특화 지표 계산 (제로 크로싱 및 추세 강도)
	 * - MACDRepository에 신호 데이터 저장을 위임
	 *
	 * @inheritdoc
	 */
	protected async saveData(data: iMACDResult, score: number): Promise<void> {
		const zeroCross =
			Math.sign(data.current_macd) !== Math.sign(data.prev_macd);
		const trendStrength =
			Math.abs(data.histogram) / Math.abs(data.current_signal);

		await this.repository.saveMACDSignal(
			this.uuid,
			data,
			score,
			zeroCross,
			trendStrength,
		);
	}
}
