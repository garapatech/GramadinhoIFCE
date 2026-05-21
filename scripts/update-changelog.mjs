import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const CHANGELOG_PATH = "CHANGELOG.md";
const DRAFT_PATH = ".changelog-next.md";
const IGNORED_PATHS = new Set([
  "CHANGELOG.md",
  ".changelog-next.md",
  ".githooks/pre-commit",
  "scripts/add-changelog-entry.mjs",
  "scripts/update-changelog.mjs",
]);

function parseDraft(raw) {
  const lines = raw
    .split("\n")
    .map((line) => line.trimEnd());

  let title = "";
  let descriptionLines = [];
  let mode = "";

  for (const line of lines) {
    if (line.startsWith("Title:")) {
      title = line.slice("Title:".length).trim();
      mode = "";
      continue;
    }

    if (line.startsWith("Description:")) {
      mode = "description";
      const inline = line.slice("Description:".length).trim();
      if (inline) {
        descriptionLines.push(inline);
      }
      continue;
    }

    if (mode === "description") {
      descriptionLines.push(line);
    }
  }

  return {
    title,
    description: descriptionLines.join("\n").trim(),
  };
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function safeGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function parseNameStatus(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t");
      return { status, path: rest.at(-1) };
    })
    .filter((entry) => entry.path && !IGNORED_PATHS.has(entry.path));
}

function parseNumStat(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [added, removed, file] = line.split("\t");
      return { added, removed, file };
    })
    .filter((entry) => entry.file && !IGNORED_PATHS.has(entry.file));
}

const stagedFiles = parseNameStatus(
  safeGit(["diff", "--cached", "--name-status", "--diff-filter=ACDMRTUXB"]),
);

if (stagedFiles.length === 0) {
  process.exit(0);
}

const stats = parseNumStat(safeGit(["diff", "--cached", "--numstat"]));
const additions = stats.reduce(
  (total, entry) => total + (entry.added === "-" ? 0 : Number(entry.added)),
  0,
);
const deletions = stats.reduce(
  (total, entry) => total + (entry.removed === "-" ? 0 : Number(entry.removed)),
  0,
);

if (stagedFiles.length === 0 && additions === 0 && deletions === 0) {
  process.exit(0);
}

const branch = safeGit(["branch", "--show-current"]) || "detached";
const diffFingerprint = safeGit(["diff", "--cached", "--patch", "--minimal"]);
const marker = `<!-- changelog:${Buffer.from(diffFingerprint).toString("base64url").slice(0, 24)} -->`;
const currentContent = existsSync(CHANGELOG_PATH)
  ? readFileSync(CHANGELOG_PATH, "utf8")
  : "# Changelog\n\n";

if (currentContent.includes(marker)) {
  process.exit(0);
}

const now = new Date();
const timestamp = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "America/Fortaleza",
  hour12: false,
}).format(now);

const fileLines = stagedFiles
  .map(({ status, path }) => `- \`${path}\` (${status})`)
  .join("\n");

const draft = existsSync(DRAFT_PATH)
  ? parseDraft(readFileSync(DRAFT_PATH, "utf8"))
  : { title: "", description: "" };

const title = draft.title || `Atualizacao em ${stagedFiles[0].path}`;

const descriptionBlock = draft.description
  ? ["### Descricao", draft.description, ""]
  : [];

const entry = [
  `## ${title}`,
  marker,
  `- Data: ${timestamp}`,
  `- Branch: \`${branch}\``,
  `- Summary: ${stagedFiles.length} arquivo(s), ${additions} insercao(oes), ${deletions} remocao(oes)`,
  ...descriptionBlock,
  "### Arquivos",
  "- Files:",
  fileLines,
  "",
].join("\n");

const nextContent = `${currentContent.trimEnd()}\n\n${entry}\n`;
writeFileSync(CHANGELOG_PATH, nextContent);
execFileSync("git", ["add", CHANGELOG_PATH]);

if (existsSync(DRAFT_PATH)) {
  unlinkSync(DRAFT_PATH);
}
