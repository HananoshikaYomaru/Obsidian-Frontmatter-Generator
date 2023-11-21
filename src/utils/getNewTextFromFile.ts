import { TFile, stringifyYaml } from "obsidian";
import {
	SanitizedObject,
	evalFromExpression,
} from "@/utils/evalFromExpression";
import { deepInclude } from "@/utils/deepInclude";
import { Data } from "@/utils/obsidian";
import { getAPI } from "obsidian-dataview";
import { deepRemoveNull } from "@/utils/deepRemoveNull";
import { createNotice } from "@/utils/createNotice";
import FrontmatterGeneratorPlugin, { isObjectEmpty } from "@/main";
import { z } from "zod";

/**
 *
 * @param settings
 * @param file
 * @param data
 * @returns if there is no change, return undefined, else return the new text
 */
export function getNewTextFromFile(
	template: string,
	file: TFile,
	data: Data,
	plugin: FrontmatterGeneratorPlugin
) {
	const app = plugin.app;
	const dv = getAPI(app);
	const result = evalFromExpression(template, {
		file: {
			...file,
			tags: data.tags,
			properties: data.yamlObj,
		},
		dv,
		z,
	});

	if (!result.success) {
		createNotice(
			`Invalid template, please check the developer tools for detailed error`,
			"red"
		);
		console.error(result.error.cause);
		return;
	}
	// if there is no object, or the object is empty, do nothing
	if (isObjectEmpty(result.object)) return;

	// check the yaml object, if the yaml object includes all keys of the result object
	// and the corresponding values are the same, do nothing
	if (data.yamlObj && deepInclude(data.yamlObj, result.object)) {
		return;
	}

	// now you have the yaml object, combine it with the result object
	// combine them
	const yamlObj = {
		...(data.yamlObj ?? {}),
		...result.object,
	};

	Object.assign(yamlObj, result.object);

	// remove null values and sort keys
	const noNull = deepRemoveNull<SanitizedObject>(yamlObj, result.object);
	// sort keys
	const sortedYamlObj = Object.keys(noNull)
		.sort()
		.reduce((acc, key) => {
			acc[key] = noNull[key];
			return acc;
		}, {} as SanitizedObject);

	// set the yaml section
	const yamlText = stringifyYaml(
		plugin.settings.sortYamlKey ? sortedYamlObj : noNull
	);

	// if old string and new string are the same, do nothing
	const newText = `---\n${yamlText}---\n\n${data.body.trim()}`;
	// if the new yaml text is the same as the old one, do nothing
	if (yamlText === data.yamlText || newText === data.text) {
		// createNotice("No changes made", "yellow");
		return;
	}

	return newText;
}
