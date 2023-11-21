import { EvalResult } from "./evalFromExpression";

export const setRealTimePreview = (
	element: HTMLElement,
	result: EvalResult,
	context?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		[x: string]: any;
	}
) => {
	if (!result.success) {
		console.error(result.error.cause);
		// this is needed so that it is easier to debug
		if (context) console.log(context);
		element.setText(result.error.message);
		element.style.color = "red";
	} else {
		// there is object
		// set the real time preview
		element.setText(JSON.stringify(result.object, null, 2));
		element.style.color = "white";
	}
};
