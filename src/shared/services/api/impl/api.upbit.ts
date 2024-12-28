import type { Api } from "../api.interface";

export class UpbitApi implements Api {
	MARKET_URL: string;

	constructor() {
		this.MARKET_URL = process.env.MARKET_URL || "";
	}

	getCandles(instId: string, count: number): string {
		return `/v1/candles/seconds?market=${instId}&count=${count}`;
	}
}
