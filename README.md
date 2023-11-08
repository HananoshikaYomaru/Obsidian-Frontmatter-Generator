# Obsidian frontmatter generator

Generate your frontmatter on save.

✅ Powerful, dead simple

## Usage

1. after install the plugin, visit the setting of the plugin
2. change the frontmatter template

for example, the following frontmatter template

```ts
{
 folder: file.parent.path;
 title: file.basename;
 test: ["1", "2"];
}
```

will generate this in the file `Good recipes/scrambled egg.md` on save.

```yaml
folder: Good recipes
title: scrambled egg
test:
    - "1"
    - "2"
```

- Basic Demo: <https://youtu.be/Cz9d5e1WQVM>
- Tag properties demo: https://www.youtube.com/watch?v=lyhrOG2Sn88&t=16

## Advanced usage

### conditional expression

```ts
file.properties?.type === "kanban"
 ? {
   folder: file.parent.path,
   title: file.basename,
   }
 : {};
```

### function

```ts
{
 test: (() => {
  return { test: "test" };
 })();
}
```

### Dataview

```ts
{
 numberOfPages: dv.pages("#ai").length;
}
```

## Syntax of the frontmatter template

It could be a json or a javascript expression that return an object.

![](https://share.cleanshot.com/nfW5nV8L+)

<small>^ even functions work</small>

## Variable that it can access

- `file`, the [`TFile`](https://docs.obsidian.md/Reference/TypeScript+API/TFile/TFile) object
- `file.properties` will access the yaml object of the current file
- `file.tags` will access the tags of the current file
- `dv`, the [dataview](https://blacksmithgu.github.io/obsidian-dataview/) object (you can only access this if you install and enable the dataview plugin)
- `z`, the zod object

## Installation

### Install on obsidian plugin marketplace

⏳ Still waiting for review and approval: <https://github.com/obsidianmd/obsidian-releases/pull/2502>

### Manual Install

1. cd to `.obsidian/plugins`
2. git clone this repo
3. `cd obsidian-frontmatter-generator && bun install && bun run build`
4. there you go 🎉

## Note

1. to stop generate on a file, you can put `yaml-gen-ignore: true` on the frontmatter. You can also ignore the whole folder in the seting.
2. the context that you can access is [TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile/TFile). This can be update in the future. It is extremely flexible.
3. This plugin also comes with some command to run in folder and in the whole vault.
4. If you want to contribute, first open an issue.
5. 🚨 This plugin is still under development, don't try to hack it by using weird keywords or accessing global variables in the template. It should not work but if you figure out a way to hack it, it will just break your own vault.

<!--
## How to release

```
# update the version number in package.json
bun version
git add .
git commit -m <message>
git tag -a <version> -m <version>
git push origin <version>
git push
# after the release workflow done, update the release doc on github
```

 -->
