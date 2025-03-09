import { sleepSync } from "bun";
import type { PoolClient } from "pg";
import type { GetOrderResponse } from "../../../shared/interfaces/iOrder";
import API from "../../../shared/services/api";
import i18n from "../../../shared/services/i18n";
import { errorHandler } from "../../../shared/services/util";

const MAX_RETRIES = 3;
const UPDATE_TRADE = `
UPDATE Trades 
SET 
    price = CASE 
        WHEN $4::NUMERIC IS NOT NULL THEN price + $4::NUMERIC 
        ELSE price 
    END,
    quantity = CASE 
        WHEN $5::NUMERIC IS NOT NULL THEN quantity + $5::NUMERIC 
        ELSE quantity 
    END,
    fee = fee + $6::NUMERIC,
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
	try {
		if (retryCount >= MAX_RETRIES)
			throw new Error(i18n.getMessage("UPDATE_ORDER_FAILED"));

		/** 거래 완료 대기를 위해 3초 대기 */
		sleepSync(3000);

		const [orderId, rowId] = getUuid(msg);

		const order = await getOrder(orderId);

		console.log("retryCount", retryCount);
		console.log("order", order);

		if (!(order.trades.length > 0) || order.state !== "done") {
			return await updateOrder(msg, client, retryCount + 1);
		}

		return await update(client, order, rowId);
	} catch (error: unknown) {
		if (error instanceof Error) {
			console.error(error);
			errorHandler(client, "UPDATE_ORDER_FAILED", "UpdateOrder", error.message);
		}
	}
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

/**
 * 주문의 거래 내역을 데이터베이스에 업데이트합니다.
 * 여러 거래(trades)의 총 거래대금(funds)과 거래량(volume)을 계산하여
 * 데이터베이스의 Trades 테이블을 갱신합니다.
 *
 * @throws {Error} 데이터베이스 쿼리 실행 중 오류 발생 시 "UPDATE_ORDER_QUERY_ERROR" 메시지와 함께 예외를 발생시킵니다.
 */
async function update(
	client: PoolClient,
	order: GetOrderResponse,
	rowId: string,
): Promise<UpdateOrderResponse> {
	try {
		const trades = order.trades;
		const firstTrade = trades[0];
		const totalFunds = trades.reduce(
			(sum, trade) => sum + (Number(trade.funds) || 0),
			0,
		);
		const totalVolume = trades.reduce(
			(sum, trade) => sum + (Number(trade.volume) || 0),
			0,
		);

		const result = await client.query<UpdateOrderResponse>(UPDATE_TRADE, [
			rowId,
			firstTrade.side === "bid" ? "BUY" : "SELL",
			firstTrade.market,
			totalFunds,
			totalVolume,
			order.paid_fee,
		]);

		return result.rows[0];
	} catch (error: unknown) {
		console.error(error);
		throw new Error(i18n.getMessage("UPDATE_ORDER_QUERY_ERROR"));
	}
}
