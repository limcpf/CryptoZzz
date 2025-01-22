import type { PoolClient } from "pg";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iRSIResult } from "../../shared/interfaces/iMarketDataResult";
import { developmentLog } from "../../shared/services/util";
import { Signal, type iStrategy } from "../iStrategy";

/**
 * RSI (Relative Strength Index) Strategy Implementation
 * Analyzes market data using RSI indicator to generate trading signals
 * - Returns BUY signal when RSI falls below 30 (oversold)
 * - Returns SELL signal when RSI rises above 70 (overbought)
 * - Returns HOLD signal in other cases
 *
 * RSI (상대강도지수) 전략 구현
 * RSI 지표를 사용하여 시장 데이터를 분석하고 거래 신호를 생성
 * - RSI가 30 이하로 떨어질 때 매수 신호 반환 (과매도)
 * - RSI가 70 이상으로 상승할 때 매도 신호 반환 (과매수)
 * - 그 외의 경우 홀드 신호 반환
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

	async score(rsi: number): Promise<number> {
		let score = 0;
		if (rsi <= 30) {
			score = (30 - rsi) / 30; // 매수세 강화
		} else if (rsi >= 70) {
			score = -(rsi - 70) / 30; // 매도세 강화
		} else {
			score = (rsi - 50) / 20; // 중립 범위
		}

		const prevRsiValues = await this.getRecentSignals(this.symbol);

		if (prevRsiValues.length > 0) {
			const averageDelta = this.calculateAverageDelta(rsi, prevRsiValues);
			const weight = 0.1; // 변화량 가중치 설정
			score += weight * averageDelta; // 평균 변화량을 스코어에 반영
		}

		return score;
	}

	async execute(): Promise<number> {
		const rsi = await this.getData();

		this.saveData(rsi);

		const score = await this.score(rsi);

		return score * this.weight;
	}

	private async getRecentSignals(symbol: string): Promise<number[]> {
		const result = await this.client.query<iRSIResult>(
			QUERIES.GET_RECENT_RSI_SIGNALS,
			[symbol, this.period],
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
			name: `get_rsi_${this.symbol}_${new Date().toISOString()}`,
			text: QUERIES.GET_RSI_INDICATOR,
			values: [this.symbol],
		});

		const rsi = Number(result.rows[0].rsi);

		if (Number.isNaN(rsi)) throw new Error("SIGNAL_RSI_ERROR");

		return rsi;
	}

	private async saveData(data: number): Promise<void> {
		await this.client.query(QUERIES.INSERT_RSI_SIGNAL, [this.uuid, data]);
	}
}
