import type { ProcessDescription } from "pm2";
import { sendNotifyDiscord } from "./shared/utils/webhook";

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
		const timestamp = new Date().toLocaleString("ko-KR", {
			timeZone: "Asia/Seoul",
		});

		switch (event) {
			case "restart":
				sendNotifyDiscord(
					`🔄 [${timestamp}] **${appName}** 서비스가 재시작되었습니다.`,
				);
				break;

			case "stop":
				sendNotifyDiscord(
					`🛑 [${timestamp}] **${appName}** 서비스가 중지되었습니다.`,
				);
				break;

			case "exit":
				sendNotifyDiscord(
					`❌ [${timestamp}] **${appName}** 서비스가 종료되었습니다.\n종료 코드: ${proc.exit_code}`,
				);
				break;

			case "error":
				sendNotifyDiscord(
					`⚠️ [${timestamp}] **${appName}** 서비스에서 오류가 발생했습니다.`,
				);
				break;

			case "online":
				sendNotifyDiscord(
					`✅ [${timestamp}] **${appName}** 서비스가 온라인 상태가 되었습니다.`,
				);
				break;

			default:
				console.log(event);
				break;
		}
	}
});
