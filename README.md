# Obsidian frontmatter generator

Generate your frontmatter on save.

✅ Powerful, dead simple

## Usage

1. after install the plugin, visit the setting of the plugin
2. change the frontmatter template

for example, the following frontmatter template

```
folder: file.folder
title: file.title
test: ["1", "2"]
```

will generate this in the file `Good recipes/scrambled egg.md` on save.

```
folder: Good recipes
title: scrambled egg
test:
  - "1"
  - "2"
```

Demo: https://youtu.be/Cz9d5e1WQVM

### Syntax of the frontmatter template

It is just a json. It can access the [TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile/TFile) and do javascript operation

![](https://share.cleanshot.com/nfW5nV8L+)

<small>^ even functions work</small>

![](https://share.cleanshot.com/2bH8BXRg+)

<small>^ async function doesn't work</small>

## Installation

## Install on obsidian plugin marketplace

⏳ Still waiting for review and approval:

## Manual Install

1. cd to `.obsidian/plugins`
2. git clone this repo
3. `cd obsidian-frontmatter-generator && bun install && bun run build`
4. there you go 🎉

## Note

1. to stop generate on a file, you can put `yaml-gen-ignore: true` on the frontmatter. You can also ignore the whole folder in the seting.
2. the context that you can access is [TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile/TFile). This can be update in the future. It is extremely flexible.
3. This plugin also
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
