export interface Webhook {
	WEBHOOK_URL: string;

	send(message: string): void;
}
