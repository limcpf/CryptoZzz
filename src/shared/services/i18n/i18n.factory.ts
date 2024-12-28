import { I18N_ENUM } from "./i18n.enum";
import { EnglishI18n } from "./impl/i18n.en";
import { KoreanI18n } from "./impl/i18n.ko";

export const i18nFactory = () => {
	switch (process.env.LANGUAGE as I18N_ENUM) {
		case I18N_ENUM.EN:
			return new EnglishI18n();
		default:
			return new KoreanI18n();
	}
};
