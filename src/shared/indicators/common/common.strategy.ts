import type { PoolClient } from "pg";
import type { MSG } from "../../services/i18n/msg/msg.const";
import { applyWeight, handleStrategyError } from "./common.utils";

/**
 * BaseStrategy 추상 클래스
 *
 * 이 클래스는 전략 패턴을 구현하기 위한 템플릿을 제공합니다.
 * 데이터 조회(getData), 점수 계산(calculateScore), 데이터 저장(saveData)의 추상 메서드를 정의하며,
 * execute 메서드에서 이 메서드들을 순차적으로 실행하여 전략의 계산 프로세스를 완성합니다.
 *
 * The BaseStrategy abstract class provides a template for implementing strategy patterns.
 * It enforces the implementation of methods to retrieve data, calculate a score, and persist the results.
 *
 * @abstract
 */
export abstract class BaseStrategy {
	/**
	 * 데이터 조회 메서드
	 *
	 * 전략 계산에 필요한 데이터를 반환해야 합니다.
	 *
	 * @abstract
	 * @returns {Promise<unknown>} 전략 계산에 필요한 데이터 객체
	 */
	protected abstract getData(): Promise<unknown>;

	/**
	 * 점수 계산 메서드
	 *
	 * 제공된 데이터를 기반으로 원시 점수를 계산합니다.
	 *
	 * @abstract
	 * @param {unknown} data - 점수 계산에 사용될 데이터
	 * @returns {number} 계산된 원시 점수
	 */
	protected abstract calculateScore(data: unknown): number;

	/**
	 * 데이터 저장 메서드
	 *
	 * 계산된 점수와 함께 데이터를 저장합니다.
	 *
	 * @abstract
	 * @param {unknown} data - 점수 계산에 사용된 데이터
	 * @param {number} score - 계산된 점수
	 * @returns {Promise<void>} 저장 작업 완료에 대한 Promise
	 */
	protected abstract saveData(data: unknown, score: number): Promise<void>;

	/**
	 * BaseStrategy 생성자
	 *
	 * @param {PoolClient} client - PostgreSQL 데이터베이스 클라이언트 연결
	 * @param {string} uuid - 전략 인스턴스의 고유 식별자
	 * @param {string} symbol - 전략에 관련된 거래 심볼
	 * @param {number} weight - 전략 가중치 (예: 위험 노출 조정을 위한 값)
	 * @param {keyof MSG} [defaultError="STRATEGY_ERROR"] - 전략 오류 처리 시 기본 에러 코드 키
	 */
	constructor(
		protected client: PoolClient,
		protected uuid: string,
		protected symbol: string,
		protected weight: number,
		protected defaultError: keyof MSG = "STRATEGY_ERROR",
	) {}

	/**
	 * 전략 프로세스를 실행합니다.
	 *
	 * 순차적으로 아래의 단계를 진행합니다:
	 * - getData 메서드를 통해 데이터를 조회합니다.
	 * - calculateScore 메서드를 통해 원시 점수를 계산합니다.
	 * - 가중치(weight)를 적용하여 점수를 보정합니다.
	 * - saveData 메서드를 통해 결과를 데이터베이스에 저장합니다.
	 * - 실행 과정 중 오류가 발생할 경우, handleStrategyError 함수를 통해 오류를 처리합니다.
	 *
	 * Executes the strategy process as follows:
	 * - Retrieves data using the getData method.
	 * - Computes a raw score using the calculateScore method.
	 * - Applies a weight to the calculated score.
	 * - Saves the computed results using the saveData method.
	 * - Handles errors appropriately using handleStrategyError.
	 *
	 * @returns {Promise<number>} 최종 보정된 점수 (오류 발생 시 0 반환)
	 */
	async execute(): Promise<number> {
		let course = "this.getData";
		let score = 0;
		try {
			const data = await this.getData();

			course = "calculateScore";
			score = this.calculateScore(data);

			course = "applyWeight";
			score = applyWeight(score, this.weight);

			course = "saveData";
			await this.saveData(data, score);

			return score;
		} catch (error) {
			// 각 전략에서 구체적인 테이블명이나 에러 코드가 다르므로 필요에 따라 오버라이드 가능
			handleStrategyError(
				this.client,
				error,
				course,
				"STRATEGY_SIGNAL",
				this.defaultError,
			);
			return 0;
		}
	}
}
