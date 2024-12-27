import type { ProcessDescription } from "pm2";
import { webhookFactory } from "./shared/utils/webhook/webhook.factory";

interface PM2Packet {
	type: string;
	data: {
		event: string;
		process: ProcessDescription;
	};
}

process.on("message", (packet: PM2Packet) => {
	if (packet.type === "process:event") {
		const { event, process: proc } = packet.data;
		const appName = proc.name;

		const webhook = webhookFactory();

		switch (event) {
			case "restart":
				webhook.send(`🔄 **${appName}** 서비스가 재시작되었습니다.`);
				break;

			case "stop":
				webhook.send(`🛑 **${appName}** 서비스가 중지되었습니다.`);
				break;

			case "exit":
				webhook.send(`❌ **${appName}** 서비스가 종료되었습니다.`);
				break;

			case "error":
				webhook.send(`⚠️ **${appName}** 서비스에서 오류가 발생했습니다.`);
				break;

			case "online":
				webhook.send(`✅ **${appName}** 서비스가 온라인 상태가 되었습니다.`);
				break;

			default:
				console.log(event);
				break;
		}
	}
});
