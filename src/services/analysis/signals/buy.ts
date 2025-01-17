import type { Pool } from "pg";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import { Signal } from "../../../strategy/iStrategy";
import { StrategyFactory } from "../../../strategy/strategy.factory";
import { developmentLog } from "../index";

export async function executeBuySignal(
	pool: Pool,
	symbol: string,
): Promise<Signal> {
	const loggerPrefix = `[${symbol} BUY-SIGNAL] `;

	const buyParent = await pool.query<{ id: string }>(
		QUERIES.INSERT_SIGNAL_LOG,
		[symbol, new Date()],
	);

	const uuid = buyParent.rows[0].id;

	if (!uuid) {
		logger.error("SIGNAL_LOG_ERROR", loggerPrefix);
		return Signal.HOLD;
	}

	developmentLog(
		`[${new Date().toLocaleString()}] [BUY-SIGNAL] 부모 신호 로그 생성 성공: ${uuid}`,
	);

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) {
		logger.error("NOT_FOUND_STRATEGY", loggerPrefix);
		return Signal.HOLD;
	}

	const signals = await Promise.all(
		strategies.map(async (strategy) => {
			const factory = new StrategyFactory(pool);
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
