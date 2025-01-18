import type { PoolClient } from "pg";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import API from "../../../shared/services/api";
import { Signal } from "../../../strategy/iStrategy";
import { StrategyFactory } from "../../../strategy/strategy.factory";
import { developmentLog } from "../index";

const loggerPrefix = "SELL-SIGNAL";
const TAKE_PROFIT = Number(process.env.TAKE_PROFIT) || 3;
const STOP_LOSS = Number(process.env.STOP_LOSS) || -2;

export async function executeSellSignal(
	client: PoolClient,
	symbol: string,
	coin: string,
): Promise<Signal> {
	const currentPrices = await API.GET_CANDLE_DATA(
		symbol,
		1,
		new Date().toISOString(),
	);

	if (currentPrices.length === 0) {
		return Signal.HOLD;
	}

	const currentPrice = currentPrices[0];

	const account = await API.GET_ACCOUNT();
	const cryptoAccount = account.find((acc) => acc.currency === coin);

	if (!cryptoAccount || !cryptoAccount.avg_buy_price) {
		logger.error(client, "SIGNAL_ACCOUNT_ERROR", loggerPrefix);
		return Signal.HOLD;
	}

	const avgBuyPrice = Number(cryptoAccount.avg_buy_price);
	const currentPriceNum = Number(currentPrice.trade_price);

	const profitRate = ((currentPriceNum - avgBuyPrice) / avgBuyPrice) * 100;

	developmentLog(
		`[${new Date().toLocaleString()}] [SELL-SIGNAL] ${symbol} 현재 수익률: ${profitRate.toFixed(2)}%`,
	);

	if (profitRate >= TAKE_PROFIT) {
		developmentLog(
			`[${new Date().toLocaleString()}] [SELL-SIGNAL] ${symbol} 익절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	if (profitRate <= STOP_LOSS) {
		developmentLog(
			`[${new Date().toLocaleString()}] [SELL-SIGNAL] ${symbol} 손절 기준 도달: ${profitRate.toFixed(2)}%`,
		);
		return Signal.SELL;
	}

	const analyzeParent = await client.query<{ id: string }>(
		QUERIES.INSERT_SIGNAL_LOG,
		[symbol, new Date()],
	);

	const uuid = analyzeParent.rows[0].id;

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) return Signal.HOLD;

	const signals = await Promise.all(
		strategies.map(async (strategy) => {
			const factory = new StrategyFactory(client);
			const strategyInstance = factory.createStrategy(strategy);
			return strategyInstance.execute(uuid, symbol);
		}),
	);

	developmentLog(
		`[${new Date().toLocaleString()}] [SELL-SIGNAL] 신호: ${signals.join(", ")}`,
	);

	const sellSignalCount = signals.filter(
		(signal) => signal === Signal.SELL,
	).length;
	const majorityThreshold = signals.length / 2;

	return sellSignalCount > majorityThreshold ? Signal.SELL : Signal.HOLD;
}
