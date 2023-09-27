import {
	App,
	EventRef,
	MarkdownView,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import "@total-typescript/ts-reset";
import { evalFromExpression } from "./evalFromExpression";
import { getYAMLText, initYAML } from "./utils/yaml";
import { deepInclude } from "./utils/deepInclude";
import { writeFile } from "./writeFile";

enum YamlKey {
	IGNORE = "yaml-gen-ignore",
}

const setRealTimePreview = (
	element: HTMLElement,
	expression: string,
	file: TFile
) => {
	const result = evalFromExpression(expression, file);
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

interface FrontmatterGeneratorPluginSettings {
	template: string;
}

const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "{}",
};

export default class FrontmatterGeneratorPlugin extends Plugin {
	settings: FrontmatterGeneratorPluginSettings;
	private eventRefs: EventRef[] = [];
	private previousSaveCommand: () => void;

	registerEventsAndSaveCallback() {
		const saveCommandDefinition =
			this.app.commands.commands["editor:save-file"];
		this.previousSaveCommand = saveCommandDefinition.callback;

		if (typeof this.previousSaveCommand === "function") {
			saveCommandDefinition.callback = () => {
				// get the tags of the current file
				const editor =
					this.app.workspace.getActiveViewOfType(
						MarkdownView
					)?.editor;
				const file = this.app.workspace.getActiveFile();

				if (!editor || !file) return;

				// set the frontmatter
				const result = evalFromExpression(this.settings.template, file);

				if (!result.success) {
					const fragment = new DocumentFragment();
					const desc = document.createElement("div");
					desc.innerHTML =
						"Obsidian Frontmatter Generator: Invalid template";
					desc.style.color = "red";
					fragment.appendChild(desc);

					new Notice(fragment);
					return;
				}

				// if there is no object, or the object is empty, do nothing
				if (
					!result.object ||
					typeof result.object !== "object" ||
					Object.keys(result.object).length === 0
				)
					return;

				const oldText = editor.getValue();

				const newText = initYAML(oldText);
				// now there must be a YAML section
				const yaml = getYAMLText(newText) as string;

				const oldYamlObj = parseYaml(yaml) as {
					[x: string]: any;
				} | null;
				// if the YAML has the ignore key
				if (oldYamlObj && oldYamlObj[YamlKey.IGNORE]) return;

				// check the yaml object, if the yaml object includes all keys of the result object
				// and the corresponding values are the same, do nothing
				if (yaml && deepInclude(oldYamlObj, result.object)) return;

				// now you have the yaml object, combine it with the result object
				// combine them
				const yamlObj = {
					...(oldYamlObj ?? {}),
					...result.object,
				};
				Object.assign(yamlObj, result.object);

				// set the yaml section
				const yamlText = stringifyYaml(yamlObj);

				// replace the yaml section
				if (yaml) {
					const parts = oldText.split(/^---$/m);
					writeFile(
						editor,
						oldText,
						`---\n${yamlText}---\n\n${parts[2]!.trim()}`
					);
				} else {
					writeFile(
						editor,
						oldText,
						`---\n${yamlText}---\n\n${oldText}`
					);
				}

				// run the previous save command
				this.previousSaveCommand();
			};
		}
	}

	unregisterEventsAndSaveCallback() {
		const saveCommandDefinition =
			this.app.commands.commands["editor:save-file"];
		saveCommandDefinition.callback = this.previousSaveCommand;
	}

	async onload() {
		await this.loadSettings();
		this.registerEventsAndSaveCallback();

		// TODO: create a command that generate frontmatter on the whole vault

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
	}

	onunload() {
		for (const eventRef of this.eventRefs) {
			this.app.workspace.offref(eventRef);
		}
		this.unregisterEventsAndSaveCallback();
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SettingTab extends PluginSettingTab {
	plugin: FrontmatterGeneratorPlugin;

	constructor(app: App, plugin: FrontmatterGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSampleFile() {
		const allFiles = this.app.vault.getMarkdownFiles();
		const filesInRoot = allFiles.filter(
			(file) => file.parent?.path === "/"
		);
		const filesInFolder = allFiles
			.filter((file) => file.parent?.path !== "/")
			.sort((a, b) => {
				const aDepth = a.path.split("/").length - 1;
				const bDepth = b.path.split("/").length - 1;
				if (aDepth === bDepth) return 0;
				return aDepth > bDepth ? 1 : -1;
			});

		return filesInFolder[0] ?? filesInRoot[0];
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const sampleFile = this.getSampleFile();
		const fragment = new DocumentFragment();
		const desc = document.createElement("div");
		desc.innerHTML = [
			`A map from a key to value.`,
			`for example, the following frontmatter template will cause the file "${sampleFile?.path}" to have the following frontmatter:`,
			"",
			`folder: file.parent.path`,
			"title: file.basename",
			"",
			"↓↓↓↓↓↓↓↓↓ generate ↓↓↓↓↓↓↓↓↓",
			"",
			`folder: ${sampleFile?.parent?.path}`,
			`title: ${sampleFile?.basename}`,
			``,
			`Note: If you see error, it means that the template is not valid. Please check the console for more information.`,
		].join("<br />");

		fragment.appendChild(desc);

		const realTimePreview = document.createElement("pre");
		realTimePreview.style.textAlign = "left";
		realTimePreview.style.maxWidth = "300px";
		realTimePreview.style.whiteSpace = "pre-wrap";
		realTimePreview.style.color = "white";

		if (sampleFile) {
			setRealTimePreview(
				realTimePreview,
				this.plugin.settings.template,
				sampleFile
			);
		}

		new Setting(containerEl)
			.setName("Frontmatter Template")
			.setDesc(fragment)
			.addTextArea((text) => {
				text.setPlaceholder("Enter your template")
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();

						if (!sampleFile) return;
						// try to update the real time preview
						setRealTimePreview(
							realTimePreview,
							this.plugin.settings.template,
							sampleFile
						);
					});
				text.inputEl.style.minWidth = text.inputEl.style.maxWidth =
					"300px";
				text.inputEl.style.minHeight = "200px";

				if (text.inputEl.parentElement) {
					text.inputEl.parentElement.style.flexDirection = "column";
					text.inputEl.parentElement.style.alignItems = "flex-start";
				}
				text.inputEl.insertAdjacentElement("afterend", realTimePreview);
				return text;
			});
	}
}
