# Money - Cryptocurrency Automated Trading System

*Read this in other languages: [한국어](README.ko.md)*

## Introduction
This project is a system that collects and analyzes cryptocurrency market data to execute automated trading. It uses PM2 to manage multiple microservices and PostgreSQL as the database.

## Key Features
- Real-time market data collection (using Upbit API)
- Data analysis and trading signal generation
- Automated trade execution
- Real-time notifications via Discord
- Account management and monitoring

## System Components
- **candle-save**: Candle data collection service
  - Collects real-time market data every 3 seconds
  - Automatic database storage
  - Discord notifications on errors
- **analysis**: Data analysis service
  - Real-time analysis of collected data
  - Trading signal generation
- **trading**: Automated trading execution service
  - Executes automated trading based on analysis
  - Risk and position management
- **account**: Account management service
  - Asset status monitoring
  - Transaction history management

## Tech Stack
- Runtime: Bun v1.1.42
- Process Management: PM2
- Database: PostgreSQL
- Language: TypeScript
- Cron Jobs: node-cron
- Notifications: Discord Webhook

## Installation

1. Clone repository
```bash
git clone [repository-url]
cd money
```

2. Install dependencies
```bash
bun install
```

3. Configure environment variables
```bash
cp .env.example .env
```
Required environment variables:
- DB_USER: Database user
- DB_HOST: Database host
- DB_NAME: Database name
- DB_PASSWORD: Database password
- DB_PORT: Database port
- DISCORD_WEBHOOK_URL: Discord webhook URL
- MARKET_URL: Upbit API URL
- CRYPTO_CODE: Cryptocurrency code to trade (e.g., KRW-BTC)
- WEBHOOK_TYPE: Webhook type (DISCORD)
- LANGUAGE: Language setting (ko/en)

## Database Schema
```sql
CREATE TABLE Market_Data (
    symbol VARCHAR(20),
    timestamp TIMESTAMP,
    open_price DECIMAL,
    high_price DECIMAL,
    low_price DECIMAL,
    close_price DECIMAL,
    volume DECIMAL,
    PRIMARY KEY (symbol, timestamp)
);
```

## PM2 Service Configuration
Each service runs with the following specifications:

- **candle-save**
  - Memory limit: 300MB
  - Daily restart at 22:00
  - Maximum restart attempts: 5
  - Log files: logs/candle-save-error.log, logs/candle-save-out.log

- **analysis**
  - Memory limit: 300MB
  - Auto-restart enabled
  - Backoff restart delay: 100ms

- **trading**
  - Memory limit: 250MB
  - Maximum restart attempts: 3
  - Real-time monitoring

- **account**
  - Memory limit: 200MB
  - Daily restart at 00:00
  - Automatic asset status updates

## Development Mode
```bash
bun run start:test
```

## Test Environment Setup
```bash
bun run start:test:re
```

## Run Candle Data Collection Service Only
```bash
bun run start:candle
```

## License
MIT License

## How to Contribute
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
