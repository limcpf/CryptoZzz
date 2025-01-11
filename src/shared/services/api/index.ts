import { apiFactory } from "./api.factory";

const api = apiFactory();

const API = {
	MARKET_URL: api.MARKET_URL,
	GET_AUTH_TOKEN: (
		body: Dict<
			| string
			| number
			| boolean
			| readonly string[]
			| readonly number[]
			| readonly boolean[]
			| null
		>,
	) => api.getAuthToken(body),
	GET_CANDLE_DATA: (instId: string, count: number) =>
		api.getCandles(instId, count),
	GET_ACCOUNT: () => api.getAccount(),
	ORDER: (
		market: string,
		side: "bid" | "ask",
		volume: string,
		price: string,
		ord_type: "price" | "market",
	) => api.order(market, side, volume, price, ord_type),
	GET_ACCOUNT_STATUS: () => api.getAccountStatus(),
};

export default API;
