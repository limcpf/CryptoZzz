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
	DB_CONNECTION_ERROR: "⚠️ DB 연결 에러 발생",
	INIT_SETUP_ERROR: "⚠️ 초기 설정 중 에러 발생",
	UNEXPECTED_ERROR: "⚠️ 예상치 못한 에러 발생",
	SERVICE_SHUTDOWN: "🛑 서비스 종료 신호 수신",
} as const;

export default messages;
