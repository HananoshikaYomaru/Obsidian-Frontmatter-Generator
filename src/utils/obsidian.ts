import { TFolder, TFile, parseYaml, Plugin, Editor } from "obsidian";
import { stripCr } from "./strings";
import { getYAMLText, splitYamlAndBody } from "./yaml";
import { diff_match_patch, DIFF_INSERT, DIFF_DELETE } from "diff-match-patch";
import { IgnoreTypes, ignoreListOfTypes } from "./ignore-types";
import { matchTagRegex } from "./regex";

export function isMarkdownFile(file: TFile) {
	return file && file.extension === "md";
}

/**
 * recursively get all files in a folder
 */
export function getAllFilesInFolder(startingFolder: TFolder): TFile[] {
	const filesInFolder = [] as TFile[];
	const foldersToIterateOver = [startingFolder] as TFolder[];
	for (const folder of foldersToIterateOver) {
		for (const child of folder.children) {
			if (child instanceof TFile && isMarkdownFile(child)) {
				filesInFolder.push(child);
			} else if (child instanceof TFolder) {
				foldersToIterateOver.push(child);
			}
		}
	}

	return filesInFolder;
}

/**
 * this is the sync version of getDataFromFile
 * @param plugin
 * @param text
 * @returns
 */
export const getDataFromTextSync = (text: string) => {
	const yamlText = getYAMLText(text);

	const { body } = splitYamlAndBody(text);

	const tags: string[] = [];
	ignoreListOfTypes([IgnoreTypes.yaml], text, (text) => {
		// get all the tags except the generated ones
		tags.push(...matchTagRegex(text));

		return text;
	});

	return {
		text,
		yamlText,
		yamlObj: yamlText
			? (parseYaml(yamlText) as { [x: string]: any })
			: null,
		tags,
		body,
	};
};

export const getDataFromFile = async (plugin: Plugin, file: TFile) => {
	const text = stripCr(await plugin.app.vault.read(file));
	return getDataFromTextSync(text);
};

export type Data = Awaited<ReturnType<typeof getDataFromFile>>;

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
