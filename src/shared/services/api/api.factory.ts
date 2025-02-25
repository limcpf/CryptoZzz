import { getMsg } from "../i18n/msg/msg.const";
import { MARKET_ENUM } from "./api.enum";
import { UpbitApi } from "./impl/api.upbit";

export function apiFactory() {
	switch (process.env.MARKET as MARKET_ENUM) {
		case MARKET_ENUM.UPBIT:
			return new UpbitApi();
		default:
			console.error(
				`[${new Date().toLocaleString()}] ⚠️ ${
					getMsg(process.env.LANGUAGE as string).CONFIG_ERROR
				} : MARKET`,
			);
			process.exit(1);
	}
}
