import { TFile } from "obsidian";
import { evalFromExpression } from "./evalFromExpression";

export const setRealTimePreview = (
	element: HTMLElement,
	expression: string,
	file: TFile
) => {
	const result = evalFromExpression(expression, { file });
	if (!result.success) {
		console.error(result.error.cause);
		// this is needed so that it is easier to debug
		console.log(file);
		element.innerHTML = result.error.message;
		element.style.color = "red";
	} else {
		// there is object
		// set the real time preview
		element.innerHTML = JSON.stringify(result.object, null, 2);
		element.style.color = "white";
	}
};
