import type { PoolClient } from "pg";
import type { iOrderProps } from "../../interfaces/iOrder";
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
	GET_CANDLE_DATA: (market: string, count: number, to: string) =>
		api.getCandles(market, count, to),
	GET_ACCOUNT: () => api.getAccount(),
	ORDER: (client: PoolClient, orderProps: iOrderProps) =>
		api.order(client, orderProps),
	GET_ACCOUNT_STATUS: (coin = "BTC") => api.getAccountStatus(coin),
};

export default API;
