/**
 * Calculates Moving Average scores for trading signals
 * 거래 신호를 위한 이동평균(MA) 점수 계산
 *
 * @param {string} $1 - Trading symbol (거래 심볼)
 * @param {number} $2 - Short-term MA period (단기 MA 기간)
 * @param {number} $3 - Long-term MA period (장기 MA 기간)
 * @returns {Object} Result containing:
 *   - symbol: Trading symbol
 *   - date: Timestamp of calculation
 *   - short_ma: Short-term moving average
 *   - long_ma: Long-term moving average
 *   - prev_short_ma: Previous short-term MA value
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. time_series: 15분 간격 시계열 생성 (6시간) / Generate 15-min intervals (6 hours)
 * 2. fifteen_minute_data: 시장 데이터 집계 / Aggregate market data
 * 3. ma_calculations: MA 계산 (단기/장기) / Calculate MAs (short/long)
 * 4. 최종 선택: MA 값과 이전 단기 MA / Select: MA values with previous short MA
 */
export const GET_MA_SCORE = `
    WITH RECURSIVE time_series AS (
        -- 현재 시각부터 15분 단위로 과거 시점들 생성
        SELECT 
            date_trunc('minute', NOW()) AS ts
        UNION ALL
        SELECT 
            ts - INTERVAL '15 minutes'
        FROM time_series
        WHERE ts > NOW() - INTERVAL '6 hours'
    ),
    fifteen_minute_data AS (
        SELECT
            time_series.ts AS bucket,
            symbol,
            AVG(close_price) AS avg_close_price
        FROM time_series
        LEFT JOIN Market_Data md ON 
            md.symbol = $1 AND
            md.timestamp >= time_series.ts - INTERVAL '15 minutes' AND
            md.timestamp < time_series.ts
        GROUP BY time_series.ts, symbol
        HAVING COUNT(symbol) > 0
    ),
    ma_calculations AS (
        SELECT
            bucket,
            symbol,
            avg_close_price,
            -- 단기 MA (10봉 = 약 150분)
            AVG(avg_close_price) OVER (
                ORDER BY bucket
                ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
            ) AS short_ma,
            -- 장기 MA (20봉 = 약 300분)
            AVG(avg_close_price) OVER (
                ORDER BY bucket
                ROWS BETWEEN $3::integer - 1 PRECEDING AND CURRENT ROW
            ) AS long_ma
        FROM fifteen_minute_data
    )
    SELECT
        symbol,
        bucket as date,
        short_ma,
        long_ma,
        COALESCE(
            LAG(short_ma) OVER (ORDER BY bucket),
            0
        ) AS prev_short_ma
    FROM ma_calculations
    ORDER BY bucket DESC
    LIMIT 1;
`;

/**
 * Stores MA strategy signal data in the database
 * - Records signal calculation results for historical tracking
 * - Maintains signal history for strategy performance analysis
 *
 * MA 전략 신호 데이터를 데이터베이스에 저장
 * - 신호 계산 결과를 이력 추적을 위해 기록
 * - 전략 성과 분석을 위한 신호 이력 관리
 *
 * @param {string} $1 - Signal ID (UUID) (신호 식별자)
 * @param {number} $2 - Short-term moving average value (단기 이동평균값)
 * @param {number} $3 - Long-term moving average value (장기 이동평균값)
 * @param {number} $4 - Previous short-term MA value (이전 단기 이동평균값)
 * @param {number} $5 - Calculated signal score (-1 to 1) (계산된 신호 점수)
 */
export const INSERT_MA_SIGNAL = `
    INSERT INTO MaSignal (signal_id, short_ma, long_ma, prev_short_ma, score)
    VALUES ($1, $2, $3, $4, $5);
`;
