import type { Notification, Pool, PoolClient } from "pg";
import {
	getConnection,
	handleNotifications,
	setupPubSub,
} from "../../shared/config/database";
import logger from "../../shared/config/logger";
import { CHANNEL } from "../../shared/const/channel.const";
import { getMsg } from "../../shared/services/i18n/msg/msg.const";
import { setupProcessHandlers } from "../../shared/services/process-handler";
import { errorHandler } from "../../shared/services/util";
import webhook from "../../shared/services/webhook";

let pool: Pool;
let client: PoolClient;

const loggerPrefix = "[MANAGER]";

async function notifyCallback(notify: Notification) {
	if (notify.payload) {
		const [cmd, msg] = notify.payload.split(":");

		if (cmd === "SEND") {
			await send(msg);
		}
	}
}

async function setup() {
	try {
		[pool, client] = await getConnection(loggerPrefix);

		await setupPubSub(client, [CHANNEL.MANAGER_CHANNEL]);

		handleNotifications(client, async (msg) => {
			await notifyCallback(msg);
		});

		client.on("error", (err: unknown) => {
			errorHandler(client, "DB_CONNECTION_ERROR", loggerPrefix, err);
		});

		setupProcessHandlers({
			loggerPrefix,
			pool,
			client,
		});

		logger.warn(client, "MANAGER_START", loggerPrefix);
	} catch (error: unknown) {
		if (error instanceof Error) {
			webhook.send(
				`${loggerPrefix} ${getMsg("MANAGER_START_ERROR")} ${error.message}`,
			);
		} else {
			webhook.send(`${loggerPrefix} ${getMsg("MANAGER_START_ERROR")}`);
		}
		process.exit(1);
	}
}

async function send(msg: string) {
	webhook.send(msg);
}

await setup();
