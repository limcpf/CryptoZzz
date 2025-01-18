import type { PoolClient } from "pg";
import logger from "../config/logger";
import type { MSG } from "./i18n/msg/msg.const";

export function errorHandler(
	client: PoolClient,
	msg: keyof MSG,
	loggerPrefix: string,
	error: unknown,
) {
	if (error instanceof Error) {
		logger.error(client, msg, loggerPrefix, error.message);
	} else {
		logger.error(client, msg, loggerPrefix);
	}
}

export function developmentLog(message: string) {
	return process.env.NODE_ENV === "development" ? console.log(message) : null;
}
