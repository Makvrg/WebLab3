import os

output_file = "project_code.md"
root_dir = "."

LANG_MAP = {
    ".ts": "typescript",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".js": "javascript",
    ".json": "json",
    ".java": "java",
    ".xml": "xml",
    ".sql": "sql",
    ".properties": "properties",
    ".md": "markdown",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".sh": "bash",
}

SPECIAL_FILES = {
    "Dockerfile": "dockerfile",
    "docker-compose.yml": "yaml",
    "docker-compose.yaml": "yaml",
    ".gitignore": "text",
    ".editorconfig": "text",
    ".prettierrc": "json",
}

EXCLUDE_DIRS = {
    "node_modules",
    ".angular",
    "dist",
    "target",
    ".git",
    ".idea",
    ".vscode",
}

EXCLUDE_FILES = {
    output_file,
    "package-lock.json",
    "favicon.ico",
    ".DS_Store",
}


def is_excluded_dir(dir_name: str, current_root: str) -> bool:
    if dir_name in EXCLUDE_DIRS:
        return True

    if dir_name.lower() == "tomee":
        normalized_path = os.path.normpath(current_root).split(os.sep)
        if "backend" in normalized_path:
            return True

    return False


def get_language(filename: str) -> str | None:
    if filename in SPECIAL_FILES:
        return SPECIAL_FILES[filename]
    _, ext = os.path.splitext(filename)
    return LANG_MAP.get(ext.lower())


with open(output_file, "w", encoding="utf-8") as out:
    for root, dirs, files in os.walk(root_dir):
        dirs[:] = [d for d in dirs if not is_excluded_dir(d, root)]

        for f in sorted(files):
            if f in EXCLUDE_FILES:
                continue

            lang = get_language(f)
            if lang:
                path = os.path.join(root, f)
                rel_path = os.path.normpath(path)
                try:
                    with open(path, "r", encoding="utf-8", errors="replace") as src:
                        content = src.read()
                    out.write(f"## {rel_path}\n\n```{lang}\n{content}\n```\n\n---\n\n")
                    print(f"Добавлен: {rel_path}")
                except Exception as e:
                    print(f"Ошибка {path}: {e}")

print(f"\nГотово! Результат сохранён в {output_file}")
