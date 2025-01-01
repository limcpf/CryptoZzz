import crypto from "node:crypto";
import querystring from "node:querystring";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import type { iAccount } from "../../../interfaces/iAccount";
import i18n from "../../i18n";
import type { Api } from "../api.interface";

export class UpbitApi implements Api {
	MARKET_URL: string;

	constructor() {
		this.MARKET_URL = process.env.MARKET_URL || "";
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
			// TODO: Error 메세지 관리 추가
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
				`[UPBIT] ${i18n.getMessage("ANALYZE_API_ERROR")} : ${response.status}`,
			);
		}

		const data = (await response.json()) as iAccount[];

		return data;
	}

	getCandles(instId: string, count: number): string {
		return `/v1/candles/seconds?market=${instId}&count=${count}`;
	}
}
