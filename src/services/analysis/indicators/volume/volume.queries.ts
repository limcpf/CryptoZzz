/**
 * Calculates volume analysis metrics for trading signals
 * 거래량 분석 지표 계산
 *
 * @param {string} $1 - Trading symbol (거래 심볼)
 * @param {number} $2 - Lookback period in hours (조회 기간(시간))
 * @returns {Object} Result containing:
 *   - symbol: Trading symbol
 *   - latest_hour_volume: Most recent hourly volume
 *   - historical_avg_volume: Average volume over lookback period
 *
 * 쿼리 처리 과정 / Query Processing Steps:
 * 1. time_intervals: 시간별 간격 생성 / Generate hourly intervals
 * 2. volume_by_interval: 구간별 평균 거래량 계산 / Calculate average volume per interval
 * 3. volume_analysis: 현재 및 과거 거래량 분석 / Analyze current vs historical volume
 * 4. 최종 선택: 거래량 지표 계산 / Select: Volume metrics calculation
 *   - 최근 1시간 거래량 / Latest hour volume
 *   - 과거 평균 거래량 / Historical average volume
 */
export const GET_VOLUME_ANALYSIS = `
  WITH RECURSIVE time_intervals AS (
    SELECT 
      NOW() as interval_start
    UNION ALL
    SELECT 
      interval_start - INTERVAL '60 minutes'
    FROM time_intervals
    WHERE interval_start > NOW() - ($2 * INTERVAL '60 minutes')
  ),
  volume_by_interval AS (
    SELECT
      ti.interval_start,
      md.symbol,
      AVG(md.volume) AS avg_volume
    FROM time_intervals ti
    LEFT JOIN Market_Data md ON 
      md.symbol = $1 AND
      md.timestamp > ti.interval_start - INTERVAL '60 minutes' AND
      md.timestamp <= ti.interval_start
    GROUP BY ti.interval_start, md.symbol
  ),
  volume_analysis AS (
    SELECT 
      symbol,
      interval_start,
      avg_volume as current_volume,
      (
        SELECT AVG(avg_volume)
        FROM volume_by_interval
        WHERE interval_start < NOW() - INTERVAL '60 minutes'
      ) as historical_avg_volume,
      (
        SELECT avg_volume
        FROM volume_by_interval
        WHERE interval_start = (SELECT MAX(interval_start) FROM volume_by_interval)
      ) as latest_hour_volume
    FROM volume_by_interval
    WHERE interval_start = (SELECT MAX(interval_start) FROM volume_by_interval)
  )
  SELECT 
    COALESCE(symbol, $1) as symbol,
    COALESCE(latest_hour_volume, 0) as latest_hour_volume,
    COALESCE(historical_avg_volume, 0) as historical_avg_volume
  FROM volume_analysis;
`;

/**
 * Stores volume analysis signal in the database
 * 거래량 분석 신호를 데이터베이스에 저장
 *
 * @param {string} $1 - Signal ID (신호 식별자)
 * @param {number} $2 - Current volume (현재 거래량)
 * @param {number} $3 - Average volume (평균 거래량)
 * @param {number} $4 - Signal score (신호 점수)
 */
export const INSERT_VOLUME_SIGNAL = `
  INSERT INTO VolumeSignal (signal_id, current_volume, avg_volume, score)
  VALUES ($1, $2, $3, $4);
`;
