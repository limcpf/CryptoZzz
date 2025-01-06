import API from "../../../shared/services/api";
import { developmentLog } from "../index";

/**
 * @description 계좌 상태를 확인하여 매수/매도 상태를 체크하는 함수
 * @returns true : 보유중(매도체크해야함), false : 보유X(매수체크해야함)
 */
export async function checkAccountStatus(): Promise<boolean> {
	const account = await API.GET_ACCOUNT();

	const krwAccount = account.find((account) => account.currency === "KRW");
	const btcAccount = account.find((account) => account.currency === "BTC");

	if (btcAccount && Number(btcAccount.balance) > 0.00001) {
		developmentLog(
			`[${new Date().toISOString()}] [ANALYZE] BTC 보유중입니다. 매도 전략을 실행합니다.`,
		);
		return false;
	}

	if (krwAccount && Number(krwAccount.balance) > 0) {
		developmentLog(
			`[${new Date().toISOString()}] [ANALYZE] BTC는 없고, KRW 잔액이 10000원 이상 있습니다. 매수 전략을 실행합니다.`,
		);
		return true;
	}

	throw new Error("매수/매도 전략 실행 조건이 없습니다.");
}
