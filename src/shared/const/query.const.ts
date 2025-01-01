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
	GET_TECHNICAL_INDICATORS: `
    WITH hourly_data AS (
        SELECT
            symbol,
            date_trunc('hour', timestamp) AS hour_time,
            AVG(close_price) AS avg_close_price,
            SUM(volume) AS total_volume
        FROM Market_Data
        WHERE symbol = 'KRW-BTC'
        GROUP BY 
            symbol, 
            date_trunc('hour', timestamp)
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
    ),

    moving_averages AS (
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
    ),

    volume_avg AS (
        SELECT
            symbol,
            hour_time,
            AVG(total_volume) OVER (
                PARTITION BY symbol 
                ORDER BY hour_time 
                ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
            ) AS avg_volume,
            total_volume AS current_volume
        FROM hourly_data
    )

    SELECT
        m.symbol,
        m.hour_time,
        100 - (100 / (1 + (agl.avg_gain / NULLIF(agl.avg_loss, 0)))) AS rsi,
        m.short_ma,
        m.long_ma, 
        v.current_volume,
        v.avg_volume
    FROM moving_averages m
    JOIN avg_gain_loss agl 
        ON m.hour_time = agl.hour_time 
        AND m.symbol = agl.symbol
    JOIN volume_avg v 
        ON m.hour_time = v.hour_time 
        AND m.symbol = v.symbol
    ORDER BY m.hour_time DESC
    LIMIT 1;
    `,
};
