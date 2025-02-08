import { clampScore, normalizeWithTanh } from "../common/common.utils";

/**
 * %K와 %D의 교차 강도를 계산합니다.
 * Calculates the strength of %K and %D crossover.
 *
 * @param {number} kValue - Fast Stochastic (%K) 값 / Fast Stochastic (%K) value
 * @param {number} dValue - Slow Stochastic (%D) 값 / Slow Stochastic (%D) value
 * @returns {number} 정규화된 교차 점수 (-1 ~ 1) / Normalized crossover score (-1 to 1)
 */
export function calculateStochasticCrossover(
	kValue: number,
	dValue: number,
): number {
	return normalizeWithTanh((kValue - dValue) / 10);
}

/**
 * 과매수/과매도 구간의 강도를 계산합니다.
 * Calculates the strength of overbought/oversold conditions.
 *
 * @param {number} value - 스토캐스틱 값 (보통 %K) / Stochastic value (usually %K)
 * @returns {Object} 과매수/과매도 강도
 *   - overbought: 과매수 강도 (0 ~ 1) / Overbought strength (0 to 1)
 *   - oversold: 과매도 강도 (0 ~ 1) / Oversold strength (0 to 1)
 */
export function calculateExtremeZones(value: number): {
	overbought: number;
	oversold: number;
} {
	return {
		overbought: Math.max(0, (value - 80) / 20),
		oversold: Math.max(0, (20 - value) / 20),
	};
}

/**
 * 스토캐스틱 지표의 최종 매매 신호 점수를 계산합니다.
 * Calculates final trading signal score for Stochastic Oscillator.
 *
 * 계산 과정 / Calculation steps:
 * 1. 교차 점수 계산 (60% 가중치) / Calculate crossover score (60% weight)
 * 2. 과매수 영향 (-30% 가중치) / Apply overbought influence (-30% weight)
 * 3. 과매도 영향 (30% 가중치) / Apply oversold influence (30% weight)
 *
 * @param {number} kValue - Fast Stochastic (%K) 값 / Fast Stochastic (%K) value
 * @param {number} dValue - Slow Stochastic (%D) 값 / Slow Stochastic (%D) value
 * @returns {number} 최종 매매 신호 점수 (-1 ~ 1) / Final trading signal score (-1 to 1)
 */
export function calculateStochasticScore(
	kValue: number,
	dValue: number,
): number {
	const crossoverScore = calculateStochasticCrossover(kValue, dValue);
	const { overbought, oversold } = calculateExtremeZones(kValue);

	let score = normalizeWithTanh(crossoverScore * 2) * 0.6;
	score += normalizeWithTanh(overbought) * -0.3;
	score += normalizeWithTanh(oversold) * 0.3;

	return clampScore(score);
}
