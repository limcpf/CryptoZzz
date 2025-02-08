/**
 * RSI(Relative Strength Index) 값을 계산하는 SQL 쿼리입니다.
 * SQL query for calculating RSI (Relative Strength Index) values.
 *
 * @param {string} $1 - 암호화폐 심볼 / Cryptocurrency symbol
 * @param {number} $2 - 조회할 시간 범위(시간 단위) / Lookback period in hours
 * @param {number} $3 - RSI 계산 기간 - 1 / RSI calculation period - 1
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. HourlyData: 시간별 OHLCV 데이터 집계 / Aggregates hourly OHLCV data
 * 2. PriceChanges: 시간별 가격 변화 계산 / Calculates price changes between hours
 * 3. GainsLosses: 상승폭과 하락폭 분리 / Separates gains and losses
 * 4. AvgGainsLosses: 평균 상승폭과 하락폭 계산 / Calculates average gains and losses
 * 5. 최종 RSI 값 계산 및 정렬 / Final RSI calculation and sorting
 */
export const GET_RSI_QUERY = `
WITH HourlyData AS (
    SELECT 
        symbol,
        time_bucket('1 hour', timestamp, NOW() - INTERVAL '1 minute' * EXTRACT(MINUTE FROM NOW())) AS hour,
        FIRST(open_price, timestamp) AS open_price,
        MAX(high_price) AS high_price,
        MIN(low_price) AS low_price,
        LAST(close_price, timestamp) AS close_price,
        SUM(volume) AS volume
    FROM Market_Data
    WHERE symbol = $1
    AND timestamp >= NOW() - INTERVAL '60 minutes' * $2::integer
    GROUP BY symbol, hour
),
PriceChanges AS (
    SELECT 
        symbol,
        hour,
        close_price,
        close_price - LAG(close_price) OVER (PARTITION BY symbol ORDER BY hour) AS price_change
    FROM HourlyData
),
GainsLosses AS (
    SELECT
        symbol,
        hour,
        CASE WHEN price_change > 0 THEN price_change ELSE 0 END AS gain,
        CASE WHEN price_change < 0 THEN ABS(price_change) ELSE 0 END AS loss
    FROM PriceChanges
),
AvgGainsLosses AS (
    SELECT
        symbol,
        hour,
        AVG(gain) OVER (PARTITION BY symbol ORDER BY hour ROWS BETWEEN $3::integer PRECEDING AND CURRENT ROW) AS avg_gain,
        AVG(loss) OVER (PARTITION BY symbol ORDER BY hour ROWS BETWEEN $3::integer PRECEDING AND CURRENT ROW) AS avg_loss
    FROM GainsLosses
)
SELECT
    symbol,
    hour,
    CASE 
    WHEN avg_gain = 0 AND avg_loss = 0 THEN 50
    WHEN avg_loss = 0 THEN 100
    WHEN avg_gain = 0 THEN 0
    ELSE ROUND(100 - (100 / (1 + avg_gain / avg_loss)), 2)
    END AS rsi
FROM AvgGainsLosses
WHERE hour >= NOW() - INTERVAL '60 minutes' * $2::integer
ORDER BY symbol, hour DESC
`;

/**
 * RSI 신호를 데이터베이스에 저장하는 SQL 쿼리입니다.
 * SQL query for inserting RSI signals into the database.
 *
 * @param {string} $1 - 신호 식별자 / Signal identifier
 * @param {number} $2 - RSI 값 / RSI value
 * @param {number} $3 - 신호 점수 / Signal score
 */
export const INSERT_RSI_SIGNAL = `
    INSERT INTO RsiSignal (signal_id, rsi, score)
    VALUES ($1, $2, $3);
`;
