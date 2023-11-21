import { TFile } from "obsidian";
import { FrontmatterGeneratorPluginSettings } from "../FrontmatterGeneratorPluginSettings";
import { Data } from "./obsidian";
import { isIgnoredByFolder, YamlKey } from "../main";

export function shouldIgnoreFile(
	settings: FrontmatterGeneratorPluginSettings,
	file: TFile,
	data?: Data
) {
	// if file path is in ignoredFolders, return true
	if (isIgnoredByFolder(settings, file)) return true;

	// check if there is a yaml ignore key
	if (data) {
		if (data.yamlObj && data.yamlObj[YamlKey.IGNORE]) return true;
	}

	return false;
}
