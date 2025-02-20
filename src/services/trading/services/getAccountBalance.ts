import type { iTradingBalance } from "../../../shared/interfaces/iTrading";
import API from "../../../shared/services/api";

export async function getAccountBalance(
	includesCoin?: string[],
): Promise<iTradingBalance[]> {
	const account = await API.GET_ACCOUNT();

	const filteredCoins = includesCoin
		? account.filter((acc) => includesCoin.includes(acc.currency))
		: account;

	const balances = filteredCoins
		.map((coin) => ({
			coin: coin.currency,
			balance: coin.balance,
			avg_buy_price: Number(coin.avg_buy_price),
		}))
		.filter(
			(coin) =>
				coin.coin === "KRW" || Number(coin.balance) * coin.avg_buy_price > 100,
		);

	return balances;
}
