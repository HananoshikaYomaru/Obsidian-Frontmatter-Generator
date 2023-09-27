import {
	App,
	EventRef,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	TFolder,
	parseYaml,
	stringifyYaml,
} from "obsidian";
import "@total-typescript/ts-reset";
import { evalFromExpression } from "./evalFromExpression";
import { getYAMLText, initYAML } from "./utils/yaml";
import { deepInclude } from "./utils/deepInclude";
import { writeFile } from "./writeFile";
import { stripCr } from "./utils/strings";
import { ConfirmationModal } from "./ui/modals/confirmationModal";
import { SettingTab } from "./ui/SettingTab";
import {
	FrontmatterGeneratorPluginSettings,
	DEFAULT_SETTINGS,
} from "./FrontmatterGeneratorPluginSettings";

const userClickTimeout = 5000;

enum YamlKey {
	IGNORE = "yaml-gen-ignore",
}

export default class FrontmatterGeneratorPlugin extends Plugin {
	settings: FrontmatterGeneratorPluginSettings;
	private eventRefs: EventRef[] = [];
	private previousSaveCommand: () => void;

	shouldIgnoreFile(file: TFile, oldText?: string) {
		// if file path is in ignoredFolders, return true

		if (
			this.settings.internal.ignoredFolders.includes(
				file.parent?.path as string
			)
		)
			return true;

		if (oldText) {
			const newText = initYAML(oldText);
			// now there must be a YAML section
			const yaml = getYAMLText(newText) as string;

			const oldYamlObj = parseYaml(yaml) as {
				[x: string]: any;
			} | null;
			// if the YAML has the ignore key
			if (oldYamlObj && oldYamlObj[YamlKey.IGNORE]) return true;
		}

		return false;
	}

	addCommands() {
		const that = this;
		this.addCommand({
			id: "run-file",
			name: "run file",
			editorCheckCallback(checking, editor, ctx) {
				if (!ctx.file) return;
				if (checking) {
					return that.isMarkdownFile(ctx.file);
				}
				that.runFile(ctx.file);
			},
		});
		this.addCommand({
			id: "run-all-files",
			name: "Run all files",
			callback: () => {
				const startMessage =
					"Are you sure you want to run all files in your vault? This may take a while.";
				const submitBtnText = "Run all files";
				const submitBtnNoticeText = "Runing all files...";
				new ConfirmationModal(
					this.app,
					startMessage,
					submitBtnText,
					submitBtnNoticeText,
					() => {
						return this.runAllFiles(this.app);
					}
				).open();
			},
		});

		this.addCommand({
			id: "run-all-files-in-folder",
			name: "Run all files in folder",
			editorCheckCallback: (checking: Boolean, _, ctx) => {
				if (checking) {
					return !ctx.file?.parent?.isRoot();
				}

				if (ctx.file?.parent)
					this.createFolderRunModal(ctx.file.parent);
			},
		});
	}

	// handles the creation of the folder linting modal since this happens in multiple places and it should be consistent
	createFolderRunModal(folder: TFolder) {
		const startMessage = `Are you sure you want to run all files in the folder ${folder.name}? This may take a while.`;
		// const submitBtnText = getTextInLanguage('commands.run-all-files-in-folder.submit-button-text').replace('{FOLDER_NAME}', folder.name);
		const submitBtnText = `Run all files in ${folder.name}`;

		const submitBtnNoticeText = `Runing all files in ${folder.name}...`;
		new ConfirmationModal(
			this.app,
			startMessage,
			submitBtnText,
			submitBtnNoticeText,
			() => this.runRunerAllFilesInFolder(folder)
		).open();
	}

	registerEventsAndSaveCallback() {
		const saveCommandDefinition =
			this.app.commands.commands["editor:save-file"];
		this.previousSaveCommand = saveCommandDefinition.callback;

		if (typeof this.previousSaveCommand === "function") {
			const myAction = () => {
				// get the tags of the current file
				const editor =
					this.app.workspace.getActiveViewOfType(
						MarkdownView
					)?.editor;
				const file = this.app.workspace.getActiveFile();

				if (!editor || !file) return;

				const oldText = editor.getValue();

				if (this.shouldIgnoreFile(file, oldText)) return;

				const mustHaveYaml = initYAML(oldText);
				// now there must be a YAML section
				const yaml = getYAMLText(mustHaveYaml) as string;

				const oldYamlObj = parseYaml(yaml) as {
					[x: string]: any;
				} | null;

				// set the frontmatter
				const result = evalFromExpression(this.settings.template, {
					file,
				});

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
			};
			saveCommandDefinition.callback = () => {
				myAction();

				// run the previous save command
				this.previousSaveCommand();

				// defines the vim command for saving a file and lets the linter run on save for it
				// accounts for https://github.com/platers/obsidian-linter/issues/19
				const that = this;
				window.CodeMirrorAdapter.commands.save = () => {
					that.app.commands.executeCommandById("editor:save-file");
				};
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
		this.addCommands();

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

	async runFile(file: TFile, _oldText?: string) {
		if (this.shouldIgnoreFile(file, _oldText)) return;
		const oldText = _oldText ?? stripCr(await this.app.vault.read(file));
		const result = evalFromExpression(this.settings.template, {
			file,
		});
		if (!result.success) {
			throw result.error.cause;
		}
		const mustHaveYaml = initYAML(oldText);
		// now there must be a YAML section
		const yaml = getYAMLText(mustHaveYaml) as string;
		const oldYamlObj = parseYaml(yaml) as {
			[x: string]: any;
		} | null;
		// if there is no object, or the object is empty, do nothing
		if (
			!result.object ||
			typeof result.object !== "object" ||
			Object.keys(result.object).length === 0
		)
			return;

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
		let newText = "";
		// if the yaml exist, replace the yaml section. otherwise, add the yaml section
		if (yaml) {
			const parts = oldText.split(/^---$/m);
			newText = `---\n${yamlText}---\n\n${parts[2]!.trim()}`;
		} else {
			newText = `---\n${yamlText}---\n\n${oldText}`;
		}
		if (oldText !== newText) {
			await this.app.vault.modify(file, newText);
		}
	}

	async runAllFiles(app: App) {
		let numberOfErrors = 0;
		let lintedFiles = 0;
		await Promise.all(
			app.vault.getMarkdownFiles().map(async (file) => {
				const oldText = stripCr(await this.app.vault.read(file));
				if (!this.shouldIgnoreFile(file, oldText)) {
					try {
						await this.runFile(file);
					} catch (e) {
						numberOfErrors += 1;
					}
					lintedFiles++;
				}
			})
		);

		if (numberOfErrors === 0) {
			new Notice(
				`Obsidian Frontmatter Generator: ${lintedFiles} files are successfully updated.`,
				userClickTimeout
			);
		} else {
			new Notice(
				`Obsidian Frontmatter Generator: ${numberOfErrors} files have errors`,
				userClickTimeout
			);
		}
	}

	private getAllFilesInFolder(startingFolder: TFolder): TFile[] {
		const filesInFolder = [] as TFile[];
		const foldersToIterateOver = [startingFolder] as TFolder[];
		for (const folder of foldersToIterateOver) {
			for (const child of folder.children) {
				if (child instanceof TFile && this.isMarkdownFile(child)) {
					filesInFolder.push(child);
				} else if (child instanceof TFolder) {
					foldersToIterateOver.push(child);
				}
			}
		}

		return filesInFolder;
	}

	isMarkdownFile(file: TFile): boolean {
		return file && file.extension === "md";
	}

	async runRunerAllFilesInFolder(folder: TFolder) {
		let numberOfErrors = 0;
		let lintedFiles = 0;
		const filesInFolder = this.getAllFilesInFolder(folder);
		await Promise.all(
			filesInFolder.map(async (file) => {
				const oldText = stripCr(await this.app.vault.read(file));
				if (!this.shouldIgnoreFile(file, oldText)) {
					try {
						await this.runFile(file, oldText);
					} catch (e) {
						numberOfErrors += 1;
					}
				}
				lintedFiles++;
			})
		);

		new Notice(
			`Obsidian Frontmatter Generator: ${
				lintedFiles - numberOfErrors
			} out of ${lintedFiles} files are successfully updated. Errors: ${numberOfErrors}`,
			userClickTimeout
		);
	}
}
