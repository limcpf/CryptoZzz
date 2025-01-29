// 테이블별 모듈식 정의
const TABLE_DEFINITIONS: Record<
	string,
	{
		table: string;
		indexes?: string[];
		hypertable?: string;
		retention?: string;
	}
> = {
	Market_Data: {
		table: `
      CREATE TABLE IF NOT EXISTS Market_Data (
        symbol TEXT,
        timestamp TIMESTAMPTZ,
        open_price NUMERIC,
        high_price NUMERIC,
        low_price NUMERIC,
        close_price NUMERIC,
        volume NUMERIC,
        PRIMARY KEY (symbol, timestamp)
      )`,
		indexes: [
			"CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON Market_Data(symbol, timestamp DESC)",
			"CREATE INDEX IF NOT EXISTS idx_market_data_timestamp_brin ON Market_Data USING BRIN(timestamp)",
		],
		hypertable:
			"SELECT create_hypertable('Market_Data', 'timestamp', if_not_exists => TRUE)",
		retention:
			"SELECT add_retention_policy('Market_Data', INTERVAL '48 hours')",
	},

	Trades: {
		table: `
      CREATE TABLE IF NOT EXISTS Trades (
        uuid UUID NOT NULL,
        type VARCHAR(4) NOT NULL CHECK (type IN ('BUY', 'SELL')),
        symbol TEXT NOT NULL,
        price NUMERIC NOT NULL,
        quantity NUMERIC NOT NULL,
        is_dev BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sequence INTEGER NOT NULL DEFAULT 1,
        fee NUMERIC NOT NULL DEFAULT 0,
        PRIMARY KEY (uuid, type, sequence)
      )`,
		indexes: [
			"CREATE INDEX IF NOT EXISTS idx_trades_composite_pk ON Trades(uuid, type, sequence)",
			"CREATE INDEX IF NOT EXISTS idx_trades_symbol_created ON Trades(symbol, created_at)",
			"CREATE INDEX IF NOT EXISTS idx_trades_sequence_btree ON Trades(sequence)",
			"CREATE INDEX IF NOT EXISTS idx_trades_uuid ON Trades(uuid)",
			"CREATE INDEX IF NOT EXISTS idx_trades_symbol_type ON Trades(symbol, type)",
			"CREATE INDEX IF NOT EXISTS idx_trades_created_at_brin ON Trades USING BRIN(created_at)",
		],
	},

	SignalLog: {
		table: `
      CREATE TABLE IF NOT EXISTS SignalLog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol TEXT NOT NULL,
        hour_time TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
	},

	// 다른 테이블들도 동일한 패턴으로 추가
};

// 조합 함수
const composeSchema = (tables: (keyof typeof TABLE_DEFINITIONS)[]) => {
	return {
		createTables: tables.map((t) => TABLE_DEFINITIONS[t].table).join("\n"),
		createIndexes: tables
			.flatMap((t) =>
				TABLE_DEFINITIONS[t].indexes ? TABLE_DEFINITIONS[t].indexes : [],
			)
			.join("\n"),
		hypertables: tables
			.map((t) =>
				TABLE_DEFINITIONS[t].hypertable ? TABLE_DEFINITIONS[t].hypertable : "",
			)
			.join("\n"),
		retentionPolicies: tables
			.map((t) =>
				TABLE_DEFINITIONS[t].retention ? TABLE_DEFINITIONS[t].retention : "",
			)
			.join("\n"),
	};
};

// 전체 스키마 (기존 구조와 호환 유지)
export const QUERIES = {
	...composeSchema([
		"Market_Data",
		"Trades",
		"SignalLog",
		// 다른 필요한 테이블 추가
	]),
	// 기존 쿼리들 유지
	GET_CURRENT_PRICE:
		"SELECT close_price FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;",
	GET_LAST_MARKET_DATA_TIMESTAMP:
		"SELECT timestamp FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;",
	GET_LAST_ORDER:
		"SELECT id FROM Orders WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1;",
	GET_VOLUME_ANALYSIS: `
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
`,
	INSERT_SIGNAL_LOG: `
    INSERT INTO SignalLog (symbol, hour_time)
    VALUES ($1, $2)
    RETURNING id;
`,
	INSERT_RSI_SIGNAL: `
    INSERT INTO RsiSignal (signal_id, rsi, score)
    VALUES ($1, $2, $3);
`,
	INSERT_VOLUME_SIGNAL: `
    INSERT INTO VolumeSignal (signal_id, current_volume, avg_volume, score)
    VALUES ($1, $2, $3, $4);
`,
	GET_RECENT_RSI_SIGNALS: `
    WITH HourlySignals AS (
        SELECT 
            sl.symbol,
            date_trunc('hour', sl.hour_time) as hour_time,
            AVG(rs.rsi) as rsi
        FROM SignalLog sl
        INNER JOIN RsiSignal rs ON sl.id = rs.signal_id
        WHERE sl.symbol = $1
        AND sl.hour_time >= NOW() - ($2 || ' hours')::INTERVAL
        GROUP BY sl.symbol, date_trunc('hour', sl.hour_time)
    )
    SELECT 
        symbol,
        hour_time,
        rsi
    FROM HourlySignals
    ORDER BY hour_time DESC;
`,
	GET_RECENT_MA_SIGNALS: `
`,
	SETUP_HYPERTABLE: `
    SELECT create_hypertable('Market_Data', 'timestamp', if_not_exists => TRUE);
    SELECT create_hypertable('Daily_Market_Data', 'date', if_not_exists => TRUE);
`,
	SETUP_RETENTION_POLICY: `    DO $$ 
    BEGIN 
        -- Market_Data 보존 정책
        IF NOT EXISTS (
            SELECT 1 
            FROM timescaledb_information.jobs 
            WHERE application_name LIKE '%Retention%' 
            AND hypertable_name = 'market_data'
        ) THEN
            PERFORM add_retention_policy('market_data', INTERVAL '48 hours', if_not_exists => TRUE);
            PERFORM alter_job(job_id, schedule_interval => INTERVAL '1 day', next_start => CURRENT_DATE + INTERVAL '1 day')
            FROM timescaledb_information.jobs
            WHERE application_name LIKE '%Retention%' AND hypertable_name = 'market_data';
            RAISE NOTICE '새로운 Market_Data 보존 정책이 추가되었습니다.';
        ELSE
            RAISE NOTICE '이미 Market_Data 보존 정책이 존재합니다.';
        END IF;

        -- Daily_Market_Data 보존 정책
        IF NOT EXISTS (
            SELECT 1 
            FROM timescaledb_information.jobs 
            WHERE application_name LIKE '%Retention%' 
            AND hypertable_name = 'daily_market_data'
        ) THEN
            PERFORM add_retention_policy('daily_market_data', INTERVAL '50 days', if_not_exists => TRUE);
            PERFORM alter_job(job_id, schedule_interval => INTERVAL '1 day', next_start => CURRENT_DATE + INTERVAL '1 day')
            FROM timescaledb_information.jobs
            WHERE application_name LIKE '%Retention%' AND hypertable_name = 'daily_market_data';
            RAISE NOTICE '새로운 Daily_Market_Data 보존 정책이 추가되었습니다.';
        ELSE
            RAISE NOTICE '이미 Daily_Market_Data 보존 정책이 존재합니다.';
        END IF;
    END $$;
`,
	GET_RSI_ANALYSIS: `
    WITH hourly_prices AS (
        SELECT 
            symbol,
            date_trunc('hour', timestamp) as hour_time,
            AVG(close_price) as avg_close_price
        FROM market_data
        WHERE symbol = $1
        AND timestamp >= NOW() - ($2 || ' hours')::INTERVAL
        GROUP BY symbol, date_trunc('hour', timestamp)
    ),
    price_changes AS (
        SELECT 
            symbol,
            hour_time,
            avg_close_price,
            avg_close_price - LAG(avg_close_price) OVER (
                ORDER BY hour_time
            ) as price_change
        FROM hourly_prices
    ),
    gains_losses AS (
        SELECT 
            symbol,
            hour_time,
            CASE WHEN price_change > 0 THEN price_change ELSE 0 END as gains,
            CASE WHEN price_change < 0 THEN ABS(price_change) ELSE 0 END as losses
        FROM price_changes
        WHERE price_change IS NOT NULL
    ),
    avg_gains_losses AS (
        SELECT 
            symbol,
            hour_time,
            AVG(gains) as avg_gain,
            AVG(losses) as avg_loss
        FROM gains_losses
        GROUP BY symbol, hour_time
    )
    SELECT 
        symbol,
        hour_time,
        CASE 
            WHEN avg_loss = 0 THEN 100
            ELSE 100 - (100 / (1 + (avg_gain / avg_loss)))
        END as rsi
    FROM avg_gains_losses
    ORDER BY hour_time DESC
    LIMIT 1;
`,
	GET_MACD_ANALYSIS: `
WITH hourly_candles AS (
    SELECT 
        time_bucket('1 hour', timestamp) AS hourly_time,
        symbol,
        FIRST(open_price, timestamp) as open_price,
        MAX(high_price) as high_price,
        MIN(low_price) as low_price,
        LAST(close_price, timestamp) as close_price,
        SUM(volume) as volume
    FROM Market_Data
    WHERE symbol = $1
        AND timestamp >= NOW() - ($2::integer * INTERVAL '1 hour')
    GROUP BY hourly_time, symbol
    ORDER BY hourly_time DESC
),
ema_calc AS (
    SELECT 
        hourly_time,
        close_price,
        symbol,
        EXP(SUM(LN(close_price)) OVER (
            ORDER BY hourly_time DESC
            ROWS BETWEEN ($3::integer - 1) PRECEDING AND CURRENT ROW
        ) / $3::float) as ema_short,
        EXP(SUM(LN(close_price)) OVER (
            ORDER BY hourly_time DESC
            ROWS BETWEEN ($4::integer - 1) PRECEDING AND CURRENT ROW
        ) / $4::float) as ema_long
    FROM hourly_candles
),
macd_calc AS (
    SELECT 
        hourly_time,
        (ema_short - ema_long) as macd_line,
        ema_short,
        ema_long
    FROM ema_calc
    WHERE ema_short IS NOT NULL AND ema_long IS NOT NULL
),
signal_calc AS (
    SELECT 
        hourly_time,
        macd_line,
        EXP(SUM(LN(ABS(macd_line))) OVER (
            ORDER BY hourly_time DESC
            ROWS BETWEEN ($5::integer - 1) PRECEDING AND CURRENT ROW
        ) / $5::float) 
            * SIGN(macd_line) as signal_line
    FROM macd_calc
)
SELECT 
    macd_line as current_macd,
    signal_line as current_signal,
    LAG(macd_line) OVER (ORDER BY hourly_time DESC) as prev_macd,
    LAG(signal_line) OVER (ORDER BY hourly_time DESC) as prev_signal,
    (macd_line - signal_line) as histogram,
    LAG(macd_line - signal_line) OVER (ORDER BY hourly_time DESC) as prev_histogram
FROM signal_calc
WHERE signal_line IS NOT NULL
ORDER BY hourly_time DESC
LIMIT 1;
`,
	INSERT_MACD_SIGNAL: `
    INSERT INTO MacdSignal (
        signal_id,
        macd_line,
        signal_line,
        histogram,
        zero_cross,
        trend_strength,
        score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
`,
	GET_BOLLINGER_BANDS: `
    WITH period_data AS (
        SELECT
            symbol,
            timestamp,
            close_price,
            AVG(close_price) OVER (
                PARTITION BY symbol
                ORDER BY timestamp
                ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
            ) AS moving_avg,
            STDDEV(close_price) OVER (
                PARTITION BY symbol
                ORDER BY timestamp
                ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW
            ) AS moving_stddev
        FROM Market_Data
        WHERE 
            symbol = $1 AND
            timestamp >= NOW() - INTERVAL '1 hour' * $3::integer
    )
    SELECT
        symbol,
        timestamp,
        close_price,
        ROUND((moving_avg + (2 * moving_stddev))::numeric, 5) AS bollinger_upper,
        ROUND(moving_avg::numeric, 5) AS bollinger_middle,
        ROUND((moving_avg - (2 * moving_stddev))::numeric, 5) AS bollinger_lower
    FROM period_data
    ORDER BY timestamp DESC;
`,
	INSERT_BOLLINGER_SIGNAL: `
    INSERT INTO BollingerSignal (
        signal_id,
        upper_band,
        middle_band,
        lower_band,
        close_price,
        band_width,
        score
    ) VALUES ($1, $2, $3, $4, $5, $6, $7);
`,
	GET_STOCHASTIC_OSCILLATOR: `
WITH 
daily_data AS (
    SELECT 
        symbol,
        date,
        high_price,
        low_price,
        avg_close_price AS close
    FROM Daily_Market_Data
    WHERE symbol = $1
        AND date < CURRENT_DATE
),
minute_data AS (
    SELECT
        time_bucket(($4::integer || ' minutes')::interval, timestamp) AS bucket,
        symbol,
        MAX(high_price) AS high,
        MIN(low_price) AS low,
        LAST(close_price, timestamp) AS close
    FROM Market_Data
    WHERE symbol = $1
        AND timestamp >= NOW() - ($4::integer * INTERVAL '1 minute')
    GROUP BY bucket, symbol
),
combined_data AS (
    SELECT 
        date::timestamp AS bucket, 
        symbol,
        high_price AS high,
        low_price AS low,
        close
    FROM daily_data
    UNION ALL
    SELECT 
        bucket,
        symbol,
        high,
        low,
        close
    FROM minute_data
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
    FROM combined_data
    WINDOW w AS (PARTITION BY symbol ORDER BY bucket ROWS BETWEEN ($2::integer * 1440) PRECEDING AND CURRENT ROW)
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
    ROUND(AVG(percent_k) OVER (ORDER BY bucket ROWS BETWEEN $3::integer PRECEDING AND CURRENT ROW)::numeric, 2) AS d_value
FROM k_values
ORDER BY bucket DESC
LIMIT 1;
`,
	INSERT_STOCHASTIC_SIGNAL: `
    INSERT INTO StochasticSignal (signal_id, k_value, d_value, score)
    VALUES ($1, $2, $3, $4);
`,
	INSERT_TRADE: `
    INSERT INTO Trades (uuid, type, symbol, price, quantity, is_dev, fee)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING uuid, type;
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
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (symbol, timestamp)
        DO UPDATE SET
            open_price = EXCLUDED.open_price,
            high_price = EXCLUDED.high_price,
            low_price = EXCLUDED.low_price,
            close_price = EXCLUDED.close_price,
            volume = EXCLUDED.volume;
    `,
};
