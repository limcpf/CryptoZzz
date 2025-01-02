export const QUERIES = {
	UPSERT_MARKET_DATA: `
      INSERT INTO Market_Data (
        symbol, 
        timestamp, 
        open_price, 
        high_price, 
        low_price, 
        close_price, 
        volume
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (symbol, timestamp)
      DO UPDATE
      SET open_price = EXCLUDED.open_price,
          high_price = EXCLUDED.high_price,
          low_price = EXCLUDED.low_price,
          close_price = EXCLUDED.close_price,
          volume = EXCLUDED.volume;
    `,
	GET_RSI_INDICATOR: `
    WITH hourly_data AS (
        SELECT
            symbol,
            date_trunc('hour', timestamp) AS hour_time,
            AVG(close_price) AS avg_close_price
        FROM Market_Data
        WHERE symbol = 'KRW-BTC'
        GROUP BY symbol, date_trunc('hour', timestamp)
    ),
    price_changes AS (
        SELECT
            symbol,
            hour_time,
            avg_close_price,
            GREATEST(
                avg_close_price - LAG(avg_close_price) OVER (PARTITION BY symbol ORDER BY hour_time), 
                0
            ) AS gain,
            GREATEST(
                LAG(avg_close_price) OVER (PARTITION BY symbol ORDER BY hour_time) - avg_close_price, 
                0
            ) AS loss
        FROM hourly_data
    ),
    avg_gain_loss AS (
        SELECT
            symbol,
            hour_time,
            AVG(gain) OVER (
                PARTITION BY symbol 
                ORDER BY hour_time 
                ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
            ) AS avg_gain,
            AVG(loss) OVER (
                PARTITION BY symbol 
                ORDER BY hour_time 
                ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
            ) AS avg_loss
        FROM price_changes
    )
    SELECT
        symbol,
        hour_time,
        100 - (100 / (1 + (avg_gain / NULLIF(avg_loss, 0)))) AS rsi
    FROM avg_gain_loss
    ORDER BY hour_time DESC
    LIMIT 1;
  `,
	GET_MOVING_AVERAGES: `
    WITH hourly_data AS (
        SELECT
            symbol,
            date_trunc('hour', timestamp) AS hour_time,
            AVG(close_price) AS avg_close_price
        FROM Market_Data
        WHERE symbol = 'KRW-BTC'
        GROUP BY symbol, date_trunc('hour', timestamp)
    )
    SELECT
        symbol,
        hour_time,
        AVG(avg_close_price) OVER (
            PARTITION BY symbol 
            ORDER BY hour_time 
            ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
        ) AS short_ma,
        AVG(avg_close_price) OVER (
            PARTITION BY symbol 
            ORDER BY hour_time 
            ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
        ) AS long_ma
    FROM hourly_data
    ORDER BY hour_time DESC
    LIMIT 1;
  `,
	GET_VOLUME_ANALYSIS: `
    WITH hourly_data AS (
        SELECT
            symbol,
            date_trunc('hour', timestamp) AS hour_time,
            SUM(volume) AS total_volume
        FROM Market_Data
        WHERE symbol = 'KRW-BTC'
        GROUP BY symbol, date_trunc('hour', timestamp)
    )
    SELECT
        symbol,
        hour_time,
        total_volume AS current_volume,
        AVG(total_volume) OVER (
            PARTITION BY symbol 
            ORDER BY hour_time 
            ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
        ) AS avg_volume
    FROM hourly_data
    ORDER BY hour_time DESC
    LIMIT 1;
  `,
	INSERT_SIGNAL_LOG: `
        INSERT INTO SignalLog (symbol, hour_time)
        VALUES ($1, $2)
        RETURNING id;
    `,
	INSERT_RSI_SIGNAL: `
        INSERT INTO RsiSignal (signal_id, rsi)
        VALUES ($1, $2);
    `,
	INSERT_MA_SIGNAL: `
        INSERT INTO MaSignal (signal_id, short_ma, long_ma)
        VALUES ($1, $2, $3);
    `,
	INSERT_VOLUME_SIGNAL: `
        INSERT INTO VolumeSignal (signal_id, current_volume, avg_volume)
        VALUES ($1, $2, $3);
    `,
};
