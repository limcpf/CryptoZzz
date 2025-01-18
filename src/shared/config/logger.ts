import type { PoolClient } from "pg";
import { CHANNEL } from "../const/channel.const";
import i18n from "../services/i18n";
import type { MSG } from "../services/i18n/msg/msg.const";
import { notify } from "./database";

const getMessage = (msg: keyof MSG, prefix?: string, suffix?: string) =>
	`${prefix ? `${prefix} ` : ""}${i18n.getMessage(msg)}${
		suffix ? ` ${suffix}` : ""
	}`;

const logger = {
	info(msg: keyof MSG, prefix?: string, suffix?: string) {
		console.log(getMessage(msg, prefix, suffix));
	},
	error(client: PoolClient, msg: keyof MSG, prefix?: string, suffix?: string) {
		const message = getMessage(msg, prefix, suffix);
		console.error(message);
		notify(client, CHANNEL.MANAGER_CHANNEL, `SEND:${message}`);
	},
	warn(client: PoolClient, msg: keyof MSG, prefix?: string, suffix?: string) {
		const message = getMessage(msg, prefix, suffix);
		console.log(message);
		notify(client, CHANNEL.MANAGER_CHANNEL, `SEND:${message}`);
	},
};

export default logger;
