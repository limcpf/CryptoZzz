import type { MSG } from "./msg/msg.const";

export interface I18n {
	language: string;

	getMessage(key: keyof MSG): string;
}
