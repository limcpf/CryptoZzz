FROM oven/bun:1.1.42

WORKDIR /app

# Install PM2 globally
RUN bun install -g pm2

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

# Run PM2 in no-daemon mode
CMD ["pm2-runtime", "ecosystem.config.cjs"]