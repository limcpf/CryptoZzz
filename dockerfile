# 알파인 기반 경량 이미지 사용
FROM oven/bun:1.1.42-alpine

WORKDIR /app

# PM2 전역 설치
RUN bun install -g @pm2/io pm2

# 종속성 관리 (lockfile 버전 고정)
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# 애플리케이션 코드 복사
COPY . .

# 로그 디렉토리 생성
RUN mkdir -p logs logs/test

# 환경 변수 설정
ENV TZ=Asia/Seoul
ENV PM2_RUNTIME_NODE_PATH=bun

# 실행 명령어
CMD ["bun", "run", "start"]