import type { Pool } from "pg";
import i18n from "../shared/services/i18n";
import type { iStrategy } from "./iStrategy";
import { RsiStrategy } from "./impl/rsi.strategy";

export class StrategyFactory {
	constructor(private pool: Pool) {}

	createStrategy(strategyName: StrategyName): iStrategy {
		switch (strategyName) {
			case StrategyName.RSI:
				return new RsiStrategy(this.pool);
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
