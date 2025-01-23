import type { PoolClient } from "pg";
import logger from "../../shared/config/logger";
import { QUERIES } from "../../shared/const/query.const";
import type { iMovingAveragesResult } from "../../shared/interfaces/iMarketDataResult";
import { developmentLog } from "../../shared/services/util";
import { Signal, type iStrategy } from "../iStrategy";

/**
 * MA (Moving Average) Strategy Implementation
 * Analyzes market data using MA indicator to generate trading signals
 * - Returns BUY signal when short MA crosses above long MA
 * - Returns SELL signal when short MA crosses below long MA
 * - Returns HOLD signal in other cases
 *
 * MA (이동평균) 전략 구현
 * MA 지표를 사용하여 시장 데이터를 분석하고 거래 신호를 생성
 * - 단기 MA가 장기 MA를 상향 돌파할 때 매수 신호 반환
 * - 단기 MA가 장기 MA를 하향 돌파할 때 매도 신호 반환
 * - 그 외의 경우 홀드 신호 반환
 */
export class MaStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;

	constructor(client: PoolClient, uuid: string, symbol: string, weight = 0.8) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
	}

	async execute(): Promise<number> {
		const data = await this.getData();

		const score = await this.score(data);

		this.saveData(data, score);

		return score * this.weight;
	}

	private async score(data: {
		short_ma: number;
		long_ma: number;
		prev_short_ma: number;
	}): Promise<number> {
		const { short_ma, long_ma, prev_short_ma } = data;

		// 기본 스코어 (baseScore)
		const baseScore = Math.tanh((5 * (short_ma - long_ma)) / long_ma);

		// 변화율 반영 스코어 (finalScore)
		const rateOfChange = prev_short_ma
			? (short_ma - prev_short_ma) / prev_short_ma
			: 0; // 이전 값이 없으면 변화율은 0

		return baseScore + 0.1 * rateOfChange;
	}

	private async getData(): Promise<iMovingAveragesResult> {
		const result = await this.client.query<iMovingAveragesResult>({
			name: `get_ma_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_RECENT_MA_SIGNALS,
			values: [this.symbol],
		});

		return result.rows[0];
	}

	private saveData(data: iMovingAveragesResult, score: number): void {
		this.client.query(QUERIES.INSERT_MA_SIGNAL, [
			this.uuid,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);
	}
}
