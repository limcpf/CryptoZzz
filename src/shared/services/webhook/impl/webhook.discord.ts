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
				`[${new Date().toISOString()}] ⚠️ ${err.status} ${err.message}`,
			);
		});
	}
}
