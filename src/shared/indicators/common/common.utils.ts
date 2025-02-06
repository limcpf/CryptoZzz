import type { PoolClient, QueryResult, QueryResultRow } from "pg";
import type { MSG } from "../../services/i18n/msg/msg.const";
import { errorHandler, innerErrorHandler } from "../../services/util";

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
 *
 * @param {number} value - The value to normalize (정규화할 값)
 * @param {number} [factor=1] - Scaling factor for normalization (정규화를 위한 스케일링 팩터)
 * @returns {number} - Normalized value between -1 and 1 (-1과 1 사이로 정규화된 값)
 */
export function normalizeWithTanh(value: number, factor = 1): number {
	return Math.tanh(value * factor);
}

/**
 * Clamps a value between -1 and 1 with optional decimal places
 * 값을 -1과 1 사이로 제한하고 선택적으로 소수점 자릿수를 지정합니다
 *
 * @param {number} value - The value to clamp (제한할 값)
 * @param {number} [decimals=2] - Number of decimal places (소수점 자릿수)
 * @returns {number} - Clamped value between -1 and 1 (-1과 1 사이로 제한된 값)
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
