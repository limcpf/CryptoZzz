import { sleepSync } from "bun";
import type { PoolClient } from "pg";
import type { GetOrderResponse } from "../../../shared/interfaces/iOrder";
import API from "../../../shared/services/api";
import i18n from "../../../shared/services/i18n";

const MAX_RETRIES = 3;
const UPDATE_TRADE = `
UPDATE Trades 
SET 
    price = CASE 
        WHEN $4::NUMERIC IS NOT NULL THEN $4::NUMERIC 
        ELSE price 
    END,
    quantity = CASE 
        WHEN $5::NUMERIC IS NOT NULL THEN $5::NUMERIC 
        ELSE quantity 
    END,
    fee = $6::NUMERIC,
    sequence = sequence + 1
WHERE 
    uuid = $1 
    AND type = $2 
    AND symbol = $3
RETURNING uuid, type, symbol, price, fee;
`;

export interface UpdateOrderResponse {
	uuid: string;
	type: string;
	symbol: string;
	price: number;
	fee: number;
}

export async function updateOrder(
	msg: string,
	client: PoolClient,
	retryCount = 0,
) {
	if (retryCount >= MAX_RETRIES)
		throw new Error(i18n.getMessage("UPDATE_ORDER_FAILED"));

	/** 거래 완료 대기를 위해 3초 대기 */
	sleepSync(3000);

	const [orderId, rowId] = getUuid(msg);

	const order = await getOrder(orderId);

	if (!(order.trades_count > 0)) {
		return await updateOrder(msg, client, retryCount + 1);
	}

	return await update(client, order, rowId);
}

function getUuid(msg: string): [string, string] {
	const uuids = msg.split(",");

	validateUuids(uuids);

	return [uuids[0], uuids[1]];
}

function validateUuids(uuids: string[]): void {
	if (uuids.length !== 2) {
		throw new Error(i18n.getMessage("UUID_LENGTH_ERROR"));
	}

	const uuidRegex =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	for (const uuid of uuids) {
		if (!uuidRegex.test(uuid)) {
			throw new Error(i18n.getMessage("UUID_INVALID_ERROR"));
		}
	}
}

async function getOrder(orderId: string): Promise<GetOrderResponse> {
	try {
		return await API.GET_ORDER(orderId);
	} catch (error: unknown) {
		console.log(error);
		throw new Error(i18n.getMessage("ORDER_API_ERROR"));
	}
}

// TODO: 만약 2개 이상으로 쪼개서 들어오면?
// TODO: trades에 맞게...done인 경우에만?
async function update(
	client: PoolClient,
	order: GetOrderResponse,
	rowId: string,
): Promise<UpdateOrderResponse> {
	try {
		const trade = order.trades[0];

		const result = await client.query<UpdateOrderResponse>(UPDATE_TRADE, [
			rowId,
			trade.side === "bid" ? "BUY" : "SELL",
			trade.market,
			trade.funds,
			trade.volume,
			order.paid_fee,
		]);

		return result.rows[0];
	} catch (error: unknown) {
		console.error(error);
		throw new Error(i18n.getMessage("UPDATE_ORDER_QUERY_ERROR"));
	}
}
