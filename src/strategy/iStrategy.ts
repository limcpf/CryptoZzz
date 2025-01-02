import type { Pool } from "pg";

export interface iStrategy {
	pool: Pool;
	execute(uuid: string): Promise<Singnal>;
	saveResult(uuid: string, data: unknown | undefined): Promise<void>;
}

export type Singnal = "BUY" | "SELL" | "HOLD";
