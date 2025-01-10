module.exports = {
	apps: [
		{
			name: "candle-save",
			script: "./src/services/candle-save/index.ts",
			instances: 1,
			interpreter: "bun",
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "150M",
			env: {
				NODE_ENV: "production",
				TZ: "Asia/Seoul",
				PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 3,
			autorestart: true,
			merge_logs: true,
			error_file: "logs/candle-save-error.log",
			out_file: "logs/candle-save-out.log",
		},
		{
			name: "analysis-test",
			script: "./src/services/analysis/index.ts",
			interpreter: "bun",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "200M",
			env: {
				NODE_ENV: "production",
				TZ: "Asia/Seoul",
				PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
			},
			exp_backoff_restart_delay: 100,
			group: "analysis",
			max_restarts: 3,
			autorestart: true,
			merge_logs: true,
			error_file: "logs/analysis-error.log",
			out_file: "logs/analysis-out.log",
		},
		{
			name: "trading-test",
			script: "./src/services/trading/index.ts",
			interpreter: "bun",
			instances: 1,
			exec_mode: "fork",
			watch: false,
			reload: false,
			max_memory_restart: "100M",
			env: {
				NODE_ENV: "production",
				TZ: "Asia/Seoul",
				PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
			},
			exp_backoff_restart_delay: 100,
			max_restarts: 3,
			autorestart: true,
			merge_logs: true,
			error_file: "logs/trading-error.log",
			out_file: "logs/trading-out.log",
		},
	],
	env: {
		PATH: `${process.env.HOME}/.bun/bin:${process.env.PATH}`, // Add "~/.bun/bin/bun" to PATH
	},
	interpreter: "bun",
	watch: ["./src/pm2-events.ts"],
	ignore_watch: ["node_modules", "logs"],
	instance_var: "INSTANCE_ID",
	pmx: true,
};
