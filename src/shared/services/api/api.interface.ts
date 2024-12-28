export interface Api {
	MARKET_URL: string;

	getCandles(instId: string, count: number): string;
}
