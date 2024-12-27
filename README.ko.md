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
- **analysis**: 데이터 분석 서비스
- **trading**: 자동 거래 실행 서비스
- **account**: 계정 관리 서비스

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
- DB_USER
- DB_HOST
- DB_NAME
- DB_PASSWORD
- DB_PORT
- DISCORD_WEBHOOK_URL

## 실행 방법

서비스 시작:
```bash
bun run start
```

서비스 중지:
```bash
bun run stop
```

서비스 재시작:
```bash
bun run restart
```

로그 확인:
```bash
bun run logs
```

## PM2 서비스 구성
각 서비스는 다음과 같은 특성으로 실행됩니다:

- **candle-save**
  - 메모리 제한: 300MB
  - 매일 22시 자동 재시작
  - 최대 재시작 시도: 5회

- **analysis**
  - 메모리 제한: 300MB
  - 자동 재시작 활성화

- **trading**
  - 메모리 제한: 250MB
  - 최대 재시작 시도: 3회

- **account**
  - 메모리 제한: 200MB
  - 매일 0시 자동 재시작

## 라이선스
MIT License

## 기여 방법
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
```
