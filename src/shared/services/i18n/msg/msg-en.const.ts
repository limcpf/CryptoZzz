import type { MSG } from "./msg.const";

const messages: MSG = {
	CONFIG_ERROR: "⚠️ Failed to load configuration file: ",
	SERVER_OFF_MESSAGE: "Server is off",
	CHECK_MESSAGE: "Currently collecting candle chart data normally.",
	CANDLE_SAVE_API_ERROR: "⚠️ Candle chart data collection failed",
	CANDLE_SAVE_DB_ERROR: "⚠️ Candle chart data storage failed",
	CANDLE_SAVE_NORMAL_COLLECTING: "Normal collecting",
	LOCK_ACQUIRE_ERROR: "⚠️ Failed to acquire lock",
	ANALYZE_API_ERROR: "⚠️ Failed to call analyze API",
	INVALID_STRATEGY_ERROR: "⚠️ Invalid strategy name: ",
	ORDER_API_ERROR: "⚠️ Failed to call order API",
} as const;

export default messages;
