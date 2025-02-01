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
	DB_CONNECTION_ERROR: "⚠️ DB 연결 에러 발생",
	INIT_SETUP_ERROR: "⚠️ 초기 설정 중 에러 발생",
	UNEXPECTED_ERROR: "⚠️ 예상치 못한 에러 발생",
	SERVICE_SHUTDOWN: "🛑 서비스 종료 신호 수신",
	FETCH_CANDLE_DATA_ERROR: "⚠️ 캔들 차트 데이터 수집 실패",
	CHECK_STATUS_ERROR: "⚠️ 상태 조회 중 오류 발생",
	BUY_SIGNAL_ERROR: "⚠️ 매수 신호 생성 중 오류가 발생했습니다.",
	SELL_SIGNAL_ERROR: "⚠️ 매도 신호 생성 중 오류가 발생했습니다.",
	BUY_SIGNAL_SUCCESS: "✅ 매수 주문 실행: ",
	SELL_SIGNAL_SUCCESS: "✅ 매도 주문 실행: ",
	PAYLOAD_ERROR: "⚠️ 페이로드가 정의되지 않았습니다.",
	SIGNAL_LOG_ERROR: "⚠️ 신호 로그 생성 실패",
	SIGNAL_RSI_ERROR: "⚠️ RSI 전략 실행 실패",
	SIGNAL_MA_ERROR: "⚠️ MA 전략 실행 실패",
	SIGNAL_VOLUME_ERROR: "⚠️ 거래량 전략 실행 실패",
	NOT_FOUND_STRATEGY: "⚠️ 전략이 존재하지 않습니다.",
	SIGNAL_ACCOUNT_ERROR: "⚠️ 계좌 정보를 찾을 수 없습니다.",
	ACCOUNT_STATUS_ERROR: "⚠️ 매수/매도 판단을 위한 계좌 상태 확인 중 오류 발생",
	CANDLE_DATA_NOT_FOUND: "⚠️ 캔들 차트 데이터를 찾을 수 없습니다.",
	SIGNAL_ERROR: "⚠️ 매수/매도 판단 중 오류 발생",
	EXECUTE_ORDER_ERROR: "⚠️ 주문 실행 중 오류 발생",
	MANAGER_START:
		"🚀 MANAGER가 시작되었습니다. 순차적으로 인스턴스들을 시작합니다.",
	MANAGER_START_ERROR: "⚠️ MANAGER 서비스 시작 중 오류 발생",
	NOTIFICATION_ERROR: "⚠️ 알림 처리 중 오류 발생",
	ALL_INSTANCES_STARTED: "🚀 모든 인스턴스가 시작되었습니다.",
	AGGREGATE_DAILY_METRICS:
		"00시가 되었습니다. 48시간이 지난 데이터 삭제 및 일일 데이터 집계를 시작합니다.",
	AGGREGATE_DAILY_METRICS_ERROR: "⚠️ 일일 데이터 집계 중 오류 발생",
	AGGREGATE_DAILY_METRICS_SUCCESS:
		"✅ 일일 데이터 집계 완료, 00시 15분부터 분석을 재개합니다.",
	TRADING_START: "🚀 TRADING 서비스가 시작되었습니다.",
	ANALYZE_START: "🚀 ANALYZE 서비스가 시작되었습니다.",
	CANDLE_COLLECTING_START: "🚀 CANDLE-COLLECTING 서비스가 시작되었습니다.",
	SIGNAL_RSI_ERROR_NO_DATA: "⚠️ RSI 데이터가 없습니다.",
	SIGNAL_RSI_ERROR_INVALID: "⚠️ RSI 데이터가 유효하지 않습니다.",
	VOLUME_DATA_NOT_FOUND: "⚠️ 거래량 데이터가 없습니다.",
	VOLUME_DATA_ERROR: "⚠️ 거래량 데이터 조회 중 오류 발생",
	COIN_NOT_FOUND: "⚠️ 코인 정보를 찾을 수 없습니다",
	MIN_ORDER_AMOUNT_ERROR: "⚠️ 주문 금액이 최소 주문 금액(10,000원) 미만입니다",
	TRADING_EXCUTE_ORDER_ERROR: "⚠️ 거래 주문 실행 중 오류가 발생했습니다",
	GET_CURRENT_POSITION_ERROR: "⚠️ 현재 포지션 정보 조회에 실패했습니다",
	CALCULATE_THRESHOLD_ERROR: "⚠️ 동적 임계값 계산에 실패했습니다",
	BUY_ORDER_DEV_ERROR: "⚠️ 개발 환경에서 매수 주문 실행에 실패했습니다",
	BUY_ORDER_ERROR: "⚠️ 매수 주문 실행에 실패했습니다",
	SELL_ORDER_ERROR: "⚠️ 매도 주문 실행에 실패했습니다",
	SELL_ORDER_DEV_ERROR: "⚠️ 개발 환경에서 매도 주문 실행에 실패했습니다",
	STOP_LOSS_TRIGGERED: "⚠️ 손절매가 발동되어 매도 주문을 실행합니다",
	REGULAR_SELL: "📊 일반 매도 신호가 발생하여 매도 주문을 실행합니다",
	AVG_BUY_PRICE_NOT_FOUND: "⚠️ 평균 매수가를 찾을 수 없습니다",
	PROFIT_TAKE_TRIGGERED: "✅ 목표 수익률에 도달하여 매도 주문을 실행합니다",
	TABLE_NOT_FOUND: "⚠️ 필요한 테이블을 찾을 수 없습니다: ",
	MA_DATA_NOT_FOUND: "⚠️ 이동평균 데이터를 찾을 수 없습니다",
	DELETE_48_HOURS_AGO_DATA: "48시간 이전 데이터 삭제 중",
	DELETE_48_HOURS_AGO_DATA_ERROR:
		"⚠️ 48시간 이전 데이터 삭제 중 오류가 발생했습니다",
	MA_INVALID_DATA: "⚠️ 이동평균 데이터가 유효하지 않습니다",
} as const;

export default messages;
