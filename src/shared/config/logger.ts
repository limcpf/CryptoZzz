import i18n from "../services/i18n";
import type { MSG } from "../services/i18n/msg/msg.const";
import webhook from "../services/webhook";

const getTime = () =>
	Intl.DateTimeFormat("ko-KR", {
		dateStyle: "short",
		timeStyle: "long",
		timeZone: "Asia/Seoul",
	}).format(new Date());

const getMessage = (msg: keyof MSG, prefix?: string, suffix?: string) =>
	`${prefix ? `${prefix} ` : ""}${i18n.getMessage(msg)}${
		suffix ? ` ${suffix}` : ""
	}`;

const logger = {
	info(msg: keyof MSG, prefix?: string, suffix?: string) {
		console.log(getMessage(msg, prefix, suffix));
	},
	error(msg: keyof MSG, prefix?: string, suffix?: string) {
		const message = getMessage(msg, prefix, suffix);
		console.error(message);
		webhook.send(message);
	},
	warn(msg: keyof MSG, prefix?: string, suffix?: string) {
		const message = getMessage(msg, prefix, suffix);
		console.log(message);
		webhook.send(message);
	},
};

export default logger;
