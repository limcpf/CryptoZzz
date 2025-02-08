/**
 * Calculates Stochastic Oscillator values (%K and %D)
 * 스토캐스틱 오실레이터 값 (%K와 %D) 계산
 *
 * @param {string} $1 - Trading symbol (거래 심볼)
 * @param {number} $2 - %K period (룩백 기간) / %K period (lookback period)
 * @param {number} $3 - %D period (이동평균 기간) / %D period (moving average period)
 * @returns {Object} Result containing:
 *   - timestamp: Calculation time
 *   - k_value: Fast Stochastic (%K)
 *   - d_value: Slow Stochastic (%D)
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. time_series: 15분 간격 시계열 생성 (4시간) / Generate 15-min intervals (4 hours)
 * 2. fifteen_minute_data: OHLC 데이터 집계 / Aggregate OHLC data
 * 3. raw_k_values: %K 계산을 위한 최고/최저가 / Calculate highs/lows for %K
 * 4. k_values: %K 계산 / Calculate %K
 * 5. 최종 선택: %K와 %D 계산 / Select: Calculate %K and %D
 */
export const GET_STOCHASTIC_OSCILLATOR = `
WITH RECURSIVE time_series AS (
    SELECT date_trunc('minute', NOW()) AS ts
    UNION ALL
    SELECT ts - INTERVAL '15 minutes'
    FROM time_series
    WHERE ts > NOW() - INTERVAL '4 hours'
),
fifteen_minute_data AS (
    SELECT
        time_series.ts AS bucket,
        md.symbol,
        MAX(md.high_price) AS high,
        MIN(md.low_price) AS low,
        LAST(md.close_price, md.timestamp) AS close
    FROM time_series
    LEFT JOIN Market_Data md ON 
        md.symbol = $1 AND
        md.timestamp >= time_series.ts - INTERVAL '15 minutes' AND
        md.timestamp < time_series.ts
    GROUP BY time_series.ts, md.symbol
    HAVING COUNT(md.symbol) > 0
),
raw_k_values AS (
    SELECT
        bucket,
        symbol,
        close,
        MIN(low) OVER w AS period_low,
        MAX(high) OVER w AS period_high,
        close - MIN(low) OVER w AS numerator,
        NULLIF(MAX(high) OVER w - MIN(low) OVER w, 0) AS denominator
    FROM fifteen_minute_data
    WINDOW w AS (PARTITION BY symbol ORDER BY bucket ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW)
),
k_values AS (
    SELECT
        bucket,
        symbol,
        (numerator / denominator * 100) AS percent_k
    FROM raw_k_values
)
SELECT
    bucket AS timestamp,
    ROUND(percent_k::numeric, 2) AS k_value,
    ROUND(AVG(percent_k) OVER (ORDER BY bucket ROWS BETWEEN $3::integer - 1 PRECEDING AND CURRENT ROW)::numeric, 2) AS d_value
FROM k_values
ORDER BY bucket DESC
LIMIT 1;
`;

/**
 * Stores Stochastic Oscillator signal in the database
 * 스토캐스틱 오실레이터 신호를 데이터베이스에 저장
 *
 * @param {string} $1 - Signal ID (신호 식별자)
 * @param {number} $2 - %K value (%K 값)
 * @param {number} $3 - %D value (%D 값)
 * @param {number} $4 - Signal score (신호 점수)
 */
export const INSERT_STOCHASTIC_SIGNAL = `
INSERT INTO StochasticSignal (signal_id, k_value, d_value, score)
VALUES ($1, $2, $3, $4);
`;
