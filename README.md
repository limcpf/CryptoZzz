# Money - Cryptocurrency Automatic Trading System

*Read in another language: [한국어](README.ko.md)*

## Introduction
This project is a cryptocurrency automatic trading system based on TypeScript and Bun runtime. It efficiently stores and manages time series data using PostgreSQL and TimescaleDB. It collects real-time market data and analyzes various technical indicators to automatically execute trades.

## Key Features
- **Real-time data collection**: Collects 3 one-second candles every 3 seconds via Upbit API
- **Extensible Technical Analysis**: Flexible analysis system using strategy and factory patterns
   - Built-in strategies: RSI, Moving Average (MA), Volume Analysis
   - Easy addition of custom strategies
   - Generate trading signals through strategy combinations
      1. Create a new strategy class implementing the `src/strategy/iStrategy.ts` interface
      2. Add new strategy file to `src/strategy/impl/` directory
      3. Register new strategy in `StrategyName` enum and `createStrategy` method in `src/strategy/strategy.factory.ts`
      4. Add new strategy name to `STRATEGIES` environment variable
- **Automatic Trading**: Automated trading system based on analysis results
- **Real-time Monitoring**: Trade and system status notifications via Discord
   - Support for various messenger platforms through webhook factory pattern
      1. Create new webhook class implementing `src/shared/services/webhook/iWebhook.ts` interface
      2. Add new webhook implementation to `src/shared/services/webhook/impl/` directory
      3. Add new webhook type to `src/shared/services/webhook/webhook.enum.ts`
      4. Register new webhook in factory method in `src/shared/services/webhook/webhook.factory.ts`
      5. Set new webhook type in `WEBHOOK_TYPE` environment variable
      6. Set new webhook URL in `WEBHOOK_URL` environment variable
- **Multi-strategy Support**: Generate reliable trading signals through combination of multiple trading strategies
- **Failure Recovery System**: Process management and automatic restart through PM2
- **Extensible Exchange Support**: Support for multiple exchanges possible

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

1. **RSI (Relative Strength Index) Strategy**
   - Analyzes overbought/oversold zones
   - RSI < 30: Buy signal
   - RSI > 70: Sell signal
   - RSI calculation based on 14-hour period

2. **Moving Average (MA) Strategy**
   - Cross analysis of short-term (5-hour)/long-term (20-hour) moving averages
   - Golden Cross: Buy signal
   - Dead Cross: Sell signal

3. **Volume Strategy**
   - Compares current volume with average volume (10-hour)
   - Volume increase over 1.5x: Buy signal
   - Below average volume: Sell signal

## Tech Stack
- **Runtime**: Bun v1.1.42
- **Language**: TypeScript
- **Process Management**: PM2
- **Database**: TimescaleDB
- **API**: Upbit API
   - Extensible to other exchanges
- **Notifications**: Discord Webhook
- **Job Scheduling**: node-cron

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
DB_USER=database_user
DB_HOST=database_host
DB_NAME=database_name
DB_PASSWORD=database_password
DB_PORT=database_port

# Language settings (currently supports ko, en only)
LANGUAGE=ko

# Webhook settings (currently supports DISCORD only)
WEBHOOK_TYPE=DISCORD
DISCORD_WEBHOOK_URL=discord_webhook_url

# Exchange settings (currently supports UPBIT only)
MARKET=UPBIT
# API URL (uses default address if not set)
MARKET_URL=https://api.upbit.com

# Trading strategy settings (comma separated, currently supports RSI,MA,VOLUME only)
STRATEGIES=RSI,MA,VOLUME

# Trading cryptocurrency settings (use exchange ticker format)
CRYPTO_CODE=KRW-BTC

# Upbit API authentication keys
UPBIT_OPEN_API_ACCESS_KEY=upbit_access_key
UPBIT_OPEN_API_SECRET_KEY=upbit_secret_key

# Webhook URL (set webhook URL for the messenger platform you use)
WEBHOOK_URL=webhook_url
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