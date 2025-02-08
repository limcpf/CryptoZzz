import { clampScore, normalizeWithTanh } from "../common/common.utils";

/**
 * 거래량 비율을 기반으로 매매 신호 점수를 계산합니다.
 * Calculates trading signal score based on volume ratio.
 *
 * 계산 과정 / Calculation steps:
 * 1. 거래량 비율에 로그를 적용하여 비대칭성 해결
 *    Apply logarithm to volume ratio to handle asymmetry
 *    (예: 2배 증가와 1/2배 감소를 동일한 크기로 취급)
 *    (e.g., treat 2x increase and 1/2x decrease as equal magnitude)
 * 2. tanh 함수로 정규화하여 -1 ~ 1 범위로 변환
 *    Normalize with tanh function to range -1 to 1
 *
 * @param {number} volumeRatio - 현재 거래량/평균 거래량 비율 / Current volume to average volume ratio
 * @returns {number} 정규화된 거래량 점수 (-1 ~ 1) / Normalized volume score (-1 to 1)
 *   - 양수: 평균 대비 거래량 증가 / Positive: Volume increase compared to average
 *   - 음수: 평균 대비 거래량 감소 / Negative: Volume decrease compared to average
 */
export function calculateVolumeScore(volumeRatio: number): number {
	const normalizedRatio = Math.log(volumeRatio); // 로그를 취해 비율의 비대칭성 해결
	return clampScore(normalizeWithTanh(normalizedRatio));
}
