import type { PoolClient } from "pg";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import { developmentLog } from "../../../shared/services/util";
import { Signal } from "../../../strategy/iStrategy";
import { StrategyFactory } from "../../../strategy/strategy.factory";

export async function executeBuySignal(
	client: PoolClient,
	symbol: string,
): Promise<Signal> {
	const loggerPrefix = `[${symbol} BUY-SIGNAL] `;

	const now = new Date();
	const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
	const isoString = koreanTime.toISOString();

	const buyParent = await client.query<{ id: string }>({
		name: `insert_signal_log_${symbol}_${isoString}`,
		text: QUERIES.INSERT_SIGNAL_LOG,
		values: [symbol, isoString],
	});

	const uuid = buyParent.rows[0].id;

	if (!uuid) {
		logger.error(client, "SIGNAL_LOG_ERROR", loggerPrefix);
		return Signal.HOLD;
	}

	developmentLog(
		`[${new Date().toLocaleString()}] [BUY-SIGNAL] 부모 신호 로그 생성 성공: ${uuid}`,
	);

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) {
		logger.error(client, "NOT_FOUND_STRATEGY", loggerPrefix);
		return Signal.HOLD;
	}

	const signals = await Promise.all(
		strategies.map(async (strategy) => {
			const factory = new StrategyFactory(client);
			const strategyInstance = factory.createStrategy(strategy);
			return strategyInstance.execute(uuid, symbol);
		}),
	);

	developmentLog(
		`[${new Date().toLocaleString()}] [BUY-SIGNAL] 신호: ${signals.join(", ")}`,
	);

	return signals.every((signal) => signal === Signal.BUY)
		? Signal.BUY
		: Signal.HOLD;
}
