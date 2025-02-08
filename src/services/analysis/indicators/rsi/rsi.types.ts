export interface iRSIResult {
	symbol: string;
	hour: Date;
	rsi: number;
}

export interface iRSIParams {
	period: number;
	oversoldThreshold: number;
	overboughtThreshold: number;
	momentumWeight: number;
}
