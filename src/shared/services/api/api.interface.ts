export interface Api {
	MARKET_URL: string;

	getAccount(): Promise<boolean>;
	getCandles(instId: string, count: number): string;
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
