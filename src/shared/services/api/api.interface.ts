import type { iAccount } from "../../interfaces/iAccount";
import type { iCandle } from "../../interfaces/iCandle";

export interface Api {
	MARKET_URL: string;

	getAccount(): Promise<iAccount[]>;
	getCandles(instId: string, count: number): Promise<iCandle[]>;
	getAuthToken(
		body: Dict<
			| string
			| number
			| boolean
			| readonly string[]
			| readonly number[]
			| readonly boolean[]
			| null
		>,
	): string;
}
