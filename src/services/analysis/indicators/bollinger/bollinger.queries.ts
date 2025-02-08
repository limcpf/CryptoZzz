/**
 * Calculates Bollinger Bands values for a given symbol
 * 특정 심볼의 볼린저 밴드 값을 계산
 *
 * @param {string} $1 - Trading symbol (거래 심볼)
 * @param {number} $2 - Period for SMA calculation (이동평균 계산 기간)
 * @param {number} $3 - Lookback hours (조회 시간)
 * @returns {Object} Result containing:
 *   - timestamp: Calculation time
 *   - symbol: Trading symbol
 *   - close_price: Current price
 *   - bollinger_upper: Upper band (SMA + 2σ)
 *   - bollinger_middle: Middle band (SMA)
 *   - bollinger_lower: Lower band (SMA - 2σ)
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. time_series: 20분 간격 시계열 생성 / Generate 20-min intervals
 * 2. twenty_minute_data: 시장 데이터 집계 / Aggregate market data
 * 3. bollinger_calc: SMA와 표준편차 계산 / Calculate SMA and StdDev
 * 4. 최종 선택: 볼린저 밴드 값 / Select: Bollinger Bands values
 */
export const GET_BOLLINGER_BANDS = `
WITH RECURSIVE time_series AS (
    SELECT 
        date_trunc('minute', NOW()) AS ts
    UNION ALL
    SELECT 
        ts - INTERVAL '20 minute'
    FROM time_series
    WHERE ts > NOW() - (INTERVAL '1 hour' * $3)
),
twenty_minute_data AS (
    SELECT
        time_series.ts AS bucket,
        md.symbol,
        LAST(md.close_price, md.timestamp) AS close_price
    FROM time_series
    LEFT JOIN Market_Data md ON 
        md.symbol = $1 AND
        md.timestamp >= time_series.ts - INTERVAL '20 minute' AND
        md.timestamp < time_series.ts
    GROUP BY time_series.ts, md.symbol
    HAVING COUNT(md.symbol) > 0
),
bollinger_calc AS (
    SELECT
        bucket,
        symbol,
        close_price,
        AVG(close_price) OVER w AS moving_avg,
        STDDEV(close_price) OVER w AS moving_stddev
    FROM twenty_minute_data
    WINDOW w AS (ORDER BY bucket ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW) 
)
SELECT
    bucket AS timestamp,
    symbol,
    close_price,
    ROUND((moving_avg + (2 * moving_stddev))::numeric, 5) AS bollinger_upper,
    ROUND(moving_avg::numeric, 5) AS bollinger_middle,
    ROUND((moving_avg - (2 * moving_stddev))::numeric, 5) AS bollinger_lower
FROM bollinger_calc
WHERE moving_avg IS NOT NULL
ORDER BY bucket DESC
LIMIT 1;
`;

/**
 * Stores Bollinger Bands signal in the database
 * 볼린저 밴드 신호를 데이터베이스에 저장
 *
 * @param {string} $1 - Signal ID (신호 식별자)
 * @param {number} $2 - Upper band (상단 밴드)
 * @param {number} $3 - Middle band (중간 밴드)
 * @param {number} $4 - Lower band (하단 밴드)
 * @param {number} $5 - Close price (종가)
 * @param {number} $6 - Band width (밴드 폭)
 * @param {number} $7 - Signal score (신호 점수)
 */
export const INSERT_BOLLINGER_SIGNAL = `
    INSERT INTO BollingerSignal (
        signal_id,
        upper_band,
        middle_band,
        lower_band,
        close_price,
        band_width,
        score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
`;
