# Money - Cryptocurrency Automatic Trading System

*Read in another language: [English] (README.md )*

## Introduction
This project is a cryptocurrency automatic trading system based on TypeScript and Bun runtime. It manages multiple microservices using PM2, using PostgreSQL as its database. It collects real-time market data and analyzes various technical indicators to automatically execute transactions.

## Key Features
- **Real-time data collection**: Real-time market data collection at 3-second intervals via Upbit API
- **Technical analysis**: RSI, moving average (MA), trading volume analysis to generate trading signals
- **Automatic trading **: Automatic trading system based on analysis results
- **Real-time monitoring**: Notifications of transactions and system status through Discord
- **Multi-strategic support**: generates reliable trading signals through a combination of multiple trading strategies
- **Failure recovery system**: Process management and automatic restart with PM2

## System Architecture

### Microservice Configuration
1. **candle-save service**
   - Real-time candle data collection (3 second intervals)
   - Save the PostgreSQL database
   - Discord notification in case of an error
   - Memory limit: 300MB
   - Automatic restart at 22:00 daily

2. **Analysis Services**
   - Real-time analysis of collected data
   - Analysis of three technical indicators (RSI, MA, Volume)
   - Generating and verifying trading signals
   - Memory limit: 300MB
   - Apply automatic restart and backoff strategies

3. **Trading Services**
   - Auto-trading based on analysis results
   - Risk Management and Position Management
   - Real-time Transaction Monitoring
   - Memory limit: 250MB

4. **Account Services**
   - Monitor Account Balance and Position
   - Transaction history management and recording
   - Automatic restart at 0:00 a.m. daily
   - Memory limit: 200MB

### Technical Analysis Strategy

1. **RSI (Relative Strength Index) 전략**
   - Analysis of Overbuying/Overbuying Section
   - RSI <30: Buy sign
   - RSI > 70: Signs to sell
   - Calculate RSI on a 14-hour basis

2. **Movement average (MA) strategy**
   - Cross-analysis of short-term (5 hours)/long-term (20 hours) moving means
   - Golden Cross: A Buy Sign
   - Dead Cross: Signs to Sell

3. ** Trading volume strategy**
   - Compare current and average volume (10 hours)
   - Trading Volume Up More Than 1.5X: Signs Of Buy
   - Below Average Volume: Selling Signals

## Tech Stack
- **Runtime**: Bun v1.1.42
- **Language**: TypeScript
- **Process Management**: PM2
- **Database**: PostgreSQL
- **API**: Upbit API
- **알림**: Discord Webhook
- **Work scheduling**: node-cron

## Installation and execution

### Prerequisites
- Bun v1.1.42 and later
- PostgreSQL 13 and later
- PM2 (Global Installation)
- Discord Webhook URL

### How to Install

1. Storage Clones
```bash
git clone [repository-url]
cd money
```

2. Dependency installation
```bash
bun install
```

3. Setting Environmental Variables
```bash
cp .env.example .env
```

### Required Environmental Variables
```
# Database Settings
DB_USER= Database_User
DB_HOST=Database_Host
DB_NAME= Database_Name
DB_PASSWORD= Database_password
DB_PORT= Database_Port

# Language settings (currently ko, en only)
LANGUAGE=ko

# Web Hook Settings (currently DISCORD only)
WEBHOOK_TYPE=DISCORD
DISCORD_WEBHOOK_URL= DISCORD_Web Hook_URL

# Exchange Settings (currently UPBIT only)
MARKET=UPBIT
# API URL (Use default address if not set)
MARKET_URL=https://api.upbit.com

# Set up a trading strategy (comma separated, currently RSI,MA, VOLUME only)
STRATEGIES=RSI,MA,VOLUME

# Set up cryptocurrency to trade (using exchange ticker format)
CRYPTO_CODE=KRW-BTC

# Upbit API authentication key
UPBIT_OPEN_API_ACCESS_KEY=Upbit_Access_Key
UPBIT_OPEN_API_SECRET_KEY= UPBIT_Secret_Key
```

### Run Mode

1. Running the entire service
```bash
bun run start
```

2. Run development mode
```bash
bun run start:test
```

3. Running Candle Data Collection Service Only
```bash
bun run start:candle
```

## Database Schema

### Market_Data Table
```sql
CREATE TABLE Market_Data (
    symbol VARCHAR(10),
    timestamp TIMESTAMPTZ,
    open_price NUMERIC,
    high_price NUMERIC,
    low_price NUMERIC,
    close_price NUMERIC,
    volume NUMERIC,
    PRIMARY KEY (symbol, timestamp)
);

-- Create a TimescaleDB hypertable
SELECT create_hypertable('Market_Data', 'timestamp');
```

### Order Table
```sql
CREATE TABLE Orders (
    id UUID PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    buy_price NUMERIC NOT NULL,
    sell_price NUMERIC,
    quantity NUMERIC NOT NULL,
    status VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT order_type_check CHECK (order_type IN ('BUY', 'SELL')),
    CONSTRAINT status_check CHECK (status IN ('PENDING', 'FILLED', 'CANCELLED'))
);

CREATE INDEX idx_orders_symbol ON Orders(symbol);
CREATE INDEX idx_orders_status ON Orders(status);
CREATE INDEX idx_orders_created_at ON Orders(created_at);
```

### signal-related table
```sql
CREATE TABLE SignalLog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    hour_time TIMESTAMP NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE RsiSignal (
    signal_id UUID PRIMARY KEY,
    rsi NUMERIC NOT NULL,
    FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
);

CREATE TABLE MaSignal (
    signal_id UUID PRIMARY KEY,
    short_ma NUMERIC NOT NULL,
    long_ma NUMERIC NOT NULL,
    FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
);

CREATE TABLE VolumeSignal (
    signal_id UUID PRIMARY KEY,
    current_volume NUMERIC NOT NULL,
    avg_volume NUMERIC NOT NULL,
    FOREIGN KEY (signal_id) REFERENCES SignalLog(id)
);
```

## Monitoring and Logging

### Log File Location
- 캔들 데이터 수집: logs/candle-save-error.log, logs/candle-save-out.log
- 분석 서비스: logs/analysis-error.log, logs/analysis-out.log
- 거래 서비스: logs/trading-error.log, logs/trading-out.log
- 계정 서비스: logs/account-error.log, logs/account-out.log

### Monitoring PM2
```bash
pm2 monitor #real-time monitoring
pm2 logs # log check
pm2 status # check service status
```

## PM2 Settings

### production environment (ecosystem.config.cjs)

PM2 settings for each service are as follows:

1. **candle-save service**
   - Run a single instance
   - Disable automatic restart
   - Separating error/output log files
   - Time zone: Asia/Seoul

2. **Analysis Services**
   - Memory limit: 300MB
   - Enabling Automatic Restart
   - Apply backoff strategy (start delay: 100ms)
   - Enable file change detection

3. **Trading Services**
   - Memory limit: 250MB
   - Maximum number of restarts: 3
   - Enable file change detection

4. **Account Services**
   - Memory limit: 200MB
   - Automatic restart at 0:00 every day
   - Enable file change detection

### Test Environment (ecosystem.test.config.cjs)

The test environment uses a reduced service configuration:

1. **candle-save-test service**
   - Memory limit: 100MB
   - Disable automatic restart
   - Maximum number of restarts: 3
   - Using a Separate Log Directory for Testing

2. **Analysis-test service**
   - Memory limit: 150MB
   - Disable automatic restart
   - Maximum number of restarts: 3
   - Using a Separate Log Directory for Testing

### Common Settings
- **File Watch**: src/pm2-events.ts file change detected
- **ignore directory**: node_modules, logs
- **Instance variable**: INSTANCE_ID
- **PMX Monitoring**: Enable

## Licenses
MIT License

## How to contribute
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request