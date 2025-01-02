import type { I18n } from "../i18n.interface";
import messages from "../msg/msg-en.const";
import type { MSG } from "../msg/msg.const";

export class EnglishI18n implements I18n {
	language = "en";
	private messages: MSG = messages;

	getMessage(key: keyof MSG): string {
		return this.messages[key] || key;
	}
}
