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
- **analysis**: Data analysis service
- **trading**: Automated trading execution service
- **account**: Account management service

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
- DB_USER
- DB_HOST
- DB_NAME
- DB_PASSWORD
- DB_PORT
- DISCORD_WEBHOOK_URL

## Running the Application

Start services:
```bash
bun run start
```

Stop services:
```bash
bun run stop
```

Restart services:
```bash
bun run restart
```

View logs:
```bash
bun run logs
```

## PM2 Service Configuration
Each service runs with the following specifications:

- **candle-save**
  - Memory limit: 300MB
  - Daily restart at 22:00
  - Maximum restart attempts: 5

- **analysis**
  - Memory limit: 300MB
  - Auto-restart enabled

- **trading**
  - Memory limit: 250MB
  - Maximum restart attempts: 3

- **account**
  - Memory limit: 200MB
  - Daily restart at 00:00

## License
MIT License

## How to Contribute
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
