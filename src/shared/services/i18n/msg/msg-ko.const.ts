import type { MSG } from "./msg.const";

const messages: MSG = {
	CONFIG_ERROR: "⚠️ 설정 파일 로드 실패 : ",
	SERVER_OFF_MESSAGE: "서버가 종료되었습니다.",
	CHECK_MESSAGE: "현재 캔들 차트 데이터 정상 수집중입니다.",
	CANDLE_SAVE_API_ERROR: "⚠️ 캔들 차트 데이터 수집 실패",
	CANDLE_SAVE_DB_ERROR: "⚠️ 캔들 차트 데이터 저장 실패",
	CANDLE_SAVE_NORMAL_COLLECTING: "정상 수집중",
	LOCK_ACQUIRE_ERROR: "⚠️ 락 획득 실패",
	ANALYZE_API_ERROR: "⚠️ 분석 API 호출 실패",
	INVALID_STRATEGY_ERROR: "⚠️ 유효하지 않은 전략 이름: ",
	ORDER_API_ERROR: "⚠️ 주문 API 호출 실패",
} as const;

export default messages;
