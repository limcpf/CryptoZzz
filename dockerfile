FROM oven/bun:1.1.42

WORKDIR /app

# Install PM2 globally with bun
RUN bun install -g @pm2/io pm2

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Create log directory
RUN mkdir -p logs logs/test

# Set environment variables
ENV TZ=Asia/Seoul
ENV PM2_RUNTIME_NODE_PATH=bun

# Run PM2 in no-daemon mode with bun
CMD ["pm2-runtime", "--interpreter", "bun", "ecosystem.config.cjs"]