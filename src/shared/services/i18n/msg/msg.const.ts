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
}

export const getMsg = (language: string) => {
	switch (language) {
		case "en":
			return msgEn;
		default:
			return msgKo;
	}
};
