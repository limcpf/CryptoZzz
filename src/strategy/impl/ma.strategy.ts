import type { PoolClient } from "pg";
import { CommonStrategy } from "../../shared/indicators/common/common.strategy";
import {
	clampScore,
	normalizeWithTanh,
} from "../../shared/indicators/common/common.utils";
import { MARepository } from "../../shared/indicators/ma/ma.repository";
import type { iMAResult } from "../../shared/indicators/ma/ma.types";

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
	private readonly repository: MARepository;

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
		this.repository = new MARepository(client);
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
	 * - Computes MA crossover ratio for base signal
	 * - Normalizes signal using hyperbolic tangent
	 * - Incorporates momentum using rate of change
	 * - Returns final score between -1 and 1
	 *
	 * MA 전략 신호 점수 계산
	 * - MA 크로스오버 비율 계산
	 * - 쌍곡선 탄젠트를 사용한 신호 정규화
	 * - 변화율을 이용한 모멘텀 반영
	 * - -1에서 1 사이의 최종 점수 반환
	 *
	 * @param {iMAResult} data - MA calculation results containing:
	 *   - short_ma: Short-term moving average (단기 이동평균)
	 *   - long_ma: Long-term moving average (장기 이동평균)
	 *   - prev_short_ma: Previous short-term MA (이전 단기 이동평균)
	 * @returns {number} Normalized score between -1 and 1 (정규화된 점수)
	 */
	protected calculateScore(data: iMAResult): number {
		const { short_ma, long_ma, prev_short_ma } = data;

		const maRatio = (short_ma - long_ma) / long_ma;

		const baseSignal = normalizeWithTanh(maRatio, 100);

		const momentum =
			prev_short_ma > 0 ? (short_ma - prev_short_ma) / prev_short_ma : 0;

		return clampScore(baseSignal + 0.3 * momentum);
	}

	/**
	 * Implements BaseStrategy's getData method for MA strategy
	 * - Uses MARepository to fetch MA indicator data
	 *
	 * MA 전략을 위한 BaseStrategy의 getData 메서드 구현
	 * - MARepository를 사용하여 MA 지표 데이터 조회
	 *
	 * @inheritdoc
	 */
	protected async getData(): Promise<iMAResult> {
		return this.repository.getMAScore(
			this.symbol,
			this.params.shortPeriod,
			this.params.longPeriod,
		);
	}

	/**
	 * Implements BaseStrategy's saveData method for MA strategy
	 * - Delegates signal data persistence to MARepository
	 *
	 * MA 전략을 위한 BaseStrategy의 saveData 메서드 구현
	 * - MARepository에 신호 데이터 저장을 위임
	 *
	 * @inheritdoc
	 */
	protected async saveData(data: iMAResult, score: number): Promise<void> {
		await this.repository.saveMASignal(this.uuid, data, score);
	}
}
