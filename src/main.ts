import {
	App,
	EventRef,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
} from "obsidian";
import "@total-typescript/ts-reset";
import { evalFromExpression } from "./evalFromExpression";

const setRealTimePreview = (
	element: HTMLElement,
	expression: string,
	file: TFile
) => {
	const result = evalFromExpression(expression, file);
	if (!result.success) {
		console.error(result.error.cause);
		console.log(file);
		element.innerHTML = result.error.message;
	} else {
		// there is object
		// set the real time preview
		element.innerHTML = JSON.stringify(result.object, null, 2);
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
				// run the previous save command
				this.previousSaveCommand();
				// get the tags of the current file
				const editor =
					this.app.workspace.getActiveViewOfType(
						MarkdownView
					)?.editor;
				const file = this.app.workspace.getActiveFile();

				if (!editor || !file) return;

				const context = {
					file,
				};

				console.log("it is working", this.settings.template, file);
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

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("Status Bar Text");

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: "open-sample-modal-simple",
		// 	name: "Open sample modal (simple)",
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	},
		// });
		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: "sample-editor-command",
		// 	name: "Sample editor command",
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection("Sample Editor Command");
		// 	},
		// });
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: "open-sample-modal-complex",
		// 	name: "Open sample modal (complex)",
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView =
		// 			this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	},
		// });

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
