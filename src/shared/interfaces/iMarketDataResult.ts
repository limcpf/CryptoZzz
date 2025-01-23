interface iRSIResult {
	symbol: string;
	hour_time: Date;
	rsi: number;
}

interface iMovingAveragesResult {
	symbol: string;
	date: Date;
	short_ma: number;
	long_ma: number;
	prev_short_ma: number;
}

interface iVolumeAnalysisResult {
	symbol: string;
	hour_time: Date;
	current_volume: number;
	avg_volume: number;
}

interface iMarketDataResult
	extends iRSIResult,
		iMovingAveragesResult,
		iVolumeAnalysisResult {}

export type {
	iRSIResult,
	iMovingAveragesResult,
	iVolumeAnalysisResult,
	iMarketDataResult,
};
