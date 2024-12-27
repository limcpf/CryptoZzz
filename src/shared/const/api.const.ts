const API_URL = {
	GET_CANDLE_DATA: (instId: string, count: number) =>
		`/v1/candles/seconds?market=${instId}&count=${count}`,
};

export default API_URL;
