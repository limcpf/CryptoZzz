import type { Pool, PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import logger from "../config/logger";
import { errorHandler } from "./util";

interface ProcessHandlerConfig {
	loggerPrefix: string;
	pool: Pool;
	client: PoolClient;
}

export function setupProcessHandlers({
	loggerPrefix,
	pool,
	client,
}: ProcessHandlerConfig) {
	process.on("uncaughtException", (error) => {
		errorHandler(client, "UNEXPECTED_ERROR", `${loggerPrefix}`, error.message);
	});

	process.on("unhandledRejection", (reason, promise) => {
		if (reason instanceof Error) {
			errorHandler(
				client,
				"UNEXPECTED_ERROR",
				`${loggerPrefix}`,
				reason.message,
			);
		} else if (typeof reason === "string") {
			errorHandler(client, "UNEXPECTED_ERROR", `${loggerPrefix}`, reason);
		} else {
			errorHandler(client, "UNEXPECTED_ERROR", `${loggerPrefix}`, reason);
		}
	});

	async function handleGracefulShutdown() {
		logger.warn(client, "SERVICE_SHUTDOWN", loggerPrefix);

		if (client) {
			await client.release();
		}

		if (pool) {
			await pool.end();
		}

		process.exit(0);
	}

	process.on("SIGINT", handleGracefulShutdown);
	process.on("SIGTERM", handleGracefulShutdown);
}
