import logger from "../../../shared/config/logger";
import API from "../../../shared/services/api";
import { developmentLog } from "../index";

const loggerPrefix = "CHECK_ACCOUNT_STATUS";

/**
 * @description 계좌 상태를 확인하여 매수/매도 상태를 체크하는 함수
 * @returns "BUY" : 보유X(매수체크해야함), "SELL" : 보유중(매도체크해야함), "HOLD" : 다른 코인 거래중
 */
export async function checkAccountStatus(
	coin: string,
): Promise<"BUY" | "SELL" | "HOLD"> {
	const account = await API.GET_ACCOUNT();

	const krwAccount = account.find((account) => account.currency === "KRW");
	const cryptoAccount = account.find((account) => account.currency === coin);

	if (
		cryptoAccount &&
		Number(cryptoAccount.balance) * Number(cryptoAccount.avg_buy_price) > 100
	) {
		developmentLog(
			`[${new Date().toLocaleString()}] [ANALYZE] ${coin} 보유중입니다. 매도 전략을 실행합니다.`,
		);
		return "SELL";
	}

	if (krwAccount && Number(krwAccount.balance) > 10000) {
		developmentLog(
			`[${new Date().toLocaleString()}] [ANALYZE] ${coin}는 없고, KRW 잔액이 10000원 이상 있습니다. 매수 전략을 실행합니다.`,
		);
		return "BUY";
	}

	return "HOLD";
}
