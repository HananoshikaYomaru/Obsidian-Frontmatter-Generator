import { App, PluginSettingTab, Setting } from "obsidian";
import FrontmatterGeneratorPlugin from "../main";
import { setRealTimePreview } from "../utils/setRealTimePreview";
import { evalFromExpression } from "../utils/evalFromExpression";
import { getDataFromFile } from "src/utils/obsidian";
import { getAPI } from "obsidian-dataview";

export class SettingTab extends PluginSettingTab {
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

	async display(): Promise<void> {
		const { containerEl } = this;

		containerEl.empty();

		const sampleFile = this.getSampleFile();
		const data = sampleFile
			? await getDataFromFile(this.plugin, sampleFile)
			: undefined;
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

		new Setting(containerEl)
			.setName("Frontmatter Template")
			.setDesc(fragment)
			.addTextArea((text) => {
				const realTimePreview = document.createElement("pre");
				realTimePreview.style.textAlign = "left";
				realTimePreview.style.maxWidth = "300px";
				realTimePreview.style.whiteSpace = "pre-wrap";
				realTimePreview.style.color = "white";

				if (sampleFile) {
					const context = {
						file: {
							...sampleFile,
							properties: data?.yamlObj,
						},
					};
					const result = evalFromExpression(
						this.plugin.settings.template,
						context
					);
					setRealTimePreview(realTimePreview, result, context);
				}
				text.setPlaceholder("Enter your template")
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();

						if (!sampleFile) return;
						// try to update the real time preview
						const context = {
							file: {
								...sampleFile,
								properties: data?.yamlObj,
							},
							dv: getAPI(this.app),
						};
						const result = evalFromExpression(
							this.plugin.settings.template,
							context
						);
						setRealTimePreview(realTimePreview, result, context);
					});
				text.inputEl.style.minWidth = text.inputEl.style.maxWidth =
					"300px";
				text.inputEl.style.minHeight = "200px";

				if (text.inputEl.parentElement) {
					text.inputEl.parentElement.style.flexDirection = "column";
					text.inputEl.parentElement.style.alignItems = "flex-start";
					text.inputEl.parentElement.style.maxWidth = "300px";
				}
				text.inputEl.insertAdjacentElement("afterend", realTimePreview);
				return text;
			});

		new Setting(containerEl)
			.setName("Ignore folders")
			.setDesc("Folders to ignore. One folder per line.")
			.addTextArea((text) => {
				const realTimePreview = document.createElement("pre");
				realTimePreview.style.textAlign = "left";
				realTimePreview.style.maxWidth = "300px";
				realTimePreview.style.whiteSpace = "pre-wrap";
				realTimePreview.style.color = "white";

				realTimePreview.innerHTML = JSON.stringify(
					this.plugin.settings.internal.ignoredFolders,
					null,
					2
				);
				realTimePreview.style.color = "white";
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
						realTimePreview.innerHTML = JSON.stringify(
							this.plugin.settings.internal.ignoredFolders,
							null,
							2
						);
					});
				text.inputEl.style.minWidth = text.inputEl.style.maxWidth =
					"300px";
				text.inputEl.style.minHeight = "200px";
				if (text.inputEl.parentElement) {
					text.inputEl.parentElement.style.flexDirection = "column";
					text.inputEl.parentElement.style.alignItems = "flex-start";
					text.inputEl.parentElement.style.maxWidth = "300px";
				}
				text.inputEl.insertAdjacentElement("afterend", realTimePreview);

				return text;
			});
	}
}
