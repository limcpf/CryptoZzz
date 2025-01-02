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
};

export default API;
