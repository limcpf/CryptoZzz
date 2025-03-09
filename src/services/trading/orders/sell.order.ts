import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { notify } from "../../../shared/config/database";
import logger from "../../../shared/config/logger";
import { QUERIES } from "../../../shared/const/query.const";
import type {
	OrderResponse,
	iOrderProps,
} from "../../../shared/interfaces/iOrder";
import API from "../../../shared/services/api";
import i18n from "../../../shared/services/i18n";
export async function excuteSell(
	client: PoolClient,
	coin: string,
	coinBalance: string,
	tradingUuid: string,
): Promise<void> {
	if (process.env.NODE_ENV === "development") {
		await excuteSellDev(client, coin, coinBalance);
		return;
	}

	const uuid = tradingUuid || uuidv4();

	const orderProps: iOrderProps = {
		market: coin,
		side: "ask",
		volume: coinBalance,
		price: null,
		ord_type: "market",
	};

	let order: OrderResponse | undefined;

	try {
		order = await API.ORDER(client, orderProps);
	} catch (error) {
		console.error(error);
		throw new Error(i18n.getMessage("SELL_ORDER_ERROR"));
	}

	try {
		if (order?.price || order?.volume) {
			const result = await client.query(QUERIES.INSERT_TRADE, [
				uuid,
				"SELL",
				coin,
				order.price || -1,
				order.volume || -1,
				false,
				Number(order.paid_fee),
			]);

			if (result.rowCount !== 0) {
				logger.send(
					client,
					`🔴 ${coin} 매도 완료! 💰\n💵 매도 금액 ${order.price.toLocaleString()}원}`,
				);
				notify(client, "MANAGER_CHANNEL", `ORDER_UPDATE:${order.uuid},${uuid}`);
			}
		}
	} catch (error) {
		console.error(error);
		throw new Error(i18n.getMessage("INSERT_TRADE_ERROR"));
	}
}

async function excuteSellDev(
	client: PoolClient,
	coin: string,
	coinBalance: string,
): Promise<string> {
	const uuid = uuidv4();

	const currentPrices = await API.GET_CANDLE_DATA(
		coin,
		1,
		new Date().toISOString(),
	);

	const currentPrice = currentPrices[0].candle_acc_trade_price;

	if (currentPrice) {
		await client.query(QUERIES.INSERT_TRADE, [
			uuid,
			"SELL",
			coin,
			currentPrice,
			coinBalance,
			true,
			0,
		]);

		return uuid;
	}

	throw new Error(i18n.getMessage("SELL_ORDER_DEV_ERROR"));
}
