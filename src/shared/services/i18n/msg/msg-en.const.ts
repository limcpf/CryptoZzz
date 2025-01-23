import type { MSG } from "./msg.const";

const messages: MSG = {
	CONFIG_ERROR: "⚠️ Failed to load configuration file: ",
	SERVER_OFF_MESSAGE: "🔌 Server is off",
	CHECK_MESSAGE: "📊 Currently collecting candle chart data normally.",
	CANDLE_SAVE_API_ERROR: "⚠️ Candle chart data collection failed",
	CANDLE_SAVE_DB_ERROR: "⚠️ Candle chart data storage failed",
	CANDLE_SAVE_NORMAL_COLLECTING: "✅ Normal collecting",
	LOCK_ACQUIRE_ERROR: "⚠️ Failed to acquire lock",
	ANALYZE_API_ERROR: "⚠️ Failed to call analyze API",
	INVALID_STRATEGY_ERROR: "⚠️ Invalid strategy name: ",
	ORDER_API_ERROR: "⚠️ Failed to call order API",
	RECONNECT_ATTEMPTS: "🔄 DB reconnection attempt ",
	RECONNECT_ERROR: "⚠️ DB reconnection failed",
	DB_CONNECTION_ERROR: "⚠️ DB connection error",
	INIT_SETUP_ERROR: "⚠️ Error during initial setup",
	UNEXPECTED_ERROR: "⚠️ Unexpected error occurred",
	SERVICE_SHUTDOWN: "🛑 Service shutdown signal received",
	FETCH_CANDLE_DATA_ERROR: "⚠️ Failed to fetch candle chart data",
	CHECK_STATUS_ERROR: "⚠️ Error occurred while checking status",
	BUY_SIGNAL_ERROR: "⚠️ Insufficient KRW balance for buying",
	SELL_SIGNAL_ERROR: "⚠️ Insufficient BTC balance for selling",
	BUY_SIGNAL_SUCCESS: "✅ Buy order executed: ",
	SELL_SIGNAL_SUCCESS: "✅ Sell order executed: ",
	PAYLOAD_ERROR: "⚠️ Payload is undefined",
	SIGNAL_LOG_ERROR: "⚠️ Failed to create signal log",
	SIGNAL_RSI_ERROR: "⚠️ Failed to execute RSI strategy",
	SIGNAL_MA_ERROR: "⚠️ Failed to execute MA strategy",
	SIGNAL_VOLUME_ERROR: "⚠️ Failed to execute volume strategy",
	NOT_FOUND_STRATEGY: "⚠️ No strategy found",
	SIGNAL_ACCOUNT_ERROR: "⚠️ Failed to find account information",
	ACCOUNT_STATUS_ERROR:
		"⚠️ Error occurred while checking account status for buy/sell decision",
	CANDLE_DATA_NOT_FOUND: "⚠️ Failed to find candle chart data",
	SIGNAL_ERROR: "⚠️ Error occurred while executing buy/sell signal",
	EXECUTE_ORDER_ERROR: "⚠️ Error occurred while executing order",
	MANAGER_START: "🚀 MANAGER started. Starting instances sequentially.",
	MANAGER_START_ERROR: "⚠️ Error occurred while starting MANAGER service",
	NOTIFICATION_ERROR: "⚠️ Error occurred while processing notification",
	ALL_INSTANCES_STARTED: "🚀 All instances started",
	AGGREGATE_DAILY_METRICS:
		"It's midnight. Starting to delete data older than 48 hours and aggregate daily data.",
	AGGREGATE_DAILY_METRICS_ERROR:
		"⚠️ Error occurred during daily data aggregation",
	AGGREGATE_DAILY_METRICS_SUCCESS:
		"✅ Daily data aggregation completed, analysis will resume from 00:15",
	TRADING_START: "🚀 Start TRADING service for automatic trading",
	ANALYZE_START: "🚀 Start ANALYZE service for automatic trading",
	CANDLE_COLLECTING_START:
		"🚀 Start CANDLE-COLLECTING service for automatic trading",
	SIGNAL_RSI_ERROR_NO_DATA: "⚠️ No RSI data available",
	SIGNAL_RSI_ERROR_INVALID: "⚠️ Invalid RSI data",
	VOLUME_DATA_NOT_FOUND: "⚠️ No volume data available",
	VOLUME_DATA_ERROR: "⚠️ Error occurred while fetching volume data",
} as const;

export default messages;
