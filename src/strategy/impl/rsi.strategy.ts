import type { Pool } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iRSIResult } from "../../shared/interfaces/iMarketDataResult";
import type { Singnal, iStrategy } from "../iStrategy";

export class RsiStrategy implements iStrategy {
	pool: Pool;

	constructor(pool: Pool) {
		this.pool = pool;
	}

	async execute(uuid: string): Promise<Singnal> {
		const result = await this.pool.query<iRSIResult>(QUERIES.GET_RSI_INDICATOR);

		if (result.rowCount === 0) {
			console.error(
				`[${new Date().toISOString()}] [RSI-STRATEGY] RSI 지표 조회 실패`,
			);
			return "HOLD";
		}

		const rsi = result.rows[0].rsi;

		this.saveResult(uuid, rsi);

		if (rsi < 30) {
			return "BUY";
		}

		if (rsi > 70) {
			return "SELL";
		}

		return "HOLD";
	}

	private saveResult(uuid: string, data: unknown): void {
		if (data && typeof data === "number") {
			this.pool.query(QUERIES.INSERT_RSI_SIGNAL, [uuid, data]);
		}
	}
}
