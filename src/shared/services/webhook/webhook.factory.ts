import { getMsg } from "../i18n/msg/msg.const";
import { WebhookDiscord } from "./impl/webhook.discord";
import { WEBHOOK_ENUM } from "./webhook.enum";

export const webhookFactory = () => {
	switch (process.env.WEBHOOK_TYPE as WEBHOOK_ENUM) {
		case WEBHOOK_ENUM.DISCORD:
			return new WebhookDiscord();
		default:
			console.error(
				`${getMsg(process.env.LANGUAGE as string).CONFIG_ERROR} : WEBHOOK_TYPE`,
			);
			process.exit(1);
	}
};
