export interface FrontmatterGeneratorPluginSettings {
	template: string;
	folderToIgnore: string;
	internal: {
		ignoredFolders: string[];
	};
	/**
	 * run on modify when user is not in the file
	 */
	runOnModifyNotInFile: boolean;
	/**
	 * run on modify when user is in the file
	 */
	runOnModifyInFile: boolean;
	sortYamlKey: boolean;
}
export const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "{}",
	folderToIgnore: "",
	internal: {
		ignoredFolders: [],
	},
	runOnModifyNotInFile: false,
	runOnModifyInFile: false,
	sortYamlKey: true,
};
