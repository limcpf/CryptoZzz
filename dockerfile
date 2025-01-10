FROM oven/bun:slim

WORKDIR /app

# Install PM2 globally
RUN bun install -g pm2

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV TZ=Asia/Seoul

# Create log directory
RUN mkdir -p logs

# Default command
CMD ["bun", "run", "start"]