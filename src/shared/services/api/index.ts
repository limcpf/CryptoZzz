import { apiFactory } from "./api.factory";

const api = apiFactory();

const API_URL = {
	GET_CANDLE_DATA: (instId: string, count: number) =>
		api.getCandles(instId, count),
};

export default API_URL;
