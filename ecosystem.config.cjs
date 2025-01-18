const commonConfig = {
	interpreter: "bun",
	instances: 1,
	exec_mode: "fork",
	watch: false,
	reload: false,
	exp_backoff_restart_delay: 100,
	max_restarts: 3,
	autorestart: true,
	merge_logs: true,
	env: {
		NODE_ENV: "production",
		TZ: "Asia/Seoul",
		PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
	},
};

const candleSaveConfig = {
	...commonConfig,
	script: "./src/services/candle-save/index.ts",
	max_memory_restart: "200M",
};

module.exports = {
	apps: [
		{
			...candleSaveConfig,
			name: "candle-save-btc",
			env: {
				...candleSaveConfig.env,
				CRYPTO_CODE: "KRW-BTC",
				TIME: "05",
			},
			error_file: "logs/candle-save-btc-error.log",
			out_file: "logs/candle-save-btc-out.log",
		},
		{
			...candleSaveConfig,
			name: "candle-save-eth",
			env: {
				...candleSaveConfig.env,
				CRYPTO_CODE: "KRW-ETH",
				TIME: "30",
			},
			error_file: "logs/candle-save-eth-error.log",
			out_file: "logs/candle-save-eth-out.log",
		},
		{
			...candleSaveConfig,
			name: "candle-save-xrp",
			env: {
				...candleSaveConfig.env,
				CRYPTO_CODE: "KRW-XRP",
				TIME: "50",
			},
			error_file: "logs/candle-save-error.log",
			out_file: "logs/candle-save-out.log",
		},
		{
			...commonConfig,
			name: "analysis-test",
			script: "./src/services/analysis/index.ts",
			max_memory_restart: "300M",
			group: "analysis",
			error_file: "logs/analysis-error.log",
			out_file: "logs/analysis-out.log",
		},
		{
			...commonConfig,
			name: "trading-test",
			script: "./src/services/trading/index.ts",
			max_memory_restart: "200M",
			error_file: "logs/trading-error.log",
			out_file: "logs/trading-out.log",
		},
		{
			...commonConfig,
			name: "manager",
			script: "./src/services/manager/index.ts",
			max_memory_restart: "150M",
			error_file: "logs/manager-error.log",
			out_file: "logs/manager-out.log",
		},
	],
	env: {
		PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`,
	},
	interpreter: "bun",
	watch: ["./src/pm2-events.ts"],
	ignore_watch: ["node_modules", "logs"],
	instance_var: "INSTANCE_ID",
	pmx: true,
};
