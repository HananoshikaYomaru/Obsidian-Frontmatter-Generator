export interface FrontmatterGeneratorPluginSettings {
	template: string;
	folderToIgnore: string;
	internal: {
		ignoredFolders: string[];
	};
	sortYamlKey: boolean;
}
export const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "{}",
	folderToIgnore: "",
	internal: {
		ignoredFolders: [],
	},
	sortYamlKey: true,
};
