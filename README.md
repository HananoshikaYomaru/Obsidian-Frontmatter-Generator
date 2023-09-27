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
```

will generate this in the file `Good recipes/scrambled egg.md`

```
folder: Good recipes
title: scrambled egg
```

### Syntax of the frontmatter template

The syntax is not a yaml! It is just a map from a key to value. Each key-value pair is separated by new line.

## Note

1. to stop generate on a file, you can put `yaml-gen-ignore: true` on the frontmatter.

<!--
## How to release

```
bun version
git tag -a <version> -m <version>
git push origin <version>
git push

# after the release workflow done, update the release doc on github
```
 -->
