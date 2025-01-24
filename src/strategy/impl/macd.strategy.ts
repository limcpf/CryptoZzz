import type { PoolClient } from "pg";
import { QUERIES } from "../../shared/const/query.const";
import type { iMACDResult } from "../../shared/interfaces/iMarketDataResult";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import type { iStrategy } from "../iStrategy";

/**
 * MACD (Moving Average Convergence Divergence) Strategy Implementation
 * 1시간 봉 기준 MACD 지표를 사용하여 단타 매매 신호 생성
 * - 골든크로스/데드크로스 감지
 * - 히스토그램 변화 분석
 * - 0라인 돌파 확인
 * - 추세 강도 측정
 */
export class MacdStrategy implements iStrategy {
	readonly weight: number;
	readonly client: PoolClient;
	readonly uuid: string;
	readonly symbol: string;
	readonly params: {
		lookbackHours: number;
		shortPeriod: number;
		longPeriod: number;
		signalPeriod: number;
	};

	constructor(
		client: PoolClient,
		uuid: string,
		symbol: string,
		params?: {
			lookbackHours: number;
			shortPeriod: number;
			longPeriod: number;
			signalPeriod: number;
		},
		weight = 0.6,
	) {
		this.client = client;
		this.weight = weight;
		this.uuid = uuid;
		this.symbol = symbol;
		this.params = params ?? {
			lookbackHours: 48,
			shortPeriod: 12,
			longPeriod: 26,
			signalPeriod: 9,
		};
	}

	async execute(): Promise<number> {
		const macdData = await this.getData();
		const score = this.calculateScore(macdData);
		await this.saveData(macdData, score);
		return score * this.weight;
	}

	private calculateScore(data: iMACDResult): number {
		const {
			current_macd,
			current_signal,
			prev_macd,
			prev_signal,
			histogram,
			prev_histogram,
		} = data;

		let score = 0;

		// 1. 크로스오버 신호 (최대 가중치: 0.4)
		const currentCross = current_macd - current_signal;
		const prevCross = prev_macd - prev_signal;
		if (Math.sign(currentCross) !== Math.sign(prevCross)) {
			const crossStrength =
				Math.abs(currentCross - prevCross) / Math.abs(current_signal);
			score += Math.sign(currentCross) * 0.4 * Math.min(1, crossStrength);
		}

		// 2. 히스토그램 변화 (최대 가중치: 0.3)
		const histogramChange = histogram - prev_histogram;
		const histogramStrength =
			Math.abs(histogramChange) / Math.abs(prev_histogram);
		score += Math.sign(histogramChange) * 0.3 * Math.min(1, histogramStrength);

		// 3. 0라인 돌파 (최대 가중치: 0.3)
		const zeroLineDistance = Math.abs(current_macd);
		const zeroLineCrossStrength = Math.min(
			1,
			zeroLineDistance / Math.abs(prev_macd),
		);
		if (Math.sign(current_macd) !== Math.sign(prev_macd)) {
			score += Math.sign(current_macd) * 0.3 * zeroLineCrossStrength;
		} else {
			// 0라인에 가까워지는 정도도 반영
			score += Math.sign(current_macd) * 0.15 * (1 - zeroLineCrossStrength);
		}

		// 추세 강도에 따른 스코어 조정
		const trendStrength = Math.abs(histogram) / Math.abs(current_signal);
		score *= 1 + Math.tanh(trendStrength);

		// 최종 스코어를 -1에서 1 사이로 정규화
		return Math.max(-1, Math.min(1, score));
	}

	private async getData(): Promise<iMACDResult> {
		const result = await this.client.query<iMACDResult>({
			name: `get_macd_${this.symbol}_${this.uuid}`,
			text: QUERIES.GET_MACD_ANALYSIS,
			values: [
				this.symbol, // $1: 심볼
				this.params.lookbackHours, // $2: 분석 기간 (시간)
				this.params.shortPeriod, // $3: 단기 EMA 기간
				this.params.longPeriod, // $4: 장기 EMA 기간
				this.params.signalPeriod, // $5: 시그널 라인 기간
			],
		});

		if (result.rows.length === 0) {
			throw new Error(String(getMsg("SIGNAL_MACD_ERROR")));
		}

		return result.rows[0];
	}

	private async saveData(data: iMACDResult, score: number): Promise<void> {
		const zeroCross =
			Math.sign(data.current_macd) !== Math.sign(data.prev_macd);
		const trendStrength =
			Math.abs(data.histogram) / Math.abs(data.current_signal);

		await this.client.query(QUERIES.INSERT_MACD_SIGNAL, [
			this.uuid,
			data.current_macd,
			data.current_signal,
			data.histogram,
			zeroCross,
			trendStrength,
			score,
		]);
	}
}
