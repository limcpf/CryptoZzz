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
export async function excuteBuy(
	client: PoolClient,
	coin: string,
	KRWBalance: number,
	score: number,
	buyThreshold: number,
): Promise<string> {
	if (process.env.NODE_ENV === "development") {
		await excuteBuyDev(client, coin, KRWBalance);
		return uuidv4();
	}

	const uuid = uuidv4();

	const orderProps: iOrderProps = {
		market: coin,
		side: "bid",
		volume: null,
		price: KRWBalance.toString(),
		ord_type: "price",
	};

	let order: OrderResponse | undefined;

	try {
		order = await API.ORDER(client, orderProps);
	} catch (error) {
		console.error(error);
		throw new Error(i18n.getMessage("BUY_ORDER_ERROR"));
	}

	try {
		if (order?.price || order?.volume) {
			const result = await client.query(QUERIES.INSERT_TRADE, [
				uuid,
				"BUY",
				coin,
				order.price || -1,
				order.volume || -1,
				false,
				Number(order.paid_fee) || -1,
			]);

			if (result.rowCount !== 0) {
				logger.send(
					client,
					`${coin} 매수, 매수 금액 - ${result.rows[0].price}`,
				);
				logger.send(client, `score - ${score}, buyThreshold - ${buyThreshold}`);

				notify(client, "MANAGER_CHANNEL", `ORDER_UPDATE:${order.uuid},${uuid}`);
			}
		}
	} catch (error) {
		console.error(error);
		throw new Error(i18n.getMessage("INSERT_TRADE_ERROR"));
	}

	return uuid;
}

async function excuteBuyDev(
	client: PoolClient,
	coin: string,
	KRWBalance: number,
): Promise<void> {
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
	}

	throw new Error(i18n.getMessage("BUY_ORDER_DEV_ERROR"));
}
