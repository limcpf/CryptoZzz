import type { I18n } from "../i18n.interface";
import messages from "../msg/msg-ko.const";
import type { MSG } from "../msg/msg.const";

export class KoreanI18n implements I18n {
	language = "ko";
	private messages: MSG = messages;

	getMessage(key: keyof MSG): string {
		return this.messages[key] || key;
	}
}
