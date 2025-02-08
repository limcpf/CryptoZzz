/**
 * Calculates MACD (Moving Average Convergence Divergence) analysis
 * - Generates hourly time intervals for the specified lookback period
 * - Aggregates market data into hourly candles
 * - Calculates EMA values for short and long periods
 * - Computes MACD line, signal line, and histogram
 * - Returns the most recent values with previous period data for comparison
 *
 * MACD (이동평균수렴확산) 분석 계산
 * - 지정된 조회 기간에 대한 시간별 간격 생성
 * - 시장 데이터를 시간별 캔들로 집계
 * - 단기 및 장기 기간에 대한 EMA 값 계산
 * - MACD 라인, 시그널 라인, 히스토그램 계산
 * - 비교를 위한 이전 기간 데이터와 함께 최신 값 반환
 *
 * @param {string} $1 - Trading symbol (거래 심볼)
 * @param {number} $2 - Lookback period in hours (조회 기간(시간))
 * @param {number} $3 - Short-term EMA period (단기 EMA 기간)
 * @param {number} $4 - Long-term EMA period (장기 EMA 기간)
 * @param {number} $5 - Signal line period (시그널 라인 기간)
 * @returns {Object} Result containing:
 *   - current_macd: Current MACD line value
 *   - current_signal: Current signal line value
 *   - prev_macd: Previous MACD line value
 *   - prev_signal: Previous signal line value
 *   - histogram: Current MACD histogram value
 *   - prev_histogram: Previous MACD histogram value
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. time_intervals: 시간별 간격 생성 / Generate hourly intervals
 * 2. hourly_candles: OHLCV 데이터 집계 / Aggregate OHLCV data
 * 3. initial_ema: 초기 EMA 계산 / Calculate initial EMAs
 * 4. ema_calc: EMA 계산 (단기/장기) / Calculate EMAs (short/long)
 * 5. macd_calc: MACD 라인 계산 / Calculate MACD line
 * 6. signal_calc: 시그널 라인, 히스토그램 / Calculate signal line, histogram
 * 7. 최종 선택: MACD 지표 / Select: MACD indicators
 */
export const GET_MACD_ANALYSIS = `
    WITH RECURSIVE time_intervals AS (
        SELECT NOW() as interval_start
        UNION ALL
        SELECT interval_start - INTERVAL '60 minutes'
        FROM time_intervals
        WHERE interval_start > NOW() - ($2 * INTERVAL '60 minutes')
    ),
    hourly_candles AS (
        SELECT
            ti.interval_start,
            md.symbol,
            (array_agg(md.open_price ORDER BY timestamp ASC))[1] as open_price,
            MAX(md.high_price) as high_price,
            MIN(md.low_price) as low_price,
            (array_agg(md.close_price ORDER BY timestamp DESC))[1] as close_price,
            SUM(md.volume) as volume
        FROM time_intervals ti
        LEFT JOIN Market_Data md 
            ON md.symbol = $1 
            AND md.timestamp > ti.interval_start - INTERVAL '60 minutes' 
            AND md.timestamp <= ti.interval_start
        GROUP BY ti.interval_start, md.symbol
    ),
    initial_ema AS (
        SELECT 
            interval_start as timestamp,
            close_price,
            symbol,
            AVG(close_price) OVER (
                ORDER BY interval_start ASC
                ROWS BETWEEN ($3 - 1) PRECEDING AND CURRENT ROW
            ) as ema_short,
            AVG(close_price) OVER (
                ORDER BY interval_start ASC
                ROWS BETWEEN ($4 - 1) PRECEDING AND CURRENT ROW
            ) as ema_long
        FROM hourly_candles
    ),
    ema_calc AS (
        SELECT 
            timestamp,
            close_price,
            symbol,
            CASE 
                WHEN LAG(ema_short, 1) OVER (ORDER BY timestamp ASC) IS NULL 
                    THEN close_price 
                    ELSE (close_price * (2.0 / ($3 + 1))) 
                        + (LAG(ema_short, 1) OVER (ORDER BY timestamp ASC) * (1 - (2.0 / ($3 + 1))))
            END as ema_short,
            CASE 
                WHEN LAG(ema_long, 1) OVER (ORDER BY timestamp ASC) IS NULL 
                    THEN close_price 
                    ELSE (close_price * (2.0 / ($4 + 1))) 
                        + (LAG(ema_long, 1) OVER (ORDER BY timestamp ASC) * (1 - (2.0 / ($4 + 1))))
            END as ema_long
        FROM initial_ema
    ),
    macd_calc AS (
        SELECT 
            timestamp,
            (ema_short - ema_long) as macd_line,
            ema_short,
            ema_long
        FROM ema_calc
        WHERE ema_short IS NOT NULL AND ema_long IS NOT NULL
    ),
    signal_calc AS (
        SELECT 
            timestamp,
            macd_line,
            AVG(macd_line) OVER (
                ORDER BY timestamp ASC
                ROWS BETWEEN ($5 - 1) PRECEDING AND CURRENT ROW
            ) as signal_line
        FROM macd_calc
    )
    SELECT 
        macd_line as current_macd,
        signal_line as current_signal,
        LAG(macd_line) OVER (ORDER BY timestamp ASC) as prev_macd,
        LAG(signal_line) OVER (ORDER BY timestamp ASC) as prev_signal,
        (macd_line - signal_line) as histogram,
        LAG(macd_line - signal_line) OVER (ORDER BY timestamp ASC) as prev_histogram
    FROM signal_calc
    ORDER BY timestamp DESC
    LIMIT 1;
`;

/**
 * Stores MACD signal data in the database
 * - Records MACD analysis results for historical tracking
 * - Stores signal metrics for strategy performance analysis
 *
 * MACD 신호 데이터를 데이터베이스에 저장
 * - 과거 추적을 위한 MACD 분석 결과 기록
 * - 전략 성과 분석을 위한 신호 지표 저장
 *
 * @param {string} $1 - Signal ID (UUID) (신호 식별자)
 * @param {number} $2 - MACD line value (MACD 라인 값)
 * @param {number} $3 - Signal line value (시그널 라인 값)
 * @param {number} $4 - Histogram value (히스토그램 값)
 * @param {boolean} $5 - Zero line crossing indicator (제로라인 크로싱 지표)
 * @param {number} $6 - Trend strength value (추세 강도 값)
 * @param {number} $7 - Calculated signal score (-1 to 1) (계산된 신호 점수)
 */
export const INSERT_MACD_SIGNAL = `
    INSERT INTO MacdSignal (
        signal_id,
        macd_line,
        signal_line,
        histogram,
        zero_cross,
        trend_strength,
        score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
`;
