import type { Webhook } from "../webhook.interface";

export class WebhookDiscord implements Webhook {
	WEBHOOK_URL: string;

	constructor() {
		this.WEBHOOK_URL = process.env.WEBHOOK_URL || "";
	}

	send(message: string): void {
		const timestamp = new Date().toLocaleString("ko-KR", {
			timeZone: "Asia/Seoul",
		});
		console.log("[WEBHOOK] send - URL : ", this.WEBHOOK_URL);
		console.log("[WEBHOOK] send - message : ", message);

		fetch(this.WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				content: `[${timestamp}] ${message}`,
			}),
		}).catch((err) => {
			console.error(
				`[${new Date().toLocaleString()}] ⚠️ ${err.status} ${err.message}`,
			);
		});
	}
}
