import { Editor } from "obsidian";
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE } from "diff-match-patch";

export function writeFile(editor: Editor, oldText: string, newText: string) {
	const dmp = new diff_match_patch();
	const changes = dmp.diff_main(oldText, newText);
	let curText = "";
	changes.forEach((change) => {
		function endOfDocument(doc: string) {
			const lines = doc.split("\n");
			return {
				line: lines.length - 1,
				// @ts-ignore
				ch: lines[lines.length - 1].length,
			};
		}

		const [type, value] = change;

		if (type == DIFF_INSERT) {
			editor.replaceRange(value, endOfDocument(curText));
			curText += value;
		} else if (type == DIFF_DELETE) {
			const start = endOfDocument(curText);
			let tempText = curText;
			tempText += value;
			const end = endOfDocument(tempText);
			editor.replaceRange("", start, end);
		} else {
			curText += value;
		}
	});
}
