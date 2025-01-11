import type { iAccount, iAccountStatus } from "../../interfaces/iAccount";
import type { iCandle } from "../../interfaces/iCandle";
import type { OrderResponse, iOrder } from "../../interfaces/iOrder";

export interface Api {
	MARKET_URL: string;

	getAccount(): Promise<iAccount[]>;
	getCandles(instId: string, count: number): Promise<iCandle[]>;
	order(
		market: string,
		side: "bid" | "ask",
		volume: string,
		price: string,
		ord_type: "price" | "market",
	): Promise<OrderResponse>;
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
	getAccountStatus(): Promise<iAccountStatus>;
}
