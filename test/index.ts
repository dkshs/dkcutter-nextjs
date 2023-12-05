import path from "node:path";
import { execa } from "execa";
import fs from "fs-extra";

import { logger } from "./logger";

const PATTERN = /{{(\s?dkcutter)[.](.*?)}}/;

const SUPPORTED_COMBINATIONS = [
  { useHusky: true },
  { useHusky: false },
  { useLintStaged: true, useHusky: true },
  { useLintStaged: false },
  { useLinters: true },
  { useLinters: false },
  { useAppFolder: true },
  { useAppFolder: false },
  { database: "prisma" },
  { database: "none" },
  { database: "prisma", useDockerCompose: true },
  { useEnvValidator: true },
  { useEnvValidator: false },
];
const UNSUPPORTED_COMBINATIONS = [{ database: "XXXXXX" }];
const INVALID_SLUGS = ["", " ", "Test", "teSt", "tes1@", "t!es"];

/**
 * Build a list containing absolute paths to the generated files.
 */
function buildFilesList(baseDir: string) {
  const files = fs.readdirSync(baseDir);
  const paths: string[] = [];
  files.forEach((file) => {
    const filePath = path.join(baseDir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      paths.push(...buildFilesList(filePath));
    } else {
      paths.push(filePath);
    }
  });
  return paths;
}

/**
 * Method to check all paths have correct substitutions.
 */
function checkPaths(paths: string[]) {
  for (const path of paths) {
    const content = fs.readFileSync(path, "utf-8");
    const matches = content.match(PATTERN);
    if (matches) {
      throw new Error(
        `Found match in ${path} at line ${matches.index} with value ${matches[0]}`,
      );
    }
  }
}

async function generateProject(args: string[] = [], output: string = ".test") {
  logger.info(
    `Generating project ${args[1]} with args: ${args.slice(2).join(" ")}`,
  );
  await execa("pnpm", ["generate", "-o", output, ...args, "-y"]);
  const paths = buildFilesList(path.join(output, args[1]));
  checkPaths(paths);
  logger.success(`✓ Project ${args[1]} generated`);
}

function generateRandomString(n: number) {
  const characters = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < n; i++) {
    const index = Math.floor(Math.random() * characters.length);
    result += characters.charAt(index);
  }
  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function constructArgs(combination: { [key: string]: any }) {
  const args = ["--projectName", generateRandomString(8)];
  for (const [item, value] of Object.entries(combination)) {
    args.push(`--${item}`, value);
  }
  return args;
}

async function testCMDPassesFunc(
  cmd: string,
  projectDir: string,
  args: string[] = [],
) {
  const cmdCapitalized = cmd.charAt(0).toUpperCase() + cmd.slice(1);
  const result = await execa(cmd, args, { cwd: projectDir });
  if (result.failed) {
    throw new Error(`${cmdCapitalized} failed`);
  }
  logger.success(`✓ ${cmdCapitalized} passed`);
}

async function testEslintPasses(projectDir: string) {
  await testCMDPassesFunc("eslint", projectDir);
}

async function testPrettierPasses(projectDir: string) {
  const ignore = ["--ignore-path", path.resolve(".prettierignore")];
  const args = [".", "-c", ...ignore];
  await testCMDPassesFunc("prettier", projectDir, args);
}

async function main() {
  let test = ".test";
  await fs.ensureDir(test);
  test = path.resolve(test);
  let testsPassed = 0;

  for (const combination of SUPPORTED_COMBINATIONS) {
    const args = constructArgs(combination);
    try {
      await generateProject(args);
      const projectDir = path.join(test, args[1]);
      await testEslintPasses(projectDir);
      await testPrettierPasses(projectDir);
      logger.success(`✓ All checks passed for project ${args[1]}`);
      logger.break();
      testsPassed += 3;
    } catch (e) {
      logger.error(
        `Failed to generate project ${args[1]} with args: ${args
          .slice(2)
          .join(" ")}`,
      );
      logger.error(e.message);
      process.exit(1);
    }
  }

  let pass = 0;
  for (const combination of UNSUPPORTED_COMBINATIONS) {
    const args = constructArgs(combination);
    try {
      await generateProject(args);
    } catch (e) {
      logger.success(
        `✓ Expected error when creating project ${args[1]} with args: ${args
          .slice(2)
          .join(" ")}`,
      );
      logger.break();
      pass += 1;
      testsPassed += 1;
      continue;
    }
  }
  if (pass !== UNSUPPORTED_COMBINATIONS.length) {
    logger.error(
      `Unsupported Combinations: Expected ${UNSUPPORTED_COMBINATIONS.length} errors, but got ${pass}`,
    );
    process.exit(1);
  }

  pass = 0;
  for (const slug of INVALID_SLUGS) {
    const args = constructArgs({ projectSlug: slug });
    try {
      await generateProject(args);
    } catch (e) {
      logger.success(
        `✓ Expected error when creating project ${args[1]} with slug "${slug}"`,
      );
      logger.break();
      pass += 1;
      testsPassed += 1;
      continue;
    }
  }
  if (pass !== INVALID_SLUGS.length) {
    logger.error(
      `Project Slug: Expected ${INVALID_SLUGS.length} errors, but got ${pass}`,
    );
    process.exit(1);
  }

  logger.info(`Tests Passed: ${testsPassed}`);
  logger.success("✓ All tests passed");
  await fs.remove(test);
}

main();