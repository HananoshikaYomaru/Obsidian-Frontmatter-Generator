export interface FrontmatterGeneratorPluginSettings {
	template: string;
	folderToIgnore: string;
	internal: {
		ignoredFolders: string[];
	};
	runOnModify: boolean;
	sortYamlKey: boolean;
}
export const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "{}",
	folderToIgnore: "",
	internal: {
		ignoredFolders: [],
	},
	runOnModify: false,
	sortYamlKey: true,
};
