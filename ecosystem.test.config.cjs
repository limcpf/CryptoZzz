module.exports = {
	apps: [
		{
			name: "candle-save-test",
			script: "./src/services/candle-save/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
				CRYPTO_CODE: "KRW-BTC",
				TIME: "05",
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 3,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/candle-save-error.log",
			out_file: "logs/test/candle-save-out.log",
		},
		{
			name: "candle-save-test2",
			script: "./src/services/candle-save/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
				CRYPTO_CODE: "KRW-ETH",
				TIME: "30",
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 1,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/candle-save2-error.log",
			out_file: "logs/test/candle-save2-out.log",
		},
		{
			name: "candle-save-test3",
			script: "./src/services/candle-save/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
				CRYPTO_CODE: "KRW-XRP",
				TIME: "50",
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 1,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/candle-save3-error.log",
			out_file: "logs/test/candle-save3-out.log",
		},
		{
			name: "analysis-test",
			script: "./src/services/analysis/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
			},
			exp_backoff_restart_delay: 100,
			group: "analysis",
			max_restarts: 1,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/analysis-error.log",
			out_file: "logs/test/analysis-out.log",
		},
		{
			name: "trading-test",
			script: "./src/services/trading/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 3,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/trading-error.log",
			out_file: "logs/test/trading-out.log",
		},
		{
			name: "manager-test",
			script: "./src/services/manager/index.ts",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "300M",
			env: {
				NODE_ENV: "development",
				TZ: "Asia/Seoul",
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 3,
			autorestart: false,
			merge_logs: true,
			error_file: "logs/test/manager-error.log",
			out_file: "logs/test/manager-out.log",
		},
	],
	watch: ["./src/pm2-events.ts"],
	ignore_watch: ["node_modules", "logs"],
	instance_var: "INSTANCE_ID",
	pmx: true,
};
