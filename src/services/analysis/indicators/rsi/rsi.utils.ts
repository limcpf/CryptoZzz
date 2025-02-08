import { clampScore, normalizeWithTanh } from "../common/common.utils";

export function calculateRSIScore(
	rsi: number,
	oversoldThreshold: number,
	overboughtThreshold: number,
): number {
	if (rsi <= oversoldThreshold) {
		return normalizeWithTanh((oversoldThreshold - rsi) / 10);
	}

	if (rsi >= overboughtThreshold) {
		return -normalizeWithTanh((rsi - overboughtThreshold) / 10);
	}
	return normalizeWithTanh((rsi - 50) / 20);
}

export function calculateMomentumScore(
	currentRsi: number,
	prevRsiValues: number[],
	momentumWeight: number,
): number {
	if (prevRsiValues.length === 0) return 0;

	const deltas = prevRsiValues.map((prevRsi) => currentRsi - prevRsi);
	const averageDelta =
		deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;

	return momentumWeight * normalizeWithTanh(averageDelta / 10);
}

export function calculateFinalScore(
	baseScore: number,
	momentumScore: number,
): number {
	return clampScore(baseScore + momentumScore);
}
