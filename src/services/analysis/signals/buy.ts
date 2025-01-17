import type { Pool } from "pg";
import { QUERIES } from "../../../shared/const/query.const";
import { Signal } from "../../../strategy/iStrategy";
import { StrategyFactory } from "../../../strategy/strategy.factory";
import { developmentLog } from "../index";

export async function executeBuySignal(pool: Pool): Promise<Signal> {
	const buyParent = await pool.query<{ id: string }>(
		QUERIES.INSERT_SIGNAL_LOG,
		["KRW-BTC", new Date()],
	);

	const uuid = buyParent.rows[0].id;

	if (!uuid) {
		console.error(
			`[${new Date().toLocaleString()}] [BUY-SIGNAL] 부모 신호 로그 생성 실패`,
		);
		return Signal.HOLD;
	}

	developmentLog(
		`[${new Date().toLocaleString()}] [BUY-SIGNAL] 부모 신호 로그 생성 성공: ${uuid}`,
	);

	const strategies = process.env.STRATEGIES?.split(",") || [];

	if (strategies.length === 0) return Signal.HOLD;

	const signals = await Promise.all(
		strategies.map(async (strategy) => {
			const factory = new StrategyFactory(pool);
			const strategyInstance = factory.createStrategy(strategy);
			return strategyInstance.execute(uuid);
		}),
	);

	developmentLog(
		`[${new Date().toLocaleString()}] [BUY-SIGNAL] 신호: ${signals.join(", ")}`,
	);

	return signals.every((signal) => signal === Signal.BUY)
		? Signal.BUY
		: Signal.HOLD;
}
