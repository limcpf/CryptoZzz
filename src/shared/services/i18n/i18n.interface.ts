export interface I18n {
	language: string;

	getMessage(key: string): string;
}
