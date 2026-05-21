import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return "";
  }

  return args[index + 1] || "";
}

const title = readArg("--title").trim();
const description = readArg("--description").trim();

if (!title) {
  console.error("Uso: npm run changelog:add -- --title \"Titulo\" --description \"Descricao\"");
  process.exit(1);
}

const content = [
  `Title: ${title}`,
  "Description:",
  description,
  "",
].join("\n");

writeFileSync(".changelog-next.md", content);
