export const QUERIES = {
	AGGREGATE_DAILY_METRICS: `
    INSERT INTO Daily_Market_Data (symbol, date, avg_close_price, high_price, low_price, total_volume)
    SELECT
        symbol,
        DATE(timestamp) AS date,
        ROUND(AVG(close_price)::numeric, 5) AS avg_close_price,
        MAX(high_price) AS high_price,
        MIN(low_price) AS low_price,
        SUM(volume) AS total_volume
    FROM Market_Data
    WHERE DATE(timestamp) = $1::DATE
    GROUP BY symbol, DATE(timestamp)
    ON CONFLICT (symbol, date)
    DO UPDATE SET
        avg_close_price = EXCLUDED.avg_close_price,
        high_price = EXCLUDED.high_price,
        low_price = EXCLUDED.low_price,
        total_volume = EXCLUDED.total_volume
    RETURNING date, avg_close_price, high_price, low_price, total_volume;
`,
	CREATE_INDEXES: `
    -- Market_Data 테이블
    CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON Market_Data(symbol, timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_market_data_timestamp_brin ON Market_Data USING BRIN(timestamp);
    
    -- Daily_Market_Data 테이블
    CREATE INDEX IF NOT EXISTS idx_daily_market_data_date ON Daily_Market_Data(date DESC);
    CREATE INDEX IF NOT EXISTS idx_daily_market_data_symbol_date_include ON Daily_Market_Data(symbol, date) INCLUDE (high_price, low_price);
`,
	CREATE_TABLES: `
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

    CREATE TABLE IF NOT EXISTS SignalLog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol VARCHAR(10) NOT NULL,
        hour_time TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS StochasticSignal (
        signal_id UUID PRIMARY KEY,
        k_value NUMERIC NOT NULL,
        d_value NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );

    CREATE TABLE IF NOT EXISTS RsiSignal (
        signal_id UUID PRIMARY KEY,
        rsi NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );

    CREATE TABLE IF NOT EXISTS MaSignal (
        signal_id UUID PRIMARY KEY,
        short_ma NUMERIC NOT NULL,
        long_ma NUMERIC NOT NULL,
        prev_short_ma NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );

    CREATE TABLE IF NOT EXISTS VolumeSignal (
        signal_id UUID PRIMARY KEY,
        current_volume NUMERIC NOT NULL,
        avg_volume NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );

    CREATE TABLE IF NOT EXISTS Daily_Market_Data (
        symbol VARCHAR(10),
        date DATE,
        avg_close_price NUMERIC,
        high_price NUMERIC,
        low_price NUMERIC,
        total_volume NUMERIC,
        PRIMARY KEY (symbol, date)
    );

    CREATE TABLE IF NOT EXISTS MacdSignal (
        signal_id UUID PRIMARY KEY,
        macd_line NUMERIC NOT NULL,
        signal_line NUMERIC NOT NULL,
        histogram NUMERIC NOT NULL,
        zero_cross BOOLEAN NOT NULL,
        trend_strength NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );

    CREATE TABLE IF NOT EXISTS BollingerSignal (
        signal_id UUID PRIMARY KEY,
        upper_band NUMERIC NOT NULL,
        middle_band NUMERIC NOT NULL,
        lower_band NUMERIC NOT NULL,
        close_price NUMERIC NOT NULL,
        band_width NUMERIC NOT NULL,
        score NUMERIC NOT NULL,
        FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
    );
`,
	GET_CURRENT_PRICE: `
    SELECT close_price FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;
`,
	GET_LAST_MARKET_DATA_TIMESTAMP: `
    SELECT timestamp FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;
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
	INSERT_MA_SIGNAL: `
    INSERT INTO MaSignal (signal_id, short_ma, long_ma, prev_short_ma, score)
    VALUES ($1, $2, $3, $4, $5);
`,
	INSERT_VOLUME_SIGNAL: `
    INSERT INTO VolumeSignal (signal_id, current_volume, avg_volume, score)
    VALUES ($1, $2, $3, $4);
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
	GET_RECENT_RSI_SIGNALS: `
		WITH HourlySignals AS (
			SELECT 
				symbol,
				date_trunc('hour', hour_time) as hour_time,
				AVG(rs.rsi) as rsi
			FROM SignalLog sl
			INNER JOIN RsiSignal rs ON sl.id = rs.signal_id
			WHERE sl.symbol = $1
			AND sl.hour_time >= NOW() - INTERVAL '$2 hours'
			GROUP BY symbol, date_trunc('hour', hour_time)
		)
		SELECT 
			symbol,
			hour_time,
			rsi
		FROM HourlySignals
		ORDER BY hour_time DESC;
	`,
	GET_RECENT_MA_SIGNALS: `
WITH
    -- 실시간(오늘) 데이터 집계
    today_data AS (
        SELECT
            symbol,
            NOW()::DATE AS date,
            AVG(close_price) AS avg_close_price,
            SUM(volume) AS total_volume
        FROM Market_Data
        WHERE symbol = $1
        AND timestamp >= NOW()::DATE
    ),
    -- 과거 데이터와 실시간 데이터 결합
    combined_data AS (
        SELECT * FROM Daily_Market_Data
        UNION ALL
        SELECT * FROM today_data
    ),
    -- MA 계산
    ma_calculations AS (
        SELECT
            symbol,
            date,
            avg_close_price,
            -- 단기 MA (5일)
            AVG(avg_close_price) OVER (
                PARTITION BY symbol
                ORDER BY date
                ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
            ) AS short_ma,
            -- 장기 MA (20일)
            AVG(avg_close_price) OVER (
                PARTITION BY symbol
                ORDER BY date
                ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
            ) AS long_ma,
            -- 이전 단기 MA (5일)
            LAG(AVG(avg_close_price) OVER (
                PARTITION BY symbol
                ORDER BY date
                ROWS BETWEEN 4 PRECEDING AND CURRENT ROW
            )) OVER (
                PARTITION BY symbol
                ORDER BY date
            ) AS prev_short_ma
        FROM combined_data
    )
SELECT
    symbol,
    date,
    short_ma,
    long_ma,
    -- 기본 스코어 계산
    TANH(5 * (short_ma - long_ma) / long_ma) AS base_score,
    -- 변화율 반영 스코어
    TANH(5 * (short_ma - long_ma) / long_ma) +
    0.1 * ((short_ma - prev_short_ma) / NULLIF(prev_short_ma, 0)) AS final_score
FROM ma_calculations
WHERE date >= NOW()::DATE - INTERVAL '20 days'
ORDER BY symbol, date;
`,
	SETUP_HYPERTABLE: `
    SELECT create_hypertable('Market_Data', 'timestamp', if_not_exists => TRUE);
    SELECT create_hypertable('Daily_Market_Data', 'date', if_not_exists => TRUE);
`,
	SETUP_RETENTION_POLICY: `
    DO $$ 
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
		WITH price_changes AS (
			SELECT 
				symbol,
				timestamp,
				close_price,
				close_price - LAG(close_price) OVER (
					PARTITION BY symbol 
					ORDER BY timestamp
				) as price_change
			FROM Market_Data
			WHERE symbol = $1
			AND timestamp >= NOW() - INTERVAL '$2 hours'
		),
		avg_changes AS (
			SELECT 
				symbol,
				AVG(CASE WHEN price_change > 0 THEN price_change ELSE 0 END) as avg_gain,
				ABS(AVG(CASE WHEN price_change < 0 THEN price_change ELSE 0 END)) as avg_loss
			FROM price_changes
			WHERE price_change IS NOT NULL
			GROUP BY symbol
		)
		SELECT 
			symbol,
			100 - (100 / (1 + (avg_gain / NULLIF(avg_loss, 0)))) as rsi
		FROM avg_changes;
	`,
	GET_PRICE_VOLATILITY: `
        WITH hourly_prices AS (
            SELECT 
                symbol,
                date_trunc('hour', timestamp) as hour,
                AVG(close_price) as avg_price
            FROM Market_Data
            WHERE 
                symbol = $1
                AND timestamp >= NOW() - INTERVAL '24 hours'
            GROUP BY symbol, date_trunc('hour', timestamp)
        ),
        price_changes AS (
            SELECT 
                symbol,
                hour,
                avg_price,
                ((avg_price - LAG(avg_price) OVER (ORDER BY hour)) / LAG(avg_price) OVER (ORDER BY hour)) as price_change
            FROM hourly_prices
        )
        SELECT 
            symbol,
            COALESCE(
                STDDEV(price_change) * SQRT(24), -- 24시간 기준으로 변동성 연율화
                0.1 -- 데이터가 부족할 경우 기본값
            ) as volatility
        FROM price_changes
        GROUP BY symbol;
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
        AND timestamp >= NOW() - INTERVAL '$2 hours'
    GROUP BY hourly_time, symbol
    ORDER BY hourly_time DESC
),
ema_calc AS (
    SELECT 
        hourly_time,
        close_price,
        symbol,
        EXP(SUM(LN(close_price)) FILTER (ORDER BY hourly_time DESC) 
            OVER (ROWS BETWEEN ($3::integer - 1) PRECEDING AND CURRENT ROW) / $3::float) as ema_short,
        EXP(SUM(LN(close_price)) FILTER (ORDER BY hourly_time DESC) 
            OVER (ROWS BETWEEN ($4::integer - 1) PRECEDING AND CURRENT ROW) / $4::float) as ema_long
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
        EXP(SUM(LN(ABS(macd_line))) FILTER (ORDER BY hourly_time DESC) 
            OVER (ROWS BETWEEN ($5::integer - 1) PRECEDING AND CURRENT ROW) / $5::float) 
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
        time_bucket('1 minute', timestamp) AS bucket,
        symbol,
        MAX(high_price) AS high,
        MIN(low_price) AS low,
        LAST(close_price, timestamp) AS close
    FROM Market_Data
    WHERE symbol = $1
        AND timestamp >= NOW() - INTERVAL '$4 minutes'
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
stochastic_calculation AS (
    SELECT
        bucket,
        symbol,
        close,
        (close - MIN(low) OVER w) / 
        NULLIF(MAX(high) OVER w - MIN(low) OVER w, 0) * 100 AS percent_k,
        AVG(
            (close - MIN(low) OVER w) / 
            NULLIF(MAX(high) OVER w - MIN(low) OVER w, 0) * 100
        ) OVER (ORDER BY bucket ROWS BETWEEN $4 PRECEDING AND CURRENT ROW) AS percent_d
    FROM combined_data
    WINDOW w AS (PARTITION BY symbol ORDER BY bucket ROWS BETWEEN ($3 * 1440) PRECEDING AND CURRENT ROW)
)
SELECT
    bucket AS timestamp,
    ROUND(percent_k::numeric, 2) AS k_value,
    ROUND(percent_d::numeric, 2) AS d_value
FROM stochastic_calculation
ORDER BY bucket DESC
LIMIT 1;
`,
	INSERT_STOCHASTIC_SIGNAL: `
    INSERT INTO StochasticSignal (signal_id, k_value, d_value, score)
    VALUES ($1, $2, $3, $4);
`,
};
