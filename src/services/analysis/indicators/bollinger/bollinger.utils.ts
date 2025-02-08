import { clampScore, normalizeWithTanh } from "../common/common.utils";
import type { iBollingerData } from "./bollinger.types";

/**
 * 볼린저 밴드 데이터를 기반으로 매매 신호 점수를 계산합니다.
 * Calculates trading signal score based on Bollinger Bands data.
 *
 * 계산 과정 / Calculation steps:
 * 1. 밴드 폭과 중간값 계산 / Calculate band width and middle point
 * 2. 가격 편차 정규화 / Normalize price deviation
 * 3. 밴드 폭 요소 계산 / Calculate width factor
 * 4. 최종 점수 계산 및 범위 제한 / Calculate final score and clamp
 *
 * @param {iBollingerData} data - 볼린저 밴드 데이터 객체 / Bollinger Bands data object
 *   - bollinger_upper: 상단 밴드 / Upper band
 *   - bollinger_middle: 중간 밴드 (SMA) / Middle band (SMA)
 *   - bollinger_lower: 하단 밴드 / Lower band
 *   - close_price: 종가 / Close price
 * @returns {number} 정규화된 매매 신호 점수 (-1 ~ 1) / Normalized trading signal score (-1 to 1)
 */
export function calculateBollingerScore(data: iBollingerData): number {
	const { bollinger_upper, bollinger_middle, bollinger_lower, close_price } =
		data;

	const bandWidth = bollinger_upper - bollinger_lower;
	const halfBandWidth = bandWidth / 2;

	const normalizedDeviation = (close_price - bollinger_middle) / halfBandWidth;

	const widthFactor = normalizeWithTanh(bollinger_middle / bandWidth);

	const score = -normalizeWithTanh(normalizedDeviation) * widthFactor;

	return clampScore(score);
}

/**
 * 볼린저 밴드의 폭을 계산합니다.
 * Calculates the width of Bollinger Bands.
 *
 * @param {number} upper - 상단 밴드 값 / Upper band value
 * @param {number} lower - 하단 밴드 값 / Lower band value
 * @returns {number} 밴드 폭 / Band width
 */
export function calculateBandWidth(upper: number, lower: number): number {
	return upper - lower;
}
