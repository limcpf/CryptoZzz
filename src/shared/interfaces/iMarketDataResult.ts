interface iRSIResult {
	symbol: string;
	hour_time: Date;
	rsi: number;
}

interface iMovingAveragesResult {
	symbol: string;
	hour_time: Date;
	short_ma: number;
	long_ma: number;
}

interface iVolumeAnalysisResult {
	symbol: string;
	hour_time: Date;
	current_volume: number;
	avg_volume: number;
}

// 기존 인터페이스는 모든 결과를 포함하는 통합 인터페이스로 유지할 수 있습니다
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
