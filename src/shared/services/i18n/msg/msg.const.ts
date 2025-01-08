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
}

export const getMsg = (language: string) => {
	switch (language) {
		case "en":
			return msgEn;
		default:
			return msgKo;
	}
};
