const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(`ERROR: ${message}`);
  console.error("No damage — failed before writing.");
  process.exitCode = 1;
}

function normalizeLineEndings(value) {
  return String(value).replace(/\r\n/g, "\n");
}

function detectLineEnding(value) {
  return String(value).includes("\r\n") ? "\r\n" : "\n";
}

function restoreLineEndings(value, lineEnding) {
  return normalizeLineEndings(value).replace(/\n/g, lineEnding);
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;

  let count = 0;
  let position = 0;

  while (true) {
    const index = haystack.indexOf(needle, position);

    if (index === -1) break;

    count += 1;
    position = index + needle.length;
  }

  return count;
}

function usage() {
  console.log(`
Graymills Safe Patch Helper

Usage:
  node .\\scripts\\safe-patch.cjs <spec-file.json>
  node .\\scripts\\safe-patch.cjs <spec-file.json> --apply

Default behavior:
  Validates all edits without changing source files.

With --apply:
  Creates timestamped backups and applies the validated edits.

Spec format:
{
  "revision": "rev-2.85",
  "description": "Example patch",
  "backupRoot": "C:\\\\apps\\\\prospecting-tool-backups",
  "files": [
    {
      "path": "src/app/example.ts",
      "operations": [
        {
          "label": "Add example line",
          "find": "old text",
          "replace": "new text",
          "expectedMatches": 1
        }
      ]
    }
  ]
}
`);
}

const args = process.argv.slice(2);
const applyChanges = args.includes("--apply");
const specArgument = args.find((arg) => arg !== "--apply");

if (!specArgument) {
  usage();
  process.exit(0);
}

const projectRoot = process.cwd();
const specPath = path.resolve(projectRoot, specArgument);

if (!fs.existsSync(specPath)) {
  fail(`Patch specification not found: ${specPath}`);
  return;
}

let spec;

try {
  spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
} catch (error) {
  fail(
    `Could not parse patch specification: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  return;
}

if (!spec || typeof spec !== "object") {
  fail("Patch specification must be a JSON object.");
  return;
}

if (!spec.revision || typeof spec.revision !== "string") {
  fail("Patch specification requires a revision string.");
  return;
}

if (!Array.isArray(spec.files) || spec.files.length === 0) {
  fail("Patch specification requires at least one file.");
  return;
}

const preparedFiles = [];

try {
  for (const fileSpec of spec.files) {
    if (!fileSpec.path || typeof fileSpec.path !== "string") {
      throw new Error("Every file entry requires a path.");
    }

    if (
      !Array.isArray(fileSpec.operations) ||
      fileSpec.operations.length === 0
    ) {
      throw new Error(
        `File ${fileSpec.path} requires at least one operation.`
      );
    }

    const absolutePath = path.resolve(projectRoot, fileSpec.path);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Source file not found: ${fileSpec.path}`);
    }

    const originalText = fs.readFileSync(absolutePath, "utf8");
    const lineEnding = detectLineEnding(originalText);

    let updatedText = normalizeLineEndings(originalText);

    for (const operation of fileSpec.operations) {
      const label =
        operation.label || `${fileSpec.path} unnamed operation`;

      if (
        typeof operation.find !== "string" ||
        typeof operation.replace !== "string"
      ) {
        throw new Error(
          `${label}: find and replace must both be strings.`
        );
      }

      const normalizedFind = normalizeLineEndings(operation.find);
      const normalizedReplace = normalizeLineEndings(operation.replace);
      const expectedMatches =
        Number.isInteger(operation.expectedMatches)
          ? operation.expectedMatches
          : 1;

      const matchCount = countOccurrences(
        updatedText,
        normalizedFind
      );

      if (matchCount !== expectedMatches) {
        throw new Error(
          `${label}: expected ${expectedMatches} match(es), found ${matchCount}.`
        );
      }

      updatedText = updatedText.split(normalizedFind).join(
        normalizedReplace
      );

      console.log(
        `VALIDATED: ${label} (${matchCount} match${
          matchCount === 1 ? "" : "es"
        })`
      );
    }

    if (updatedText === normalizeLineEndings(originalText)) {
      throw new Error(
        `${fileSpec.path}: operations produced no change.`
      );
    }

    preparedFiles.push({
      relativePath: fileSpec.path,
      absolutePath,
      originalText,
      updatedText: restoreLineEndings(updatedText, lineEnding),
    });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  return;
}

console.log("");
console.log(
  `CHECK PASSED: ${spec.revision}${
    spec.description ? ` — ${spec.description}` : ""
  }`
);
console.log(`FILES READY: ${preparedFiles.length}`);

if (!applyChanges) {
  console.log("CHECK-ONLY MODE: No source files changed.");
  console.log(
    `Run again with --apply to create backups and write the changes.`
  );
  return;
}

const backupRoot =
  typeof spec.backupRoot === "string" && spec.backupRoot.trim()
    ? spec.backupRoot
    : path.join(projectRoot, "..", "prospecting-tool-backups");

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, "-");

const backupDirectory = path.join(
  backupRoot,
  `${spec.revision}-${timestamp}`
);

fs.mkdirSync(backupDirectory, { recursive: true });

try {
  for (const file of preparedFiles) {
    const backupPath = path.join(
      backupDirectory,
      `${file.relativePath.replace(/[\\/]/g, "__")}.bak`
    );

    fs.writeFileSync(backupPath, file.originalText, "utf8");
  }

  for (const file of preparedFiles) {
    fs.writeFileSync(
      file.absolutePath,
      file.updatedText,
      "utf8"
    );

    console.log(`WRITTEN: ${file.relativePath}`);
  }
} catch (error) {
  console.error(
    `WRITE ERROR: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
  console.error(`Backups are available at: ${backupDirectory}`);
  process.exitCode = 1;
  return;
}

console.log("");
console.log(`PATCH APPLIED: ${spec.revision}`);
console.log(`BACKUP: ${backupDirectory}`);
