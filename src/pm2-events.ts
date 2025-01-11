import type { ProcessDescription } from "pm2";
import webhook from "./shared/services/webhook";

interface PM2Packet {
	type: string;
	data: {
		event: string;
		process: ProcessDescription;
	};
}

function sendWebhook(msg: string) {
	fetch(process.env.WEBHOOK_URL as string, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			content: `[${new Date().toLocaleString()}] ${msg}`,
		}),
	});
}

process.on("message", (packet: PM2Packet) => {
	if (packet.type === "process:event") {
		const { event, process: proc } = packet.data;
		const appName = proc.name;

		switch (event) {
			case "restart":
				sendWebhook(`🔄 **${appName}** 서비스가 재시작되었습니다.`);
				break;

			case "stop":
				sendWebhook(`🛑 **${appName}** 서비스가 중지되었습니다.`);
				break;

			case "exit":
				webhook.send(`❌ **${appName}** 서비스가 종료되었습니다.`);
				break;

			case "error":
				sendWebhook(`⚠️ **${appName}** 서비스에서 오류가 발생했습니다.`);
				break;

			case "online":
				sendWebhook(`✅ **${appName}** 서비스가 온라인 상태가 되었습니다.`);
				break;

			default:
				sendWebhook(
					`🔔 **${appName}** 서비스가 이벤트를 받았습니다. : ${event}`,
				);
				break;
		}
	}
});
