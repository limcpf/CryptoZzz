/**
 * MACD 계산 결과 인터페이스
 * - 전략 계산을 위한 MACD 값과 관련 데이터 포함
 */
export interface iMACDResult {
	symbol: string;
	date: Date;
	current_macd: number;
	current_signal: number;
	prev_macd: number;
	prev_signal: number;
	histogram: number;
	prev_histogram: number;
}
