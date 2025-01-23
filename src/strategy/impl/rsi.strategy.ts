import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iRSIResult } from "../../shared/interfaces/iMarketDataResult";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * RSI (Relative Strength Index) Strategy Implementation
 * Analyzes market data using RSI indicator to generate trading signals with weighted scoring
 * - Calculates buy signals when RSI falls below 30 (oversold) using sigmoid function
 * - Calculates sell signals when RSI rises above 70 (overbought) with linear scaling
 * - Implements neutral zone scoring between 30-70 range
 * - Incorporates historical RSI momentum by analyzing recent signal changes
 * - Applies configurable strategy weight for portfolio balance
 *
 * RSI (상대강도지수) 전략 구현
 * RSI 지표를 사용하여 가중치가 적용된 거래 신호를 생성
 * - RSI가 30 이하일 때 시그모이드 함수를 사용하여 매수 신호 계산 (과매도)
 * - RSI가 70 이상일 때 선형 스케일링으로 매도 신호 계산 (과매수)
 * - 30-70 구간에서는 중립 구간 점수 계산
 * - 최근 RSI 변화량을 분석하여 모멘텀 반영
 * - 포트폴리오 균형을 위한 전략 가중치 적용
 *
 * @param client - PostgreSQL 데이터베이스 연결
 * @param uuid - 전략 실행 식별자
 * @param symbol - 거래 심볼
 * @param weight - 전략 가중치 (기본값: 0.7)
 * @param period - RSI 계산 기간 (기본값: 14)
 */
export class RsiStrategy implements iStrategy {
	private readonly period: number = 14;
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		weight = 0.7,
		period = 14,
	) {
		this.client = client;
		this.weight = weight;
		this.period = period;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	async execute(): Promise<number> {
		const rsi = await this.getData();

		const score = await this.score(rsi);

		this.saveData(rsi, score);

		return score * this.weight;
	}

	private async score(rsi: number): Promise<number> {
		let score = 0;
		if (rsi <= 30) {
			score = 1 / (1 + Math.exp(-(30 - rsi) / 5)) - 0.5;
		} else if (rsi >= 70) {
			score = -(rsi - 70) / 30; // 매도세 강화
		} else {
			score = (rsi - 50) / 20; // 중립 범위
		}

		const prevRsiValues = await this.getRecentSignals();

		if (prevRsiValues.length > 0) {
			const averageDelta = this.calculateAverageDelta(rsi, prevRsiValues);
			const weight = 0.1; // 변화량 가중치 설정
			score += weight * averageDelta; // 평균 변화량을 스코어에 반영
		}

		return score;
	}

	private async getRecentSignals(): Promise<number[]> {
		const result = await this.client.query<iRSIResult>(
			QUERIES.GET_RECENT_RSI_SIGNALS,
			[this.symbol, this.period],
		);

		return result.rows.map((row) => row.rsi);
	}

	private calculateAverageDelta(
		currentRsi: number,
		prevRsiValues: number[],
	): number {
		const deltas = prevRsiValues.map((prevRsi) => currentRsi - prevRsi);
		return deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
	}

	private async getData(): Promise<number> {
		const result = await this.client.query<iRSIResult>({
			name: `get_rsi_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_RECENT_RSI_SIGNALS,
			values: [this.symbol, this.period],
		});

		if (result.rows.length === 0) {
			throw new Error(String(getMsg("SIGNAL_RSI_ERROR_NO_DATA")));
		}

		const rsiValue = result.rows[0].rsi;

		if (typeof rsiValue !== "number") {
			throw new Error(String(getMsg("SIGNAL_RSI_ERROR_INVALID")));
		}

		return rsiValue;
	}

	private async saveData(data: number, score: number): Promise<void> {
		await this.client.query(QUERIES.INSERT_RSI_SIGNAL, [
			this.uuid,
			data,
			score,
		]);
	}
}
