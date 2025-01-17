interface iOrder {
	id: string; // UUID
	symbol: string;
	buy_price: number;
	sell_price: number | null;
	quantity: number;
	status: OrderStatus;
	created_at: Date;
	updated_at: Date;
	order_type: OrderType;
}

enum OrderType {
	BUY = "BUY",
	SELL = "SELL",
}

enum OrderStatus {
	PENDING = "PENDING",
	FILLED = "FILLED",
	CANCELLED = "CANCELLED",
}

interface OrderResponse {
	uuid: string;
	side: "bid" | "ask";
	ord_type: string;
	price: string;
	state: string;
	market: string;
	created_at: string;
	volume: string;
	remaining_volume: string;
	reserved_fee: string;
	remaining_fee: string;
	paid_fee: string;
	locked: string;
	executed_volume: string;
	trades_count: number;
	identifier: string;
}

export type { iOrder, OrderResponse };
export { OrderType, OrderStatus };
