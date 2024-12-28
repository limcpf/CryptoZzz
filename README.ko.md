# Money - 암호화폐 자동 거래 시스템

*다른 언어로 읽기: [English](README.md)*

## 소개
이 프로젝트는 암호화폐 시장 데이터를 수집하고 분석하여 자동으로 거래를 실행하는 시스템입니다. PM2를 사용하여 여러 마이크로서비스를 관리하며, PostgreSQL을 데이터베이스로 사용합니다.

## 주요 기능
- 실시간 시장 데이터 수집 (Upbit API 사용)
- 데이터 분석 및 거래 신호 생성
- 자동 거래 실행
- Discord를 통한 실시간 알림
- 계정 관리 및 모니터링

## 시스템 구성
- **candle-save**: 캔들 데이터 저장 서비스
  - 3초마다 실시간 시장 데이터 수집
  - 데이터베이스 자동 저장
  - 오류 발생 시 Discord 알림
- **analysis**: 데이터 분석 서비스
  - 수집된 데이터 실시간 분석
  - 매매 신호 생성
- **trading**: 자동 거래 실행 서비스
  - 분석 결과 기반 자동 매매 실행
  - 위험 관리 및 포지션 관리
- **account**: 계정 관리 서비스
  - 자산 현황 모니터링
  - 거래 내역 관리

## 기술 스택
- Runtime: Bun v1.1.42
- 프로세스 관리: PM2
- 데이터베이스: PostgreSQL
- 언어: TypeScript
- 크론 작업: node-cron
- 알림: Discord Webhook

## 설치 방법

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
필요한 환경 변수:
- DB_USER: 데이터베이스 사용자
- DB_HOST: 데이터베이스 호스트
- DB_NAME: 데이터베이스 이름
- DB_PASSWORD: 데이터베이스 비밀번호
- DB_PORT: 데이터베이스 포트
- DISCORD_WEBHOOK_URL: Discord 웹훅 URL
- MARKET_URL: Upbit API URL
- CRYPTO_CODE: 거래할 암호화폐 코드 (예: KRW-BTC)
- WEBHOOK_TYPE: 웹훅 타입 (DISCORD)
- LANGUAGE: 언어 설정 (ko/en)

## 데이터베이스 스키마
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

## PM2 서비스 구성
각 서비스는 다음과 같은 특성으로 실행됩니다:

- **candle-save**
  - 메모리 제한: 300MB
  - 매일 22시 자동 재시작
  - 최대 재시작 시도: 5회
  - 로그 파일: logs/candle-save-error.log, logs/candle-save-out.log

- **analysis**
  - 메모리 제한: 300MB
  - 자동 재시작 활성화
  - 백오프 재시작 지연: 100ms

- **trading**
  - 메모리 제한: 250MB
  - 최대 재시작 시도: 3회
  - 실시간 모니터링

- **account**
  - 메모리 제한: 200MB
  - 매일 0시 자동 재시작
  - 자산 현황 자동 업데이트

## 개발 모드 실행
```bash
bun run start:test
```

## 테스트 환경 설정
```bash
bun run start:test:re
```

## 캔들 데이터 수집 서비스만 실행
```bash
bun run start:candle
```

## 라이선스
MIT License

## 기여 방법
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
