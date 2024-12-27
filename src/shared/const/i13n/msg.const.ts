import msgEn from "./msg-en.const";
import msgKo from "./msg-ko.const";

export type msg = {
	CHECK_MESSAGE: string;
};

export const getMsg = (language: string) => {
	switch (language) {
		case "en":
			return msgEn;
		default:
			return msgKo;
	}
};
