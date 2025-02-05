import type { PoolClient } from "pg";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";
import {
	GET_MA_SCORE,
	INSERT_MA_SIGNAL,
} from "../../shared/indicators/ma/ma.queries";
import type { iMAResult } from "../../shared/indicators/ma/ma.types";
import i18n from "../../shared/services/i18n";

/**
 * MA (Moving Average) Strategy Implementation
 * Analyzes market data using MA indicators to generate trading signals with weighted scoring
 * - Calculates crossover signals between short-term and long-term moving averages
 * - Applies hyperbolic tangent function for base signal normalization
 * - Incorporates rate of change momentum for trend confirmation
 * - Uses configurable strategy weight for portfolio balance
 * - Implements database persistence for signal tracking
 *
 * MA (이동평균) 전략 구현
 * MA 지표를 사용하여 가중치가 적용된 거래 신호를 생성
 * - 단기 및 장기 이동평균의 크로스오버 신호 계산
 * - 하이퍼볼릭 탄젠트 함수를 사용하여 기본 신호 정규화
 * - 추세 확인을 위한 변화율 모멘텀 반영
 * - 포트폴리오 균형을 위한 전략 가중치 적용
 * - 신호 추적을 위한 데이터베이스 저장 구현
 *
 * @param client - PostgreSQL 데이터베이스 연결
 * @param uuid - 전략 실행 식별자
 * @param symbol - 거래 심볼
 * @param weight - 전략 가중치 (기본값: 0.8)
 */
export class MaStrategy extends CommonStrategy {
	/**
	 * MA calculation parameters
	 * MA 계산 파라미터
	 * @property {number} shortPeriod - Short-term MA period (단기 MA 기간)
	 * @property {number} longPeriod - Long-term MA period (장기 MA 기간)
	 */
	readonly params: {
		shortPeriod: number;
		longPeriod: number;
	};

	/**
	 * Creates a new MA strategy instance
	 * - Initializes database connection and strategy parameters
	 * - Sets default values for MA periods if not provided
	 * - Configures strategy weight for portfolio balance
	 *
	 * MA 전략 인스턴스 생성
	 * - 데이터베이스 연결 및 전략 파라미터 초기화
	 * - MA 기간이 제공되지 않은 경우 기본값 설정
	 * - 포트폴리오 균형을 위한 전략 가중치 구성
	 *
	 * @param {PoolClient} client - PostgreSQL database connection (PostgreSQL 데이터베이스 연결)
	 * @param {string} uuid - Unique strategy execution identifier (전략 실행 고유 식별자)
	 * @param {string} symbol - Trading pair symbol (거래 쌍 심볼)
	 * @param {Object} [params] - MA calculation parameters (MA 계산 파라미터)
	 *   @param {number} [params.shortPeriod=5] - Short-term MA period (단기 MA 기간)
	 *   @param {number} [params.longPeriod=20] - Long-term MA period (장기 MA 기간)
	 * @param {number} [weight=0.9] - Strategy weight for portfolio balance (포트폴리오 균형을 위한 전략 가중치)
	 */
	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: {
			shortPeriod: number;
			longPeriod: number;
		},
		weight = 0.9,
	) {
		super(client, uuid, symbol, weight);
		this.params = params ?? {
			shortPeriod: 5,
			longPeriod: 20,
		};
	}

	async execute(): Promise<number> {
		return super.execute();
	}

	/**
	 * Calculates the MA strategy signal score
	 * - Validates MA input values
	 * - Computes MA crossover ratio for base signal
	 * - Applies hyperbolic tangent for signal normalization
	 * - Incorporates momentum using rate of change
	 * - Clamps final score between -1 and 1
	 *
	 * MA 전략 신호 점수 계산
	 * - MA 입력값 유효성 검증
	 * - 기본 신호를 위한 MA 크로스오버 비율 계산
	 * - 신호 정규화를 위한 쌍곡선 탄젠트 적용
	 * - 변화율을 이용한 모멘텀 반영
	 * - 최종 점수를 -1에서 1 사이로 제한
	 *
	 * @param {iMAResult} data - MA calculation results containing:
	 *   - short_ma: Short-term moving average (단기 이동평균)
	 *   - long_ma: Long-term moving average (장기 이동평균)
	 *   - prev_short_ma: Previous short-term MA (이전 단기 이동평균)
	 * @returns {Promise<number>} Normalized score between -1 and 1 (정규화된 점수, -1에서 1 사이)
	 */
	protected calculateScore(data: iMAResult): number {
		const { short_ma, long_ma, prev_short_ma } = data;
		// 유효하지 않은 MA 값 필터링
		if (short_ma <= 0 || long_ma <= 0) {
			return 0;
		}

		const maRatio = (short_ma - long_ma) / long_ma;

		// tanh 특성상 자체 클램핑(-1~1) 적용되지만 추가 보정 필요
		const baseScore = Math.tanh(maRatio * 100);
		const rateOfChange =
			prev_short_ma > 0 ? (short_ma - prev_short_ma) / prev_short_ma : 0;

		// 최종 점수 클램핑 추가
		const result = Math.max(
			-1,
			Math.min(1, Number((baseScore + 0.3 * rateOfChange).toFixed(2))),
		);
		return result;
	}

	/**
	 * Retrieves MA indicator data from the database
	 * - Executes MA calculation query with symbol and period parameters
	 * - Validates query results and data integrity
	 * - Throws errors for missing or invalid data
	 *
	 * 데이터베이스에서 MA 지표 데이터 조회
	 * - 심볼과 기간 파라미터로 MA 계산 쿼리 실행
	 * - 쿼리 결과 및 데이터 무결성 검증
	 * - 데이터 누락 또는 유효하지 않은 경우 오류 발생
	 *
	 * @throws {Error} MA_DATA_NOT_FOUND - When no data is found (데이터가 없는 경우)
	 * @throws {Error} MA_INVALID_DATA - When MA values are invalid (MA 값이 유효하지 않은 경우)
	 * @returns {Promise<iMAResult>} MA calculation results containing:
	 *   - short_ma: Short-term moving average (단기 이동평균)
	 *   - long_ma: Long-term moving average (장기 이동평균)
	 *   - prev_short_ma: Previous short-term MA (이전 단기 이동평균)
	 */
	protected async getData(): Promise<iMAResult> {
		const result = await this.client.query<iMAResult>({
			name: `get_ma_${this.symbol}_${this.uuid}`,
			text: GET_MA_SCORE,
			values: [this.symbol, this.params.shortPeriod, this.params.longPeriod],
		});

		if (result.rows.length === 0) {
			throw new Error(i18n.getMessage("MA_DATA_NOT_FOUND"));
		}

		const data = result.rows[0];
		// 데이터 유효성 검사 추가
		if (data.short_ma <= 0 || data.long_ma <= 0) {
			throw new Error(i18n.getMessage("MA_INVALID_DATA"));
		}

		return data;
	}

	/**
	 * Saves MA strategy signal data to the database
	 * - Stores signal ID, MA values, and calculated score
	 * - Used for historical analysis and strategy performance tracking
	 *
	 * MA 전략 신호 데이터를 데이터베이스에 저장
	 * - 신호 ID, MA 값들, 계산된 점수를 저장
	 * - 과거 분석 및 전략 성과 추적에 사용
	 *
	 * @param {iMAResult} data - MA calculation results containing:
	 *   - short_ma: Short-term moving average (단기 이동평균)
	 *   - long_ma: Long-term moving average (장기 이동평균)
	 *   - prev_short_ma: Previous short-term MA (이전 단기 이동평균)
	 * @param {number} score - Normalized strategy score between -1 and 1 (정규화된 전략 점수, -1에서 1 사이)
	 * @returns {Promise<void>} No return value (반환값 없음)
	 */
	protected async saveData(data: iMAResult, score: number): Promise<void> {
		await this.client.query(INSERT_MA_SIGNAL, [
			this.uuid,
			data.short_ma,
			data.long_ma,
			data.prev_short_ma,
			score,
		]);
	}
}
