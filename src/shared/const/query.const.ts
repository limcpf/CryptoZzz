import { StochasticStrategy } from "../../services/analysis/strategy/impl/stochastic.strategy";

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
        );`,
		indexes: [
			"CREATE INDEX IF NOT EXISTS idx_market_data_symbol_timestamp ON Market_Data(symbol, timestamp DESC);",
			"CREATE INDEX IF NOT EXISTS idx_market_data_timestamp_brin ON Market_Data USING BRIN(timestamp);",
		],
		hypertable:
			"SELECT create_hypertable('Market_Data', 'timestamp', if_not_exists => TRUE);",
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
      );`,
		indexes: [
			"CREATE INDEX IF NOT EXISTS idx_trades_composite_pk ON Trades(uuid, type, sequence);",
			"CREATE INDEX IF NOT EXISTS idx_trades_symbol_created ON Trades(symbol, created_at);",
			"CREATE INDEX IF NOT EXISTS idx_trades_sequence_btree ON Trades(sequence);",
			"CREATE INDEX IF NOT EXISTS idx_trades_uuid ON Trades(uuid);",
			"CREATE INDEX IF NOT EXISTS idx_trades_symbol_type ON Trades(symbol, type);",
			"CREATE INDEX IF NOT EXISTS idx_trades_created_at_brin ON Trades USING BRIN(created_at);",
		],
	},

	DailyMarketData: {
		table: `
        CREATE TABLE IF NOT EXISTS Daily_Market_Data (
            symbol TEXT,
            date DATE,
            avg_close_price NUMERIC,
            high_price NUMERIC,
            low_price NUMERIC,
            total_volume NUMERIC,
            PRIMARY KEY (symbol, date)
        );
        `,
		indexes: [
			"CREATE INDEX IF NOT EXISTS idx_daily_market_data_date ON Daily_Market_Data(date DESC);",
			"CREATE INDEX IF NOT EXISTS idx_daily_market_data_symbol_date_include ON Daily_Market_Data(symbol, date) INCLUDE (high_price, low_price);",
		],
	},

	SignalLog: {
		table: `
      CREATE TABLE IF NOT EXISTS SignalLog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol TEXT NOT NULL,
        hour_time TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );`,
	},

	StochasticSignal: {
		table: `
        CREATE TABLE IF NOT EXISTS StochasticSignal (
            signal_id UUID PRIMARY KEY,
            k_value NUMERIC NOT NULL,
            d_value NUMERIC NOT NULL,
            score NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );
    `,
	},
	RsiSignal: {
		table: `
        CREATE TABLE IF NOT EXISTS RsiSignal (
            signal_id UUID PRIMARY KEY,
            rsi NUMERIC NOT NULL,
            score NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );
    `,
	},
	MaSignal: {
		table: `
        CREATE TABLE IF NOT EXISTS MaSignal (
            signal_id UUID PRIMARY KEY,
            short_ma NUMERIC NOT NULL,
            long_ma NUMERIC NOT NULL,
            prev_short_ma NUMERIC NOT NULL,
            score NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );
    `,
	},
	VolumeSignal: {
		table: `
        CREATE TABLE IF NOT EXISTS VolumeSignal (
            signal_id UUID PRIMARY KEY,
            current_volume NUMERIC NOT NULL,
            avg_volume NUMERIC NOT NULL,
            score NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );
    `,
	},
	MacdSignal: {
		table: `
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
    `,
	},
	BollingerSignal: {
		table: `
        CREATE TABLE IF NOT EXISTS BollingerSignal (
            signal_id UUID PRIMARY KEY,
            upper_band NUMERIC NOT NULL,
            middle_band NUMERIC NOT NULL,
            lower_band NUMERIC NOT NULL,
            close_price NUMERIC NOT NULL,
            band_width NUMERIC NOT NULL,
            score NUMERIC NOT NULL,
            FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
        );`,
	},
};

// 조합 함수 수정
export const composeSchema = (tables: (keyof typeof TABLE_DEFINITIONS)[]) => {
	return tables
		.map((t) => {
			const definition = TABLE_DEFINITIONS[t];
			const components = [
				definition.table,
				...(definition.indexes || []),
				...(definition.hypertable ? [definition.hypertable] : []),
			];
			return components.join("\n");
		})
		.join("\n\n");
};

// 전체 스키마 (기존 구조와 호환 유지)
export const QUERIES = {
	init: composeSchema([
		"Market_Data",
		"Trades",
		"SignalLog",
		"DailyMarketData",
		"StochasticSignal",
		"RsiSignal",
		"MaSignal",
		"VolumeSignal",
		"MacdSignal",
		"BollingerSignal",
	]),
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
	// 기존 쿼리들 유지
	GET_CURRENT_PRICE:
		"SELECT close_price FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;",
	GET_LAST_MARKET_DATA_TIMESTAMP:
		"SELECT timestamp FROM Market_Data WHERE symbol = $1 ORDER BY timestamp DESC LIMIT 1;",
	GET_LAST_ORDER:
		"SELECT id FROM Orders WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1;",
	INSERT_SIGNAL_LOG: `
    INSERT INTO SignalLog (symbol, hour_time)
    VALUES ($1, $2)
    RETURNING id;
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
	WITH PriceChanges AS (
		SELECT 
			symbol,
			date,
			avg_close_price,
			avg_close_price - LAG(avg_close_price) OVER (PARTITION BY symbol ORDER BY date) AS price_change
		FROM Daily_Market_Data
		WHERE symbol = $1
		AND date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
	),
	GainsLosses AS (
		SELECT
			symbol,
			date,
			CASE WHEN price_change > 0 THEN price_change ELSE 0 END AS gain,
			CASE WHEN price_change < 0 THEN ABS(price_change) ELSE 0 END AS loss
		FROM PriceChanges
	),
	AvgGainsLosses AS (
		SELECT
			symbol,
			date,
			AVG(gain) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW) AS avg_gain,
			AVG(loss) OVER (PARTITION BY symbol ORDER BY date ROWS BETWEEN $2::integer - 1 PRECEDING AND CURRENT ROW) AS avg_loss
		FROM GainsLosses
	)
	SELECT
		symbol,
		date,
		CASE 
		WHEN avg_gain = 0 AND avg_loss = 0 THEN 50
		WHEN avg_loss = 0 THEN 100
		WHEN avg_gain = 0 THEN 0
		ELSE ROUND(100 - (100 / (1 + avg_gain / avg_loss)), 2)
		END AS rsi
	FROM AvgGainsLosses
	WHERE date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
	ORDER BY symbol, date DESC;
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
