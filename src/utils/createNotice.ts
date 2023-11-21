import { Notice } from "obsidian";

export function createNotice(
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
