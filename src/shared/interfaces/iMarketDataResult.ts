interface iMarketDataResult {
	symbol: string; // 심볼 (예: 'KRW-BTC')
	hour_time: Date; // 시간 단위로 잘린 타임스탬프
	rsi: number; // RSI 지표 (0-100 사이 값)
	short_ma: number; // 단기 이동평균
	long_ma: number; // 장기 이동평균
	current_volume: number; // 현재 거래량
	avg_volume: number; // 평균 거래량
}

export type { iMarketDataResult };
