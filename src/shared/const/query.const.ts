export const QUERIES = {
	INIT: `
        CREATE TABLE IF NOT EXISTS Market_Data (
        symbol VARCHAR(10),
        timestamp TIMESTAMPTZ,
        open_price NUMERIC,
        high_price NUMERIC,
        low_price NUMERIC,
        close_price NUMERIC,
        volume NUMERIC,
        PRIMARY KEY (symbol, timestamp)
        );

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'market_data') THEN
                PERFORM create_hypertable('Market_Data', 'timestamp');
            END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS Orders (
            id UUID PRIMARY KEY,
            symbol VARCHAR(10) NOT NULL,
            buy_price NUMERIC NOT NULL,
            sell_price NUMERIC,
            quantity NUMERIC NOT NULL,
            status VARCHAR(10) NOT NULL,
            created_at TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL,
            CONSTRAINT order_type_check CHECK (status IN ('BUY', 'SELL')),
            CONSTRAINT status_check CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED'))
        );

        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_symbol') THEN
                CREATE INDEX idx_orders_symbol ON Orders(symbol);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_status') THEN
                CREATE INDEX idx_orders_status ON Orders(status);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'idx_orders_created_at') THEN
                CREATE INDEX idx_orders_created_at ON Orders(created_at);
            END IF;
        END $$;

        CREATE TABLE IF NOT EXISTS SignalLog (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            symbol VARCHAR(10) NOT NULL,
            hour_time TIMESTAMP NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS RsiSignal (
            signal_id UUID PRIMARY KEY,
            rsi NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );

        CREATE TABLE IF NOT EXISTS MaSignal (
            signal_id UUID PRIMARY KEY,
            short_ma NUMERIC NOT NULL,
            long_ma NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );

        CREATE TABLE IF NOT EXISTS VolumeSignal (
            signal_id UUID PRIMARY KEY,
            current_volume NUMERIC NOT NULL,
            avg_volume NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );

        DO $$ 
        BEGIN 
            -- 기존 정책이 있는지 확인
            IF NOT EXISTS (
                SELECT 1 
                FROM timescaledb_information.jobs 
                WHERE application_name LIKE '%Retention%' 
                AND hypertable_name = 'market_data'
            ) THEN
                -- 정책이 없는 경우에만 새로운 정책 추가
                PERFORM add_retention_policy('market_data', INTERVAL '10 hours');
                RAISE NOTICE '새로운 보존 정책이 추가되었습니다.';
            ELSE
                RAISE NOTICE '이미 보존 정책이 존재합니다.';
            END IF;
        END $$;
    `,
	INSERT_MARKET_DATA: `
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
        WHERE symbol = $1
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
                ROWS BETWEEN 8 PRECEDING AND CURRENT ROW
            ) AS avg_gain,
            AVG(loss) OVER (
                PARTITION BY symbol 
                ORDER BY hour_time 
                ROWS BETWEEN 8 PRECEDING AND CURRENT ROW
            ) AS avg_loss,
            COUNT(*) OVER (
                PARTITION BY symbol 
                ORDER BY hour_time 
                ROWS BETWEEN 8 PRECEDING AND CURRENT ROW
            ) AS data_points
        FROM price_changes
    )
    SELECT
        symbol,
        hour_time,
        CASE 
            WHEN data_points >= 9 THEN 100 - (100 / (1 + (avg_gain / NULLIF(avg_loss, 0))))
            ELSE NULL
        END AS rsi
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
        WHERE symbol = $1
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
            ROWS BETWEEN 9 PRECEDING AND CURRENT ROW
        ) AS long_ma
    FROM hourly_data
    ORDER BY hour_time DESC
    LIMIT 1;
  `,
	GET_VOLUME_ANALYSIS: `
        WITH minute_data AS (
            SELECT
                symbol,
                date_trunc('minute', timestamp) AS minute_time,
                SUM(volume) AS total_volume
            FROM Market_Data
            WHERE 
                symbol = $1
                AND timestamp > NOW() - INTERVAL '6 hours'
            GROUP BY symbol, date_trunc('minute', timestamp)
        ),
        hourly_groups AS (
            SELECT
                symbol,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - minute_time)) / 3600) AS hours_ago,
                SUM(total_volume) AS hour_volume
            FROM minute_data
            GROUP BY 
                symbol,
                FLOOR(EXTRACT(EPOCH FROM (NOW() - minute_time)) / 3600)
        )
        SELECT 
            h1.symbol,
            h1.hour_volume as current_volume,
            (
                SELECT AVG(h2.hour_volume) 
                FROM hourly_groups h2 
                WHERE h2.hours_ago > 0
            ) as avg_volume
        FROM hourly_groups h1
        WHERE h1.hours_ago = 0;
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
	INSERT_ORDER: `
        INSERT INTO Orders (
            id,
            symbol,
            buy_price,
            quantity,
            status,
            created_at,
            updated_at,
        )
        VALUES (
            $5,
            $1,
            $2,
            $3,
            $4,
            NOW(),
            NOW()
        )
        RETURNING id, identifier;
    `,
	UPDATE_ORDER: `
        UPDATE Orders
        SET sell_price = $2, status = $3, updated_at = NOW()
        WHERE id = $1;
        RETURNING identifier, quantity, buy_price, sell_price;
    `,
	GET_LAST_ORDER: `
        SELECT id FROM Orders WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1;
    `,
	GET_LATEST_STRATEGY: `
SELECT 
    sl.id,
    sl.hour_time,
    rs.rsi,
    ms.short_ma,
    ms.long_ma,
    vs.current_volume,
    vs.avg_volume
FROM SignalLog sl
LEFT JOIN RsiSignal rs ON sl.id = rs.signal_id
LEFT JOIN MaSignal ms ON sl.id = ms.signal_id
LEFT JOIN VolumeSignal vs ON sl.id = vs.signal_id
WHERE 
    sl.symbol = $1 AND
    rs.rsi IS NOT NULL AND 
    ms.short_ma IS NOT NULL AND 
    ms.long_ma IS NOT NULL AND 
    vs.current_volume IS NOT NULL AND 
    vs.avg_volume IS NOT NULL
ORDER BY sl.hour_time DESC
LIMIT 1;
    `,
	GET_CURRENT_PRICE: `
        SELECT close_price FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;
    `,
	GET_LAST_MARKET_DATA_TIMESTAMP: `
        SELECT timestamp FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;
    `,
};
