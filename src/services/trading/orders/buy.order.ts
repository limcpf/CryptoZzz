import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import { QUERIES } from "../../../shared/const/query.const";
import type { iOrderProps } from "../../../shared/interfaces/iOrder";
import API from "../../../shared/services/api";
import { getMsg } from "../../../shared/services/i18n/msg/msg.const";

export async function excuteBuy(
	client: PoolClient,
	coin: string,
	KRWBalance: number,
): Promise<string> {
	if (process.env.NODE_ENV === "development") {
		return await excuteBuyDev(client, coin, KRWBalance);
	}

	const uuid = uuidv4();

	const orderProps: iOrderProps = {
		market: coin,
		side: "bid",
		volume: null,
		price: KRWBalance.toString(),
		ord_type: "price",
		identifier: uuid,
	};

	const order = await API.ORDER(client, orderProps);

	// order가 정상적으로 처리되었을 때만 INSERT_TRADE 실행
	if (order?.price && order?.volume) {
		await client.query(QUERIES.INSERT_TRADE, [
			uuid,
			"BUY",
			coin,
			order.price,
			order.volume,
			false,
			Number(order.paid_fee),
		]);
		return uuid;
	}

	throw new Error(String(getMsg("BUY_ORDER_ERROR")));
}

async function excuteBuyDev(
	client: PoolClient,
	coin: string,
	KRWBalance: number,
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
			"BUY",
			coin,
			currentPrice,
			KRWBalance / currentPrice,
			false,
			0,
		]);

		return uuid;
	}

	throw new Error(String(getMsg("BUY_ORDER_DEV_ERROR")));
}
