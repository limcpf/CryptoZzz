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
	ANALYZE_START: "🚀 Start ANALYZE service for automatic trading",
	DB_CONNECTION_ERROR: "⚠️ DB connection error",
	INIT_SETUP_ERROR: "⚠️ Error during initial setup",
	UNEXPECTED_ERROR: "⚠️ Unexpected error occurred",
	SERVICE_SHUTDOWN: "🛑 Service shutdown signal received",
	CANDLE_SAVE_START: "🚀 Start CANDLE-SAVE service for automatic trading",
	FETCH_CANDLE_DATA_ERROR: "⚠️ Failed to fetch candle chart data",
	CHECK_STATUS_ERROR: "⚠️ Error occurred while checking status",
	TRADING_SERVICE_START: "🚀 Start TRADING service for automatic trading",
	BUY_SIGNAL_ERROR: "⚠️ Insufficient KRW balance for buying",
	SELL_SIGNAL_ERROR: "⚠️ Insufficient BTC balance for selling",
	BUY_SIGNAL_SUCCESS: "✅ Buy order executed: ",
	SELL_SIGNAL_SUCCESS: "✅ Sell order executed: ",
} as const;

export default messages;
