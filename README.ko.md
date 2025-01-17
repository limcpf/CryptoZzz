# Money - 암호화폐 자동 거래 시스템

*다른 언어로 읽기: [English](README.md)*

## 소개
이 프로젝트는 TypeScript와 Bun 런타임을 기반으로 한 암호화폐 자동 거래 시스템입니다. PostgreSQL과 TimescaleDB를 사용하여 시계열 데이터를 효율적으로 저장하고 관리합니다. 실시간 시장 데이터를 수집하고 다양한 기술적 지표를 분석하여 자동으로 거래를 실행합니다.

## 주요 기능
- **실시간 데이터 수집**: Upbit API를 통한 3초 마다 1초봉 캔들 3개의 실시간 시장 데이터 수집
- **확장 가능한 기술적 분석**: 전략 패턴과 팩토리 패턴을 활용한 유연한 분석 시스템
   - 기본 제공 전략: RSI, 이동평균(MA), 거래량 분석
   - 사용자 정의 전략 쉽게 추가 가능
   - 전략 조합을 통한 매매 신호 생성
      1. `src/strategy/iStrategy.ts` 인터페이스를 구현하는 새로운 전략 클래스 생성
      2. `src/strategy/impl/` 디렉토리에 새로운 전략 파일 추가
      3. `src/strategy/strategy.factory.ts`의 `StrategyName` enum과 `createStrategy` 메소드에 새로운 전략 등록
      4. 환경 변수 `STRATEGIES`에 새로운 전략 이름 추가
- **자동 거래 실행**: 분석 결과에 따른 자동 매매 시스템
- **실시간 모니터링**: Discord를 통한 거래 및 시스템 상태 알림
   - 웹훅 팩토리 패턴을 통한 다양한 메신저 플랫폼 지원 가능
      1. `src/shared/services/webhook/iWebhook.ts` 인터페이스를 구현하는 새로운 웹훅 클래스 생성
      2. `src/shared/services/webhook/impl/` 디렉토리에 새로운 웹훅 구현체 추가
      3. `src/shared/services/webhook/webhook.enum.ts`에 새로운 웹훅 타입 추가
      4. `src/shared/services/webhook/webhook.factory.ts`의 팩토리 메소드에 새로운 웹훅 등록
      5. 환경 변수 `WEBHOOK_TYPE`에 새로운 웹훅 타입 설정
      6. `src/shared/services/webhook/webhook.enum.ts`에 새로운 웹훅 타입 추가
      7. `src/shared/services/webhook/webhook.factory.ts`의 팩토리 메소드에 새로운 웹훅 등록
      8. 환경 변수 `WEBHOOK_URL`에 새로운 웹훅 URL 설정
- **다중 전략 지원**: 여러 거래 전략의 조합을 통한 신뢰도 높은 매매 신호 생성
- **장애 복구 시스템**: PM2를 통한 프로세스 관리 및 자동 재시작
- **확장 가능한 거래소 지원**: 여러 거래소 지원 가능

## 시스템 아키텍처

### 마이크로서비스 구성
1. **candle-save 서비스**
   - 실시간 캔들 데이터 수집 (3초 간격)
   - TimescaleDB 데이터베이스 저장
   - 오류 발생 시 Discord 알림

2. **analysis 서비스**
   - 수집된 데이터 실시간 분석
   - 3가지 기술적 지표 분석 (RSI, MA, Volume)
   - 매매 신호 생성 및 검증

3. **trading 서비스**
   - 분석 결과 기반 자동 매매 실행
   - 위험 관리 및 포지션 관리
   - 실시간 거래 모니터링

### 기술적 분석 전략

1. **RSI (Relative Strength Index) 전략**
   - 과매수/과매도 구간 분석
   - RSI < 30: 매수 신호
   - RSI > 70: 매도 신호
   - 14시간 기준 RSI 계산

2. **이동평균(MA) 전략**
   - 단기(5시간)/장기(20시간) 이동평균 교차 분석
   - 골든 크로스: 매수 신호
   - 데드 크로스: 매도 신호

3. **거래량 전략**
   - 현재 거래량과 평균 거래량(10시간) 비교
   - 거래량 1.5배 이상 증가: 매수 신호
   - 평균 거래량 미만: 매도 신호

## 기술 스택
- **런타임**: Bun v1.1.42
- **언어**: TypeScript
- **프로세스 관리**: PM2
- **데이터베이스**: TimescaleDB
- **API**: Upbit AP능
   - 다른 거래소로 확장 가능
- **알림**: Discord Webhook
- **작업 스케줄링**: node-cron

## 설치 및 실행

### 사전 요구사항
- Bun v1.1.42 이상
- TimescaleDB 2.12.0 이상
- PM2 (글로벌 설치)
- Discord Webhook URL

### 설치 방법

1. 저장소 클론
```bash
git clone [repository-url]
cd money
```

2. 의존성 설치
```bash
bun install
```

3. 환경 변수 설정
```bash
cp .env.example .env
```

### 필수 환경 변수
```
# 데이터베이스 설정
DB_USER=데이터베이스_사용자
DB_HOST=데이터베이스_호스트
DB_NAME=데이터베이스_이름
DB_PASSWORD=데이터베이스_비밀번호
DB_PORT=데이터베이스_포트

# 언어 설정 (현재 ko, en만 지원)
LANGUAGE=ko

# 웹훅 설정 (현재 DISCORD만 지원)
WEBHOOK_TYPE=DISCORD
DISCORD_WEBHOOK_URL=디스코드_웹훅_URL

# 거래소 설정 (현재 UPBIT만 지원)
MARKET=UPBIT
# API URL (미설정시 기본 주소 사용)
MARKET_URL=https://api.upbit.com

# 거래 전략 설정 (쉼표로 구분, 현재 RSI,MA,VOLUME만 지원)
STRATEGIES=RSI,MA,VOLUME

# 거래 대상 암호화폐 설정 (거래소 티커 형식 사용)
CRYPTO_CODE=KRW-BTC

# Upbit API 인증 키
UPBIT_OPEN_API_ACCESS_KEY=업비트_액세스_키
UPBIT_OPEN_API_SECRET_KEY=업비트_시크릿_키

# 웹훅 URL (사용하는 메신저 플랫폼의 웹훅 URL 설정)
WEBHOOK_URL=웹훅_URL
```

### 실행 모드

1. 전체 서비스 실행
```bash
bun run start
```

2. 개발 모드 실행
```bash
bun run start:test
```

3. 캔들 데이터 수집 서비스만 실행
```bash
bun run start:candle
```

## 데이터베이스 스키마

### Market_Data 테이블
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

-- TimescaleDB 하이퍼테이블 생성
SELECT create_hypertable('Market_Data', 'timestamp');
```

### Orders 테이블
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

### 신호 관련 테이블
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

## 모니터링 및 로깅

### 로그 파일 위치
- 캔들 데이터 수집: logs/candle-save-error.log, logs/candle-save-out.log
- 분석 서비스: logs/analysis-error.log, logs/analysis-out.log
- 거래 서비스: logs/trading-error.log, logs/trading-out.log
- 계정 서비스: logs/account-error.log, logs/account-out.log

### PM2 모니터링
```bash
pm2 monit  # 실시간 모니터링
pm2 logs   # 로그 확인
pm2 status # 서비스 상태 확인
```


### 테스트 환경 (ecosystem.test.config.cjs)

테스트 환경에서는 축소된 서비스 구성을 사용합니다:

1. **candle-save-test 서비스**
   - 메모리 제한: 100MB
   - 자동 재시작 비활성화
   - 최대 재시작 횟수: 3회
   - 테스트용 별도 로그 디렉토리 사용

2. **analysis-test 서비스**
   - 메모리 제한: 150MB
   - 자동 재시작 비활성화
   - 최대 재시작 횟수: 3회
   - 테스트용 별도 로그 디렉토리 사용

### 공통 설정
- **파일 감시**: src/pm2-events.ts 파일 변경 감지
- **무시 디렉토리**: node_modules, logs
- **인스턴스 변수**: INSTANCE_ID
- **PMX 모니터링**: 활성화

## 라이선스
MIT License

## 기여 방법
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request