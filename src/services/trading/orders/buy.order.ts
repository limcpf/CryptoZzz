import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import API from "../../../shared/services/api";
import { errorHandler } from "../../../shared/services/util";
import { developmentLog } from "../../analysis";

export async function executeBuyOrder(
	client: PoolClient,
	symbol: string,
	loggerPrefix: string,
): Promise<void> {
	const coin = symbol.replace("KRW-", "");
	const account = await API.GET_ACCOUNT();
	const krwAccount = account.find((acc) => acc.currency === "KRW");

	if (!krwAccount) return;

	const availableKRW = Number(krwAccount.balance);
	if (availableKRW < 10000) {
		logger.error(client, "BUY_SIGNAL_ERROR", loggerPrefix);
		return;
	}

	try {
		const order = await API.ORDER(
			client,
			symbol,
			"bid",
			"",
			availableKRW.toString(),
			"price",
			uuidv4(),
		);

		const insertResult = await client.query<{ identifier: string }>(
			QUERIES.INSERT_ORDER,
			[order.market, order.price, order.volume, "BUY", order.identifier],
		);

		logger.send(
			client,
			`✅ 매수 주문 실행
          주문 ID: ${insertResult.rows[0].identifier}
          수량: ${order.volume}${coin}
          매수가: ${order.price.toLocaleString()}KRW`,
			loggerPrefix,
		);

		developmentLog(
			`[${new Date().toLocaleString()}] [TRADING] 매수 주문 실행: ${availableKRW}KRW`,
		);

		logger.info("BUY_SIGNAL_SUCCESS", loggerPrefix);
	} catch (error: unknown) {
		errorHandler(client, "BUY_SIGNAL_ERROR", loggerPrefix, error);
		throw error;
	}
}
