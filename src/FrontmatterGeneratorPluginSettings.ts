export interface FrontmatterGeneratorPluginSettings {
	template: string;
	folderToIgnore: string;
	internal: {
		ignoredFolders: string[];
	};
}
export const DEFAULT_SETTINGS: FrontmatterGeneratorPluginSettings = {
	template: "{}",
	folderToIgnore: "",
	internal: {
		ignoredFolders: [],
	},
};
