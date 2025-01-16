import type { MSG } from "./msg.const";

const messages: MSG = {
	CONFIG_ERROR: "⚠️ 설정 파일 로드 실패 : ",
	SERVER_OFF_MESSAGE: "🔌 서버가 종료되었습니다.",
	CHECK_MESSAGE: "📊 현재 캔들 차트 데이터 정상 수집중입니다.",
	CANDLE_SAVE_API_ERROR: "⚠️ 캔들 차트 데이터 수집 실패",
	CANDLE_SAVE_DB_ERROR: "⚠️ 캔들 차트 데이터 저장 실패",
	CANDLE_SAVE_NORMAL_COLLECTING: "✅ 정상 수집중",
	LOCK_ACQUIRE_ERROR: "⚠️ 락 획득 실패",
	ANALYZE_API_ERROR: "⚠️ 분석 API 호출 실패",
	INVALID_STRATEGY_ERROR: "⚠️ 유효하지 않은 전략 이름: ",
	ORDER_API_ERROR: "⚠️ 주문 API 호출 실패",
	RECONNECT_ATTEMPTS: "🔄 DB 재연결 시도 ",
	RECONNECT_ERROR: "⚠️ DB 재연결 실패",
	ANALYZE_START: "🚀 자동매매 분석을 위한 ANALYZE 서비스를 시작합니다.",
	CANDLE_SAVE_START:
		"🚀 자동매매 캔들 저장을 위한 CANDLE-SAVE 서비스를 시작합니다.",
	DB_CONNECTION_ERROR: "⚠️ DB 연결 에러 발생",
	INIT_SETUP_ERROR: "⚠️ 초기 설정 중 에러 발생",
	UNEXPECTED_ERROR: "⚠️ 예상치 못한 에러 발생",
	SERVICE_SHUTDOWN: "🛑 서비스 종료 신호 수신",
	FETCH_CANDLE_DATA_ERROR: "⚠️ 캔들 차트 데이터 수집 실패",
	CHECK_STATUS_ERROR: "⚠️ 상태 조회 중 오류 발생",
	TRADING_SERVICE_START: "🚀 자동매매 주문을 위한 TRADING 서비스를 시작합니다.",
	BUY_SIGNAL_ERROR: "⚠️ 매수 가능한 KRW 잔액이 부족합니다.",
	SELL_SIGNAL_ERROR: "⚠️ 매도 가능한 BTC 잔액이 부족합니다.",
	BUY_SIGNAL_SUCCESS: "✅ 매수 주문 실행: ",
	SELL_SIGNAL_SUCCESS: "✅ 매도 주문 실행: ",
} as const;

export default messages;
