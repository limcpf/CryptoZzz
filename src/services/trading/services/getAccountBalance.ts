import type { iAccount } from "../../../shared/interfaces/iAccount";
import type { iTradingBalance } from "../../../shared/interfaces/iTrading";
import API from "../../../shared/services/api";

export async function getAccountBalance(
	includesCoin?: string[],
): Promise<iTradingBalance[]> {
	const account = await API.GET_ACCOUNT();

	let coins: iAccount[] = account;

	if (includesCoin) {
		coins = account.filter((account) =>
			includesCoin.includes(account.currency),
		);
	}

	const balances: iTradingBalance[] = coins
		.map((coin) => ({
			coin: coin.currency,
			balance: Number(coin.balance),
			avg_buy_price: Number(coin.avg_buy_price),
		}))
		.filter((coin) => coin.balance > 100);

	return balances;
}
