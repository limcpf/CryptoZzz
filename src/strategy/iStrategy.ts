import type { Pool } from "pg";

export interface iStrategy {
	pool: Pool;
	execute(uuid: string): Promise<Singnal>;
}

export type Singnal = "BUY" | "SELL" | "HOLD";
