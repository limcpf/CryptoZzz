import crypto from "node:crypto";
import querystring from "node:querystring";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { developmentLog } from "../../../../services/analysis";
import logger from "../../../config/logger";
import type { iAccount, iAccountStatus } from "../../../interfaces/iAccount";
import type { iCandle } from "../../../interfaces/iCandle";
import type { OrderResponse, iOrder } from "../../../interfaces/iOrder";
import i18n from "../../i18n";
import type { Api } from "../api.interface";

export class UpbitApi implements Api {
	MARKET_URL: string;
	private loggerPrefix = "UPBIT";

	constructor() {
		this.MARKET_URL = process.env.UPBIT_API_URL || "https://api.upbit.com";
	}

	getAuthToken(
		body: Dict<
			| string
			| number
			| boolean
			| readonly string[]
			| readonly number[]
			| readonly boolean[]
			| null
		>,
	): string {
		const query = querystring.stringify(body);

		const hash = crypto.createHash("sha512");
		const queryHash = hash.update(query, "utf-8").digest("hex");

		const payload = {
			access_key: process.env.UPBIT_OPEN_API_ACCESS_KEY,
			nonce: uuidv4(),
			query_hash: queryHash,
			query_hash_alg: "SHA512",
		};

		if (!process.env.UPBIT_OPEN_API_SECRET_KEY) {
			throw new Error("UPBIT_OPEN_API_SECRET_KEY is not set");
		}

		const token = jwt.sign(payload, process.env.UPBIT_OPEN_API_SECRET_KEY);

		return token;
	}

	async getAccount(): Promise<iAccount[]> {
		const endpoint = "/v1/accounts";

		const url = `${this.MARKET_URL}${endpoint}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.getAuthToken({})}`,
			},
		});

		if (!response.ok) {
			throw new Error(
				`[${new Date().toLocaleString()}] [UPBIT-GET_ACCOUNT] ${i18n.getMessage("ANALYZE_API_ERROR")} : ${response.status}`,
			);
		}

		const data = (await response.json()) as iAccount[];

		return data;
	}

	async getCandles(
		market: string,
		count: number,
		to: string,
	): Promise<iCandle[]> {
		const endpoint = `/v1/candles/minutes/1?market=${market}&count=${count}&to=${to}`;
		const url = `${this.MARKET_URL}${endpoint}`;

		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			throw new Error(
				`[${new Date().toLocaleString()}] [UPBIT-GET_CANDLE_DATA] ${i18n.getMessage("CANDLE_SAVE_API_ERROR")} : ${response.status}`,
			);
		}

		const data = (await response.json()) as iCandle[];
		return data;
	}

	async order(
		market: string,
		side: "bid" | "ask",
		volume: string,
		price: string | null,
		ord_type: "price" | "market",
		identifier: string,
	): Promise<OrderResponse> {
		const endpoint = "/v1/orders";
		const url = `${this.MARKET_URL}${endpoint}`;

		const body = {
			market: market,
			side: side,
			volume: volume,
			price: price ? String(Math.floor(Number(price) / 1000) * 1000) : null,
			ord_type: ord_type,
			identifier: identifier,
		};

		const token = this.getAuthToken(body);

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			developmentLog(
				`[${new Date().toLocaleString()}] [UPBIT-ORDER] ${response.statusText}`,
			);
			developmentLog(response);
			logger.error("ORDER_API_ERROR", this.loggerPrefix, response.statusText);
			throw new Error(response.statusText);
		}

		const data = (await response.json()) as OrderResponse;

		return data;
	}

	async getAccountStatus(coin = "BTC"): Promise<iAccountStatus> {
		const accounts = await this.getAccount();
		const [krwAccount, cryptoAccount] = accounts.reduce(
			(acc, account) => {
				if (account.currency === "KRW") acc[0] = account;
				if (account.currency === coin) acc[1] = account;
				return acc;
			},
			[undefined, undefined] as [iAccount | undefined, iAccount | undefined],
		);

		return {
			haveCrypto: !!cryptoAccount?.balance,
			krwBalance: Number(krwAccount?.balance || 0),
			cryptoBalance: Number(cryptoAccount?.balance || 0),
			cryptoBuyPrice: Number(cryptoAccount?.avg_buy_price || 0),
			cryptoEvalAmount:
				Number(cryptoAccount?.avg_buy_price || 0) *
				Number(cryptoAccount?.balance || 0),
			tradingStatus:
				cryptoAccount && Number(cryptoAccount.balance) > 0
					? "매도 전략 실행중"
					: "매수 전략 실행중",
		};
	}
}
