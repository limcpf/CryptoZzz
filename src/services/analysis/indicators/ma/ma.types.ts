/**
 * Moving Average (MA) calculation result interface
 * - Contains MA values and related data for strategy calculation
 *
 * 이동평균(MA) 계산 결과 인터페이스
 * - 전략 계산을 위한 MA 값과 관련 데이터 포함
 *
 * @interface iMAResult
 * @property {string} symbol - Trading pair symbol (거래 쌍 심볼)
 * @property {Date} date - Calculation timestamp (계산 시간)
 * @property {number} short_ma - Short-term moving average value (단기 이동평균값)
 * @property {number} long_ma - Long-term moving average value (장기 이동평균값)
 * @property {number} prev_short_ma - Previous short-term MA for momentum calculation
 *                                   (모멘텀 계산을 위한 이전 단기 이동평균값)
 */
interface iMAResult {
	symbol: string;
	date: Date;
	short_ma: number;
	long_ma: number;
	prev_short_ma: number;
}

export type { iMAResult };
