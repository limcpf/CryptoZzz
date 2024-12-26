export function sendNotifyDiscord(message: string) {
	fetch(process.env.DISCORD_WEBHOOK_URL || "", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ content: message }),
	});
}
