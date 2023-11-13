import {
	App,
	Editor,
	EventRef,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	TFolder,
	stringifyYaml,
} from "obsidian";
import "@total-typescript/ts-reset";
import {
	SanitizedObject,
	evalFromExpression,
} from "@/utils/evalFromExpression";
import { deepInclude } from "./utils/deepInclude";
import { writeFile } from "./utils/obsidian";
import { ConfirmationModal } from "./ui/modals/confirmationModal";
import { SettingTab } from "./ui/SettingTab";
import {
	FrontmatterGeneratorPluginSettings,
	DEFAULT_SETTINGS,
} from "./FrontmatterGeneratorPluginSettings";
import {
	Data,
	getAllFilesInFolder,
	getDataFromFile,
	getDataFromTextSync,
	isMarkdownFile,
} from "./utils/obsidian";
import { getAPI } from "obsidian-dataview";
import { deepRemoveNull } from "./utils/deepRemoveNull";
import { z } from "zod";

import {
	EditorState,
	Extension,
	StateField,
	StateEffect,
	Transaction,
	EditorSelection,
} from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { SelectionRange } from "@codemirror/state";
import { yamlRegex } from "./utils/regex";

// Define a state effect that represents resetting the selection
const resetSelectionEffect = StateEffect.define<void>();

// Create a state field to manage the selection
const noSelectLinesField = StateField.define<boolean>({
	create() {
		return false;
	},
	update(value, tr) {
		if (tr.effects.some((e) => e.is(resetSelectionEffect))) {
			return true;
		}
		return value;
	},
});

const getYamlFromState = (state: EditorState) => {
	const docText = state.doc.toString();
	const yamlMatch = docText.match(yamlRegex);
	if (yamlMatch) {
		// YAML exists, get the match position
		const start = yamlMatch.index!;
		const end = start + yamlMatch[0].length;

		// Convert these positions to line numbers
		const startLine = state.doc.lineAt(start).number;
		const endLine = state.doc.lineAt(end).number;

		return {
			startLine,
			endLine,
			text: yamlMatch[0],
		};
	}
	return null;
};

// Extension to intercept and adjust selections
const noSelectLinesExtension: Extension = [
	noSelectLinesField,
	EditorView.updateListener.of((update: ViewUpdate) => {
		if (
			update.selectionSet ||
			update.transactions.some((tr) => tr.selection)
		) {
			const { state, dispatch } = update.view;
			const ranges = state.selection.ranges;

			const yaml = getYamlFromState(state);
			const unselectableLines = new Set<number>();

			// Make the YAML unselectable
			if (yaml) {
				const { startLine, endLine } = yaml;
				for (let line = startLine; line <= endLine; line++) {
					unselectableLines.add(line);
				}
			}

			let newRanges: SelectionRange[] = [];
			let oldRanges: SelectionRange[] = [];
			let shouldUpdate = false;

			if (yaml) {
				for (let range of ranges) {
					let fromLine = state.doc.lineAt(range.from).number;
					let toLine = state.doc.lineAt(range.to).number;

					if (
						unselectableLines.has(fromLine) ||
						unselectableLines.has(toLine)
					) {
						// the last line of yaml

						// Example: Skip adding this range if it's completely unselectable
						shouldUpdate = true;

						// push a range with out the unselectable lines
						newRanges.push(
							EditorSelection.range(
								// anchor - the end of unslectable lines
								state.doc.line(yaml.endLine + 1).from,
								// head
								state.doc.line(toLine).to
							)
						);
						continue;
					}

					// Add the range as is if it's selectable
					oldRanges.push(range);
				}
			}

			if (shouldUpdate) {
				const selection = EditorSelection.create(
					// remove the unselectable lines
					newRanges as readonly SelectionRange[]
				);
				// for each new ranges, run selection.addRange

				for (let range of newRanges) {
					selection.addRange(range);
				}

				// Create a new transaction with the updated selection
				const tr = state.update({
					selection: selection,
				});
				dispatch(tr);
			}
		}
	}),
];

const userClickTimeout = 5000;

enum YamlKey {
	IGNORE = "yaml-gen-ignore",
}

const isIgnoredByFolder = (
	settings: FrontmatterGeneratorPluginSettings,
	file: TFile
) => {
	return settings.internal.ignoredFolders.includes(
		file.parent?.path as string
	);
};

function shouldIgnoreFile(
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

function createNotice(
	message: string,
	color: "white" | "yellow" | "red" = "white"
) {
	const fragment = new DocumentFragment();
	const desc = document.createElement("div");
	desc.setText(`Obsidian Frontmatter Generator: ${message}`);
	desc.style.color = color;
	fragment.appendChild(desc);

	new Notice(fragment);
}

function isObjectEmpty(obj: SanitizedObject) {
	return obj && typeof obj === "object" && Object.keys(obj).length === 0;
}

/**
 *
 * @param settings
 * @param file
 * @param data
 * @returns if there is no change, return undefined, else return the new text
 */
function getNewTextFromFile(
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

export default class FrontmatterGeneratorPlugin extends Plugin {
	settings: FrontmatterGeneratorPluginSettings;
	private eventRefs: EventRef[] = [];
	private previousSaveCommand: () => void;

	addCommands() {
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

		this.registerEditorExtension(noSelectLinesExtension);
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

	/**
	 * 1. check the file is ignored
	 * 2.
	 * @param file
	 * @param editor
	 */
	runFileSync(file: TFile, editor: Editor) {
		const data = getDataFromTextSync(editor.getValue());
		if (shouldIgnoreFile(this.settings, file, data)) return;
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
		const data = await getDataFromFile(this, file);
		if (shouldIgnoreFile(this.settings, file, data)) return;

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
		const saveCommandDefinition =
			this.app.commands.commands["editor:save-file"];
		this.previousSaveCommand = saveCommandDefinition.callback;

		const eventRef = this.app.workspace.on(
			"file-menu",
			async (menu, file) => {
				if (file instanceof TFile && isMarkdownFile(file)) {
					menu.addItem((item) => {
						item.setTitle(
							"Generate frontmatter for this file"
						).onClick(async () => {
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
						item.setTitle(
							"Generate frontmatter in this folder"
						).onClick(() => this.runAllFilesInFolder(file));
					});
				}
			}
		);
		this.registerEvent(eventRef);
		this.eventRefs.push(eventRef);

		const eventRef2 = this.app.vault.on("modify", async (file) => {
			if (!this.settings.runOnModify) return;
			if (file instanceof TFile && isMarkdownFile(file)) {
				const activeFile = this.app.workspace.getActiveFile();
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				const isUsingPropertiesEditor =
					view?.getMode() === "preview" ||
					(view?.getMode() === "source" &&
						// @ts-ignore
						!view.currentMode.sourceMode);
				// the markdown preview type is not complete
				// view.currentMode.type === "source" / "preview"
				const editor = view?.editor;
				if (activeFile === file && editor) {
					if (isUsingPropertiesEditor) await this.runFile(file);
				} else {
					await this.runFile(file);
				}
			}
		});
		this.registerEvent(eventRef2);
		this.eventRefs.push(eventRef2);

		const eventRef3 = this.app.workspace.on(
			"editor-change",
			async (editor) => {
				const file = this.app.workspace.getActiveFile();
				const view =
					this.app.workspace.getActiveViewOfType(MarkdownView);
				if (file instanceof TFile && isMarkdownFile(file)) {
					const isUsingPropertiesEditor =
						view?.getMode() === "preview" ||
						(view?.getMode() === "source" &&
							// @ts-ignore
							!view.currentMode.sourceMode);

					if (file === file && editor) {
						if (isUsingPropertiesEditor) await this.runFile(file);
						else this.runFileSync(file, editor);
					} else {
						await this.runFile(file);
					}
				}
			}
		);
		this.registerEvent(eventRef3);
		this.eventRefs.push(eventRef3);

		saveCommandDefinition.callback = async () => {
			// get the editor and file
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			const editor = view?.editor;
			const file = this.app.workspace.getActiveFile();
			if (!editor || !file) return;
			// if it is not using source mode editor, return
			// @ts-ignore
			const isUsingPropertiesEditor =
				view?.getMode() === "source" &&
				// @ts-ignore
				!view.currentMode.sourceMode;
			if (editor && !isUsingPropertiesEditor) {
				this.runFileSync(file, editor);
			} else if (editor && isUsingPropertiesEditor) {
				await this.runFile(file);

				// this hack focus the metacache of this file to be prioritized
				// focus the first property
				// @ts-ignore
				view.metadataEditor.focusPropertyAtIndex(0);
				// focus the editor
				editor.focus();
			}

			// run the previous save command
			if (typeof this.previousSaveCommand === "function") {
				this.previousSaveCommand();
			}

			// defines the vim command for saving a file and lets the linter run on save for it
			// accounts for https://github.com/platers/obsidian-linter/issues/19
			const that = this;
			window.CodeMirrorAdapter.commands.save = () => {
				that.app.commands.executeCommandById("editor:save-file");
			};
		};
	}

	unregisterEventsAndSaveCallback() {
		for (const eventRef of this.eventRefs) {
			this.app.workspace.offref(eventRef);
		}
		const saveCommandDefinition =
			this.app.commands.commands["editor:save-file"];
		saveCommandDefinition.callback = this.previousSaveCommand;
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
