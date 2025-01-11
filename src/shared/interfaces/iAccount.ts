interface iAccount {
	currency: string;
	balance: string;
	locked: string;
	avg_buy_price: string;
	avg_buy_price_modified: boolean;
	unit_currency: string;
}

export interface iAccountStatus {
	krwBalance: number;
	cryptoBalance: number;
	tradingStatus: string;
}

export type { iAccount, iAccountStatus };
