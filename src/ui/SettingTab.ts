import { App, PluginSettingTab, Setting, TFile } from "obsidian";
import FrontmatterGeneratorPlugin from "../main";
import { setRealTimePreview } from "../utils/setRealTimePreview";
import { evalFromExpression } from "../utils/evalFromExpression";
import { Data, getDataFromFile } from "src/utils/obsidian";
import { getAPI } from "obsidian-dataview";
import { z } from "zod";

export class SettingTab extends PluginSettingTab {
	plugin: FrontmatterGeneratorPlugin;

	constructor(app: App, plugin: FrontmatterGeneratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	updatePreview(
		file: TFile,
		data: Data | undefined,
		realTimePreviewElement: HTMLElement
	) {
		const context = {
			file: {
				...file,
				tags: this.app.metadataCache.getFileCache(file)?.tags ?? [],
				properties: data?.yamlObj,
			},
			dv: getAPI(this.app),
			z,
		};
		const result = evalFromExpression(
			this.plugin.settings.template,
			context
		);
		setRealTimePreview(realTimePreviewElement, result, context);
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

	async display(): Promise<void> {
		const { containerEl } = this;

		containerEl.empty();

		const sampleFile = this.getSampleFile();
		const data = sampleFile
			? await getDataFromFile(this.plugin, sampleFile)
			: undefined;
		// const fragment = new DocumentFragment();
		// const desc = document.createElement("div");

		const templateSetting = new Setting(containerEl)
			.setName("Frontmatter template")
			.setDesc(`Current Demo file: ${sampleFile?.path}`)
			.addTextArea((text) => {
				const realTimePreview = document.createElement("pre");
				realTimePreview.classList.add(
					"frontmatter-generator-settings-real-time-preview"
				);

				if (sampleFile) {
					this.updatePreview(sampleFile, data, realTimePreview);
				}
				text.setPlaceholder("Enter your template")
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();

						if (!sampleFile) return;
						// try to update the real time preview
						this.updatePreview(sampleFile, data, realTimePreview);
					});
				text.inputEl.addClass("frontmatter-generator-settings-input");

				if (text.inputEl.parentElement) {
					text.inputEl.parentElement.addClass(
						"frontmatter-generator-settings-input-outer"
					);
				}
				text.inputEl.insertAdjacentElement("afterend", realTimePreview);
				return text;
			});

		templateSetting.setClass(
			"frontmatter-generator-settings-template-setting"
		);

		const ignoredFoldersSetting = new Setting(containerEl)
			.setName("Ignore folders")
			.setDesc("Folders to ignore. One folder per line.")
			.addTextArea((text) => {
				const realTimePreview = document.createElement("pre");
				realTimePreview.classList.add(
					"frontmatter-generator-settings-real-time-preview"
				);

				realTimePreview.setText(
					JSON.stringify(
						this.plugin.settings.internal.ignoredFolders,
						null,
						2
					)
				);
				text.setPlaceholder("Enter folders to ignore")
					.setValue(this.plugin.settings.folderToIgnore)
					.onChange(async (value) => {
						this.plugin.settings.folderToIgnore = value;
						this.plugin.settings.internal.ignoredFolders = value
							.split("\n")
							.map((folder) => folder.trim())
							.filter((folder) => folder !== "");
						await this.plugin.saveSettings();
						if (!sampleFile) return;
						realTimePreview.setText(
							JSON.stringify(
								this.plugin.settings.internal.ignoredFolders,
								null,
								2
							)
						);
					});
				text.inputEl.addClass("frontmatter-generator-settings-input");

				if (text.inputEl.parentElement) {
					text.inputEl.parentElement.addClass(
						"frontmatter-generator-settings-input-outer"
					);
				}
				text.inputEl.insertAdjacentElement("afterend", realTimePreview);

				return text;
			});
		ignoredFoldersSetting.setClass(
			"frontmatter-generator-settings-ignored-folders-setting"
		);

		new Setting(containerEl)
			.setName("Sort Yaml key")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.sortYamlKey)
					.onChange(async (value) => {
						this.plugin.settings.sortYamlKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Run on modify")
			.setDesc("Run the plugin when a file is modified")
			.addToggle((toggle) => {
				toggle
					.setValue(this.plugin.settings.runOnModify)
					.onChange(async (value) => {
						this.plugin.settings.runOnModify = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
