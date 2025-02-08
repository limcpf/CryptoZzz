import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type { MSG } from "../../../../shared/services/i18n/msg/msg.const";
import {
	errorHandler,
	innerErrorHandler,
} from "../../../../shared/services/util";

/**
 * Applies a weight to a score and rounds the result to two decimal places.
 * 점수에 가중치를 적용한 후, 결과를 소수점 두 자리로 반올림합니다.
 *
 * @param {number} score - The original score value. (원래의 점수 값)
 * @param {number} weight - The weight factor to be applied. (적용할 가중치 값)
 * @returns {number} - The weighted and rounded score. (가중치가 적용되고 반올림된 점수)
 */
export function applyWeight(score: number, weight: number): number {
	return Number((score * weight).toFixed(2));
}

/**
 * Handles strategy errors by checking for specific error codes and delegating to the appropriate error handler.
 * 특정 오류 코드를 확인하여 적절한 오류 처리기로 위임함으로써 전략 오류를 처리합니다.
 *
 * @param {PoolClient} client - PostgreSQL database client connection. (PostgreSQL 데이터베이스 클라이언트 연결)
 * @param {unknown} error - The error object that occurred. (발생한 오류 객체)
 * @param {string} course - A string identifier indicating the process or method where the error occurred. (오류가 발생한 과정 또는 메서드 식별자)
 * @param {string} tableName - The name of the database table involved in the error. (오류와 관련된 데이터베이스 테이블 명)
 * @param {keyof MSG} defaultError - The default error message key to be used if error code doesn't match. (오류 코드가 일치하지 않을 경우 사용할 기본 오류 메시지 키)
 * @returns {void}
 */
export function handleStrategyError(
	client: PoolClient,
	error: unknown,
	course: string,
	tableName: string,
	defaultError: keyof MSG,
): void {
	if (error instanceof Error && "code" in error && error.code === "42P01") {
		errorHandler(client, "TABLE_NOT_FOUND", tableName, error);
	} else {
		innerErrorHandler(defaultError, error, course);
	}
}

/**
 * Validates the query result and returns the first row if available.
 * 쿼리 결과의 행 존재 여부를 확인하고, 행이 있을 경우 첫 번째 행을 반환합니다.
 *
 * @template T extends QueryResultRow
 * @param {QueryResult<T>} result - The result of the executed query. (실행된 쿼리의 결과)
 * @param {string} errorMessage - The error message to throw if no rows are found. (행이 존재하지 않을 시 throw할 오류 메시지)
 * @returns {T} - The first row of the query result. (쿼리 결과의 첫 번째 행)
 * @throws {Error} - Throws an error with the provided errorMessage if no rows are found. (행이 없을 경우 전달된 errorMessage를 포함한 오류를 throw함)
 */
export function validateQueryResult<T extends QueryResultRow>(
	result: QueryResult<T>,
	errorMessage: string,
): T {
	if (result.rowCount === 0) {
		throw new Error(errorMessage);
	}
	return result.rows[0];
}

/**
 * Normalizes a value using hyperbolic tangent function
 * 쌍곡선 탄젠트 함수를 사용하여 값을 정규화합니다
 */
export function normalizeWithTanh(value: number, factor = 1): number {
	return Math.tanh(value * factor);
}

/**
 * Clamps a value between -1 and 1 with optional decimal places
 * 값을 -1과 1 사이로 제한하고 선택적으로 소수점 자릿수를 지정합니다
 */
export function clampScore(value: number, decimals = 2): number {
	return Number(Math.max(-1, Math.min(1, value)).toFixed(decimals));
}

/**
 * Combines multiple signals with optional weights
 * 여러 신호를 선택적 가중치와 함께 결합합니다
 *
 * @param {Array<{value: number, weight?: number}>} signals - Array of signals with optional weights (선택적 가중치가 있는 신호 배열)
 * @returns {number} - Combined and normalized signal (-1과 1 사이로 정규화된 결합된 신호)
 */
export function combineSignals(
	signals: Array<{ value: number; weight?: number }>,
): number {
	const totalWeight = signals.reduce(
		(sum, signal) => sum + (signal.weight ?? 1),
		0,
	);
	const weightedSum = signals.reduce(
		(sum, signal) => sum + signal.value * (signal.weight ?? 1),
		0,
	);

	return clampScore(weightedSum / totalWeight);
}

/**
 * MACD 크로스오버 점수 계산
 * @param currentValue 현재 MACD 값
 * @param currentSignal 현재 시그널 값
 * @param prevValue 이전 MACD 값
 * @param prevSignal 이전 시그널 값
 * @param maxWeight 최대 가중치 (기본값: 0.4)
 * @returns 크로스오버 점수
 */
export function calculateCrossoverScore(
	currentValue: number,
	currentSignal: number,
	prevValue: number,
	prevSignal: number,
	maxWeight = 0.4,
): number {
	const currentCross = currentValue - currentSignal;
	const prevCross = prevValue - prevSignal;

	if (Math.sign(currentCross) === Math.sign(prevCross)) return 0;

	const crossStrength =
		Math.abs(currentCross - prevCross) / Math.abs(currentSignal);
	return Math.sign(currentCross) * maxWeight * Math.min(1, crossStrength);
}

/**
 * 히스토그램 변화 점수 계산
 * @param currentHistogram 현재 히스토그램 값
 * @param prevHistogram 이전 히스토그램 값
 * @param maxWeight 최대 가중치 (기본값: 0.3)
 * @returns 히스토그램 변화 점수
 */
export function calculateHistogramScore(
	currentHistogram: number,
	prevHistogram: number,
	maxWeight = 0.3,
): number {
	const histogramChange = currentHistogram - prevHistogram;
	const strength = Math.abs(histogramChange) / Math.abs(prevHistogram);
	return Math.sign(histogramChange) * maxWeight * Math.min(1, strength);
}

/**
 * 제로라인 크로스 점수 계산
 * @param currentValue 현재 값
 * @param prevValue 이전 값
 * @param crossWeight 크로스 가중치 (기본값: 0.3)
 * @param approachWeight 접근 가중치 (기본값: 0.15)
 * @returns 제로라인 관련 점수
 */
export function calculateZeroLineScore(
	currentValue: number,
	prevValue: number,
	crossWeight = 0.3,
	approachWeight = 0.15,
): number {
	const zeroLineDistance = Math.abs(currentValue);
	const strength = Math.min(1, zeroLineDistance / Math.abs(prevValue));

	return (
		Math.sign(currentValue) *
		(Math.sign(currentValue) !== Math.sign(prevValue)
			? crossWeight * strength
			: approachWeight * (1 - strength))
	);
}

/**
 * 추세 강도 계수 계산
 * @param histogram 현재 히스토그램 값
 * @param referenceValue 참조 값 (일반적으로 시그널 값)
 * @returns 추세 강도 계수
 */
export function calculateTrendStrength(
	histogram: number,
	referenceValue: number,
): number {
	const trendStrength = Math.abs(histogram) / Math.abs(referenceValue);
	return 1 + Math.tanh(trendStrength);
}
