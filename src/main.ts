import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	TFolder,
} from "obsidian";
import "@total-typescript/ts-reset";
import { SanitizedObject } from "@/utils/evalFromExpression";
import { writeFile } from "./utils/obsidian";
import { ConfirmationModal } from "./ui/modals/confirmationModal";
import { SettingTab } from "./ui/SettingTab";
import {
	FrontmatterGeneratorPluginSettings,
	DEFAULT_SETTINGS,
} from "./FrontmatterGeneratorPluginSettings";
import {
	getAllFilesInFolder,
	getDataFromFile,
	getDataFromTextSync,
	isMarkdownFile,
} from "./utils/obsidian";
import { shouldIgnoreFile } from "./utils/shouldIgnoreFile";
import { getNewTextFromFile } from "./utils/getNewTextFromFile";
import { isValidFrontmatter } from "@/utils/yaml";

const userClickTimeout = 5000;

export enum YamlKey {
	IGNORE = "yaml-gen-ignore",
}

export const isIgnoredByFolder = (
	settings: FrontmatterGeneratorPluginSettings,
	file: TFile
) => {
	return settings.internal.ignoredFolders.includes(
		file.parent?.path as string
	);
};

export function isObjectEmpty(obj: SanitizedObject) {
	return obj && typeof obj === "object" && Object.keys(obj).length === 0;
}

export default class FrontmatterGeneratorPlugin extends Plugin {
	settings: FrontmatterGeneratorPluginSettings;
	private lock = false;

	addCommands() {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const that = this;

		this.addCommand({
			id: "run-file",
			name: "run file",
			editorCheckCallback(checking, editor, ctx) {
				if (!ctx.file) return;
				if (checking) {
					return isMarkdownFile(ctx.file);
				}
				that.runFileSync(ctx.file, editor);
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
			editorCheckCallback: (checking: boolean, _, ctx) => {
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
			() => this.runAllFilesInFolder(folder)
		).open();
	}

	async onload() {
		await this.loadSettings();
		this.registerEventsAndSaveCallback();
		// create a command that generate frontmatter on the whole vault
		this.addCommands();
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));
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

	/**
	 * 1. check the file is ignored
	 * 2.
	 * @param file
	 * @param editor
	 */
	runFileSync(file: TFile, editor: Editor) {
		const data = getDataFromTextSync(editor.getValue());
		if (shouldIgnoreFile(this.settings, file, data)) return;
		if (!isValidFrontmatter(data)) return;
		const newText = getNewTextFromFile(
			this.settings.template,
			file,
			data,
			this
		);

		if (newText) {
			writeFile(editor, data.text, newText);
			// update the metadata editor
		}
	}

	async runFile(file: TFile) {
		// remove the selction of the current editor

		const data = await getDataFromFile(this, file);
		if (shouldIgnoreFile(this.settings, file, data)) return;
		if (!isValidFrontmatter(data)) return;
		// from the frontmatter template and the file, generate some new properties
		const newText = getNewTextFromFile(
			this.settings.template,
			file,
			data,
			this
		);
		// replace the yaml section
		if (newText) await this.app.vault.modify(file, newText);
	}

	registerEventsAndSaveCallback() {
		// add file menu item
		this.registerEvent(
			this.app.workspace.on("file-menu", async (menu, file) => {
				if (file instanceof TFile && isMarkdownFile(file)) {
					menu.addItem((item) => {
						item.setIcon("file-cog")
							.setTitle("Generate frontmatter for this file")
							.onClick(async () => {
								const activeFile =
									this.app.workspace.getActiveFile();
								const view =
									this.app.workspace.getActiveViewOfType(
										MarkdownView
									);
								const editor = view?.editor;
								const isUsingPropertiesEditor =
									view?.getMode() === "source" &&
									// @ts-ignore
									!view.currentMode.sourceMode;
								if (
									activeFile === file &&
									editor &&
									!isUsingPropertiesEditor
								) {
									this.runFileSync(file, editor);
								} else if (
									activeFile === file &&
									editor &&
									isUsingPropertiesEditor
								) {
									await this.runFile(file);
								}
							});
					});
				} else if (file instanceof TFolder) {
					menu.addItem((item) => {
						item.setIcon("file-cog")
							.setTitle("Generate frontmatter in this folder")
							.onClick(() => this.runAllFilesInFolder(file));
					});
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("modify", async (file) => {
				if (!this.settings.runOnModify) return;
				if (this.lock) return;
				try {
					if (file instanceof TFile && isMarkdownFile(file)) {
						const activeFile = this.app.workspace.getActiveFile();
						const view =
							this.app.workspace.getActiveViewOfType(
								MarkdownView
							);
						const isUsingPropertiesEditor =
							view?.getMode() === "preview" ||
							(view?.getMode() === "source" &&
								// @ts-ignore
								!view.currentMode.sourceMode);
						// the markdown preview type is not complete
						// view.currentMode.type === "source" / "preview"
						const editor = view?.editor;
						if (activeFile === file && editor) {
							if (isUsingPropertiesEditor)
								await this.runFile(file);
						} else {
							await this.runFile(file);
						}
					}
				} catch (e) {
					console.error(e);
				} finally {
					this.lock = false;
				}
			})
		);

		this.registerEvent(
			this.app.workspace.on("editor-change", async (editor) => {
				if (!this.settings.runOnModify) return;
				if (this.lock) return;
				this.lock = true;
				try {
					const file = this.app.workspace.getActiveFile();
					const view =
						this.app.workspace.getActiveViewOfType(MarkdownView);
					if (file instanceof TFile && isMarkdownFile(file)) {
						const isUsingPropertiesEditor =
							view?.getMode() === "preview" ||
							(view?.getMode() === "source" &&
								// @ts-ignore
								!view.currentMode.sourceMode);

						if (editor) {
							if (isUsingPropertiesEditor)
								await this.runFile(file);
							else {
								this.runFileSync(file, editor);
							}
						} else {
							await this.runFile(file);
						}
					}
				} catch (e) {
					console.error(e);
				} finally {
					this.lock = false;
				}
			})
		);
	}

	async runAllFiles(app: App) {
		const errorFiles: { file: TFile; error: Error }[] = [];
		let lintedFiles = 0;
		await Promise.all(
			app.vault.getMarkdownFiles().map(async (file) => {
				if (!shouldIgnoreFile(this.settings, file)) {
					try {
						await this.runFile(file);
					} catch (e) {
						errorFiles.push({ file, error: e });
					}
					lintedFiles++;
				}
			})
		);

		if (errorFiles.length === 0) {
			new Notice(
				`Obsidian Frontmatter Generator: ${lintedFiles} files are successfully updated.`,
				userClickTimeout
			);
		} else {
			new Notice(
				`Obsidian Frontmatter Generator: ${errorFiles.length} files have errors. See the developer console for more details.`,
				userClickTimeout
			);
			console.error(
				"[Frontmatter generator]: The problematic files are",
				errorFiles
			);
		}
	}

	async runAllFilesInFolder(folder: TFolder) {
		let numberOfErrors = 0;
		let lintedFiles = 0;
		const filesInFolder = getAllFilesInFolder(folder);
		await Promise.all(
			filesInFolder.map(async (file) => {
				if (!shouldIgnoreFile(this.settings, file)) {
					try {
						await this.runFile(file);
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
