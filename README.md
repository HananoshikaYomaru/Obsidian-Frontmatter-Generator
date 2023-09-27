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
test: [1, 2, 3]
```

will generate this in the file `Good recipes/scrambled egg.md`

```
folder: Good recipes
title: scrambled egg
test:
  - "1"
  - "2"
```

### Syntax of the frontmatter template

It is just a json

## Note

1. to stop generate on a file, you can put `yaml-gen-ignore: true` on the frontmatter. You can also ignore the whole folder in the seting.
2. the context that you can access is [TFile](https://docs.obsidian.md/Reference/TypeScript+API/TFile/TFile). This can be update in the future. It is extremely flexible.
3. If you want to contribute, first open an issue.

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
