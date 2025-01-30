import crypto from "node:crypto";
import querystring from "node:querystring";
import jwt from "jsonwebtoken";
import type { PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import logger from "../../../config/logger";
import type { iAccount, iAccountStatus } from "../../../interfaces/iAccount";
import type { iCandle } from "../../../interfaces/iCandle";
import type {
	OrderResponse,
	iOrder,
	iOrderProps,
} from "../../../interfaces/iOrder";
import { developmentLog } from "../../../services/util";
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

	private getPriceUnit = (price: number): number => {
		if (price >= 2000000) return 1000;
		if (price >= 1000000) return 500;
		if (price >= 500000) return 100;
		if (price >= 100000) return 50;
		if (price >= 10000) return 10;
		if (price >= 1000) return 1;
		if (price >= 100) return 0.1;
		if (price >= 10) return 0.01;
		if (price >= 1) return 0.001;
		if (price >= 0.1) return 0.0001;
		if (price >= 0.01) return 0.00001;
		if (price >= 0.001) return 0.000001;
		if (price >= 0.0001) return 0.0000001;
		return 0.00000001;
	};

	async order(
		client: PoolClient,
		orderProps: iOrderProps,
	): Promise<OrderResponse> {
		const endpoint = "/v1/orders";
		const url = `${this.MARKET_URL}${endpoint}`;

		const { market, side, volume, price, ord_type, identifier } = orderProps;

		const nPrice = price ? Number(price) : null;

		const body = {
			market: market,
			side: side,
			volume: volume,
			price: nPrice
				? String(
						Math.floor(nPrice / this.getPriceUnit(nPrice)) *
							this.getPriceUnit(nPrice),
					)
				: null,
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
			logger.error(
				client,
				"ORDER_API_ERROR",
				this.loggerPrefix,
				response.statusText,
			);
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
