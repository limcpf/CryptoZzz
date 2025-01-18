import type { iAccount, iAccountStatus } from "../../interfaces/iAccount";
import type { iCandle } from "../../interfaces/iCandle";
import type { OrderResponse, iOrder } from "../../interfaces/iOrder";

export interface Api {
	MARKET_URL: string;

	getAccount(): Promise<iAccount[]>;
	getCandles(market: string, count: number, to: string): Promise<iCandle[]>;
	order(
		market: string,
		side: "bid" | "ask",
		volume: string,
		price: string,
		ord_type: "price" | "market",
		identifier: string,
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
