import type { PoolClient } from "pg";
import i18n from "../shared/services/i18n";
import type { iStrategy } from "./iStrategy";
import { MaStrategy } from "./impl/ma.strategy";
import { RsiStrategy } from "./impl/rsi.strategy";
import { VolumeStrategy } from "./impl/volume.strategy";

/**
 * Strategy Factory
 * Creates and returns instances of trading strategies based on the strategy name
 *
 * 전략 팩토리
 * 전략 이름에 따라 거래 전략 인스턴스를 생성하고 반환
 */
export class StrategyFactory {
	constructor(
		private client: PoolClient,
		private uuid: string,
		private symbol: string,
	) {}

	createStrategy(strategyName: string): iStrategy {
		switch (strategyName) {
			case StrategyName.RSI:
				return new RsiStrategy(this.client, this.uuid, this.symbol);
			case StrategyName.MA:
				return new MaStrategy(this.client, this.uuid, this.symbol);
			case StrategyName.VOLUME:
				return new VolumeStrategy(this.client, this.uuid, this.symbol);
		}

		throw new Error(
			`${i18n.getMessage("INVALID_STRATEGY_ERROR")}${strategyName}`,
		);
	}
}

export enum StrategyName {
	RSI = "RSI",
	VOLUME = "VOLUME",
	MA = "MA",
}
