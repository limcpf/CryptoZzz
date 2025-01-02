import type { Pool } from "pg";

/**
 * Strategy Interface
 * Defines the structure for implementing trading strategies
 *
 * 전략 인터페이스
 * 거래 전략을 구현하기 위한 구조를 정의
 */
export interface iStrategy {
	pool: Pool;
	execute(uuid: string): Promise<Signal>;
}

export enum Signal {
	BUY = "BUY",
	SELL = "SELL",
	HOLD = "HOLD",
}
