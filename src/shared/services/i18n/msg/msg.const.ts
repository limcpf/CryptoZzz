import msgEn from "./msg-en.const";
import msgKo from "./msg-ko.const";

export interface MSG {
	CONFIG_ERROR: string;
	SERVER_OFF_MESSAGE: string;
	CHECK_MESSAGE: string;
	CANDLE_SAVE_API_ERROR: string;
	CANDLE_SAVE_DB_ERROR: string;
	CANDLE_SAVE_NORMAL_COLLECTING: string;
	LOCK_ACQUIRE_ERROR: string;
	ANALYZE_API_ERROR: string;
	INVALID_STRATEGY_ERROR: string;
	ORDER_API_ERROR: string;
	RECONNECT_ATTEMPTS: string;
	RECONNECT_ERROR: string;
	DB_CONNECTION_ERROR: string;
	INIT_SETUP_ERROR: string;
	UNEXPECTED_ERROR: string;
	SERVICE_SHUTDOWN: string;
	FETCH_CANDLE_DATA_ERROR: string;
	CHECK_STATUS_ERROR: string;
	BUY_SIGNAL_ERROR: string;
	SELL_SIGNAL_ERROR: string;
	BUY_SIGNAL_SUCCESS: string;
	SELL_SIGNAL_SUCCESS: string;
	PAYLOAD_ERROR: string;
	SIGNAL_LOG_ERROR: string;
	SIGNAL_RSI_ERROR: string;
	SIGNAL_MA_ERROR: string;
	SIGNAL_VOLUME_ERROR: string;
	NOT_FOUND_STRATEGY: string;
	SIGNAL_ACCOUNT_ERROR: string;
	ACCOUNT_STATUS_ERROR: string;
	CANDLE_DATA_NOT_FOUND: string;
	SIGNAL_ERROR: string;
	EXECUTE_ORDER_ERROR: string;
	MANAGER_START: string;
	MANAGER_START_ERROR: string;
	NOTIFICATION_ERROR: string;
	ALL_INSTANCES_STARTED: string;
	AGGREGATE_DAILY_METRICS: string;
	AGGREGATE_DAILY_METRICS_ERROR: string;
	AGGREGATE_DAILY_METRICS_SUCCESS: string;
	TRADING_START: string;
	ANALYZE_START: string;
	CANDLE_COLLECTING_START: string;
	SIGNAL_RSI_ERROR_NO_DATA: string;
	SIGNAL_RSI_ERROR_INVALID: string;
	VOLUME_DATA_NOT_FOUND: string;
	VOLUME_DATA_ERROR: string;
	COIN_NOT_FOUND: string;
	MIN_ORDER_AMOUNT_ERROR: string;
	TRADING_EXCUTE_ORDER_ERROR: string;
	GET_CURRENT_POSITION_ERROR: string;
	CALCULATE_THRESHOLD_ERROR: string;
	BUY_ORDER_DEV_ERROR: string;
	BUY_ORDER_ERROR: string;
	SELL_ORDER_ERROR: string;
	SELL_ORDER_DEV_ERROR: string;
	STOP_LOSS_TRIGGERED: string;
	REGULAR_SELL: string;
	AVG_BUY_PRICE_NOT_FOUND: string;
	PROFIT_TAKE_TRIGGERED: string;
	TABLE_NOT_FOUND: string;
	MA_DATA_NOT_FOUND: string;
	DELETE_48_HOURS_AGO_DATA_ERROR: string;
	DELETE_48_HOURS_AGO_DATA: string;
	MA_INVALID_DATA: string;
	MACD_DATA_ERROR: string;
	ANALYZE_START_ERROR: string;
	TRADING_SERVICE_START_ERROR: string;
	CANDLE_SAVE_START_ERROR: string;
	BOLLINGER_DATA_ERROR: string;
	SIGNAL_MACD_ERROR: string;
	STOCHASTIC_DATA_ERROR: string;
	STRATEGY_ERROR: string;
	MACD_DATA_NOT_FOUND: string;
	INSERT_TRADE_ERROR: string;
	ORDER_UPDATE_ERROR: string;
	UUID_LENGTH_ERROR: string;
	UUID_INVALID_ERROR: string;
	UPDATE_ORDER_FAILED: string;
	UPDATE_ORDER_QUERY_ERROR: string;
}

export const getMsg = (language: string) => {
	switch (language) {
		case "en":
			return msgEn;
		default:
			return msgKo;
	}
};
