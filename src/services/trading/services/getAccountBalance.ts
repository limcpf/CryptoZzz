import type { PoolClient } from "pg";
import type { iAccount } from "../../../shared/interfaces/iAccount";
import type { iTradingBalance } from "../../../shared/interfaces/iTrading";
import API from "../../../shared/services/api";

export async function getAccountBalance(
	client: PoolClient,
	includesCoin?: string[],
): Promise<iTradingBalance[]> {
	const account = await API.GET_ACCOUNT();

	let coins: iAccount[] = [];

	if (includesCoin) {
		coins = account.filter((account) =>
			includesCoin.includes(account.currency),
		);
	} else {
		coins = account;
	}

	const balances: iTradingBalance[] = coins
		.map((coin) => ({
			coin: coin.currency,
			balance: Number(coin.balance) * Number(coin.avg_buy_price),
			avg_buy_price: Number(coin.avg_buy_price),
		}))
		.filter((coin) => coin.balance > 100);

	return balances;
}
