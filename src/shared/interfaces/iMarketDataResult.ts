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
	latest_hour_volume: number;
	historical_avg_volume: number;
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

export interface iMACDParams {
	shortPeriod: number; // 단기 EMA 기간
	longPeriod: number; // 장기 EMA 기간
	signalPeriod: number; // 시그널 라인 기간
	lookbackHours: number; // 분석 기간
}

export interface iMACDResult {
	current_macd: number;
	current_signal: number;
	prev_macd: number;
	prev_signal: number;
	histogram: number;
	prev_histogram: number;
}
