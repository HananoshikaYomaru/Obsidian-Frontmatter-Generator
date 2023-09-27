import {
	App,
	EventRef,
	MarkdownView,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface FrontmatterGeneratorPluginSettings {
	template: string;
}

const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "",
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

				if (!editor) return;

				console.log("it is working", this.settings.template);
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

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		const fragment = new DocumentFragment();
		const desc = document.createElement("div");
		desc.innerHTML = [
			`A map from a key to value. Each key-value pair is separated by new line.`,
			`The syntax is not a yaml!`,
			"for example, the following frontmatter template will cause the file `Good recipes/scrambled egg.md` to have the following frontmatter:",
			"",
			"folder: file.folder",
			"title: file.title",
			"",
			"↓↓↓↓↓↓↓↓↓ generate ↓↓↓↓↓↓↓↓↓",
			"",
			"folder: Good recipes",
			"title: scrambled egg",
		].join("<br />");
		fragment.appendChild(desc);
		new Setting(containerEl)
			.setName("Frontmatter Template")
			.setDesc(fragment)
			.addTextArea((text) => {
				text.setPlaceholder("Enter your template")
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.minWidth = text.inputEl.style.maxWidth =
					"300px";
				text.inputEl.style.minHeight = "200px";
				return text;
			});
	}
}
