import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { QUERIES } from "../../../shared/const/query.const";
import type { iOrderProps } from "../../../shared/interfaces/iOrder";
import API from "../../../shared/services/api";
import i18n from "../../../shared/services/i18n";
export async function excuteSell(
	client: PoolClient,
	coin: string,
	coinBalance: number,
	uuid?: string,
): Promise<void> {
	if (process.env.NODE_ENV === "development") {
		await excuteSellDev(client, coin, coinBalance, uuid);
		return;
	}

	const orderProps: iOrderProps = {
		market: coin,
		side: "ask",
		volume: coinBalance.toString(),
		price: null,
		ord_type: "market",
		identifier: uuid || uuidv4(),
	};

	const order = await API.ORDER(client, orderProps);

	if (order?.price && order?.volume) {
		await client.query(QUERIES.INSERT_TRADE, [
			uuid || order.identifier,
			"SELL",
			coin,
			order.price,
			order.volume,
			false,
			Number(order.paid_fee),
		]);
	}

	throw new Error(i18n.getMessage("SELL_ORDER_ERROR"));
}

async function excuteSellDev(
	client: PoolClient,
	coin: string,
	coinBalance: number,
	uuid?: string,
): Promise<string> {
	const u = uuid || uuidv4();

	const currentPrices = await API.GET_CANDLE_DATA(
		coin,
		1,
		new Date().toISOString(),
	);

	const currentPrice = currentPrices[0].candle_acc_trade_price;

	if (currentPrice) {
		await client.query(QUERIES.INSERT_TRADE, [
			u,
			"SELL",
			coin,
			currentPrice,
			coinBalance,
			false,
			0,
		]);

		return u;
	}

	throw new Error(i18n.getMessage("SELL_ORDER_DEV_ERROR"));
}
