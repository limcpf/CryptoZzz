# CryptoZzz - Cryptocurrency Automatic Trading System

![License](https://img.shields.io/badge/license-MIT-blue)
![Bun Version](https://img.shields.io/badge/Bun-v1.1.42-ff69b4)

[한국어로된 문서 보기](https://github.com/limcpf/CryptoZzz/blob/main/README.ko.md)

A cryptocurrency automatic trading system based on exchange APIs. Provides microservice architecture for real-time data collection, multi-strategy analysis, and automated trading execution.

## 🛠 Tech Stack
- **Language + Runtime**: TypeScript + Bun v1.1.42
- **Database**: TimescaleDB (PostgreSQL extension)
- **Process Management**: PM2
- **Main Libraries**: node-cron
- **Testing Libraries**: testcontainers

## 🚀 Getting Started
- Bun 1.1.42+
- TimescaleDB 2.12.0+pg13
- PM2 (Global installation)

```bash
# Clone repository
git clone [repository-url]
cd money

# Install dependencies
bun install

# Configure environment (refer to example file for environment variables)
cp .env.example .env

# Docker build and run
docker-compose up --build

# Run in background
docker-compose up -d --build
```

### Run Services
```bash
# Development mode (requires local TimescaleDB database)
bun run start:test
```

## 🏗 System Architecture

```mermaid
graph TD
    subgraph Microservice Group
        A[Candle-Save\n1-minute interval data collection\nMultiple instances per coin]
        B[Analysis\nMulti-strategy combination analysis]
        C[Trading\nDynamic risk management]
        D[Account\nReal-time asset monitoring]
        M[Manager\nBatch job management]
    end

    E[(TimescaleDB)] -->|Analysis Query| B
    A -->|Real-time candle storage| E
    B -->|Pub/Sub signal delivery| C
    C -->|Exchange API call| F[[Upbit]]
    C -->|Result notification| G[[Discord]]
    D -->|Balance change notification| G
    M -->|Data cleanup| E
    M -->|Daily report| G

    style A stroke:#4CAF50,stroke-width:2px
    style B stroke:#2196F3,stroke-width:2px
    style C stroke:#FF5722,stroke-width:2px
    style D stroke:#9C27B0,stroke-width:2px
    style M stroke:#607D8B,stroke-width:2px
```

```mermaid
sequenceDiagram
    participant C as Candle-Save
    participant DB as TimescaleDB
    participant A as Analysis
    participant T as Trading
    participant M as Manager
    participant G as Webhook(ex. Discord)
    
    C->>DB: INSERT candle data
    C->>A: NOTIFY 'analyze_channel'
    A->>DB: Execute analysis query
    A->>T: NOTIFY 'trading_channel' (JSON signal)
    T->>DB: Query position info
    T->>M: NOTIFY 'manager_channel' (Trade result)
    M->>DB: DELETE data older than 48 hours
    M->>G: Send daily report
```
```mermaid
flowchart LR
    subgraph Candle Instances
        C1[Candle-Save\nKRW-BTC]
        C2[Candle-Save\nKRW-ETH]
        C3[Candle-Save\nKRW-XRP]
    end
    
    C1 -->|Dedicated channel| A1[Analysis]
    C2 -->|Dedicated channel| A2[Analysis] 
    C3 -->|Dedicated channel| A3[Analysis]
    
    A1 --> T[Trading]
    A2 --> T
    A3 --> T
```

### Microservice Configuration
1. **Candle-Save Service**
   - Minute-level (1-minute candle) data collection
   - Independent instance operation per coin (distinguished by CRYPTO_CODE)
     - Example: `CRYPTO_CODE=KRW-BTC`
     - System environment variables required (ecosystem.config.js)
     - Second interval setting through TIME environment variable required for per-coin instances
   - Main Pub/Sub events:
     - `analyze_channel`: Analysis service trigger

2. **Analysis Service**
   - Multi-analysis based on strategy factory pattern
   - Multi-strategy combination score calculation
   - Strategy list configuration via `STRATEGIES` environment variable
     - Example: `STRATEGIES=RSI,MA,Volume`
   - Additional strategies can be implemented using IStrategy interface
     - New strategies can be added using factory pattern
   - JSON format signal transmission via `trading_channel`

3. **Trading Service**
   - Dynamic threshold calculation (reflecting market trends)
   - Non-linear weighted trading algorithm
   - Stop-loss/Take-profit mechanism implementation
     - STOP_LOSS_THRESHOLD, PROFIT_TAKE_THRESHOLD environment variables required

4. **Manager Service**
   - Daily data aggregation (00:00 KST)
   - Automatic deletion of 48-hour old data
   - Webhook communication implementation

## 🤝 Contribution Guide
1. Fork repository
2. Create feature branch (`feature/your-feature`)
3. Commit and Push
4. Create Pull Request

## 📄 License
MIT License
