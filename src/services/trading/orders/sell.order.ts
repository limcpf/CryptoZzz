import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import API from "../../../shared/services/api";
import { errorHandler } from "../../../shared/services/util";
import { developmentLog } from "../../analysis";

export async function executeSellOrder(
	client: PoolClient,
	symbol: string,
	loggerPrefix: string,
): Promise<void> {
	const coin = symbol.replace("KRW-", "");
	const account = await API.GET_ACCOUNT();
	const cryptoAccount = account.find((acc) => acc.currency === coin);

	if (!cryptoAccount) return;

	const availableCrypto = Number(cryptoAccount.balance);
	if (availableCrypto < 0.00001) {
		logger.error(client, "SELL_SIGNAL_ERROR", loggerPrefix);
		return;
	}

	try {
		const order = await API.ORDER(
			client,
			symbol,
			"ask",
			availableCrypto.toString(),
			null,
			"market",
			uuidv4(),
		);

		const lastOrder = await client.query<{ id: string }>(
			QUERIES.GET_LAST_ORDER,
			[symbol],
		);

		const id = lastOrder.rows[0].id;

		const result = await client.query(QUERIES.UPDATE_ORDER, [
			id,
			order.price,
			"SELL",
		]);

		const { quantity, buy_price, sell_price } = result.rows[0];

		const profitAmount = (sell_price - buy_price) * quantity;
		const profitRate = ((sell_price - buy_price) / buy_price) * 100;

		logger.send(
			client,
			`✅ 매도 주문 실행
          주문 ID: ${id}
          수량: ${quantity}BTC
          매수가: ${buy_price.toLocaleString()}KRW
          매도가: ${sell_price.toLocaleString()}KRW
          손익금: ${profitAmount.toLocaleString()}KRW (${profitRate.toFixed(2)}%)`,
			loggerPrefix,
		);

		developmentLog(
			`[${new Date().toLocaleString()}] [TRADING] 매도 주문 실행: ${availableCrypto}${coin}`,
		);

		logger.info("SELL_SIGNAL_SUCCESS", loggerPrefix);
	} catch (error: unknown) {
		errorHandler(client, "SELL_SIGNAL_ERROR", loggerPrefix, error);
		throw error;
	}
}
