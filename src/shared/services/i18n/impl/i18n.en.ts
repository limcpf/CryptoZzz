import messages from "../../../const/i13n/msg-en.const";
import type { I18n } from "../i18n.interface";
import type { MSG } from "../i18n.types";

export class EnglishI18n implements I18n {
	language = "en";
	private messages: MSG = messages;

	getMessage(key: keyof MSG): string {
		return this.messages[key] || key;
	}
}
