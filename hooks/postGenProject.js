import fs from "fs-extra";
import path from "path";

const CTX = {
  pkgManager: "{{ dkcutter.pkgManager }}",
  useAppFolder: "{{ useAppFolder }}" === "true",
  useLinters: "{{ useLinters }}" === "true",
  useHusky: "{{ useHusky }}" === "true",
  useLintStaged: "{{ useLintStaged }}" === "true",
  useEnvValidator: "{{ useEnvValidator }}" === "true",
  database: "{{ database }}",
  useDockerCompose: "{{ useDockerCompose }}" === "true",
};

function appendToGitignore(gitignorePath, lines) {
  fs.appendFileSync(gitignorePath, lines);
}

function removeFiles(files) {
  files.forEach((file) => fs.removeSync(file));
}

function updatePackageJson({
  removeDeps = [],
  removeDevDeps = [],
  scripts = {},
  keys = [],
  projectDir,
}) {
  const packageJsonPath = path.join(projectDir, "package.json");
  const packageJson = fs.readJSONSync(packageJsonPath);

  removeDeps.forEach((dependency) => {
    delete packageJson.dependencies?.[dependency];
  });
  removeDevDeps.forEach((dependency) => {
    delete packageJson.devDependencies?.[dependency];
  });
  packageJson.scripts = { ...packageJson.scripts, ...scripts };
  keys.forEach((key) => {
    delete packageJson[key];
  });

  fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });

  return packageJson;
}

function updateEslint({ projectDir, extendsConfig = [] }) {
  const eslintPath = path.join(projectDir, ".eslintrc");
  const eslintJson = fs.readJsonSync(eslintPath);

  const extendsSet = new Set(eslintJson.extends);

  extendsConfig.forEach((extend) => {
    if (extendsSet.has(extend)) {
      extendsSet.delete(extend);
    } else {
      extendsSet.add(extend);
    }
  });

  eslintJson.extends = Array.from(extendsSet).sort();
  fs.writeJsonSync(eslintPath, eslintJson, { spaces: 2 });

  return eslintJson;
}

async function main() {
  const projectDir = path.resolve("{{ projectSlug }}");
  const srcFolder = path.join(projectDir, "src");
  const publicFolder = path.join(projectDir, "public");

  const gitignorePath = path.join(projectDir, ".gitignore");
  appendToGitignore(gitignorePath, "\n# local env files\n.env*.local\n.env\n");

  if (CTX.useAppFolder) {
    fs.removeSync(path.join(srcFolder, "pages"));
  } else {
    const stylesFolder = path.join(srcFolder, "styles");
    fs.mkdirSync(stylesFolder);
    fs.moveSync(
      path.join(srcFolder, "app", "globals.css"),
      path.join(stylesFolder, "globals.css"),
    );
    removeFiles([
      path.join(publicFolder, ".gitkeep"),
      path.join(srcFolder, "app"),
    ]);
  }

  if (CTX.useLinters) {
    updatePackageJson({
      projectDir,
      scripts: {
        lint: "next lint --dir . && eslint . && prettier . -c",
        "lint:fix": "eslint --fix . && prettier . -w",
      },
    });
  } else {
    updatePackageJson({
      projectDir,
      removeDevDeps: ["prettier-plugin-tailwindcss", "@dkshs/eslint-config"],
    });
    updateEslint({ projectDir, extendsConfig: ["@dkshs/eslint-config/react"] });
    removeFiles([
      path.join(projectDir, "prettier.config.js"),
      path.join(projectDir, ".prettierignore"),
    ]);
  }

  if (CTX.useHusky) {
    updatePackageJson({ projectDir, scripts: { prepare: "husky install" } });
  } else {
    updatePackageJson({ projectDir, removeDevDeps: ["husky"] });
    fs.removeSync(path.join(projectDir, ".husky"));
  }

  if (CTX.useLintStaged) {
    updatePackageJson({ projectDir, scripts: { "pre-commit": "lint-staged" } });
  } else {
    updatePackageJson({
      projectDir,
      removeDevDeps: ["lint-staged"],
      keys: ["lint-staged"],
    });
  }

  if (!CTX.useEnvValidator) {
    fs.removeSync(path.join(srcFolder, "env.mjs"));
    updatePackageJson({
      projectDir,
      removeDeps: ["@t3-oss/env-nextjs", "zod"],
    });
  }

  if (CTX.database === "none") {
    updatePackageJson({
      projectDir,
      removeDevDeps: ["prisma"],
    });
    removeFiles([path.join(projectDir, "prisma"), path.join(srcFolder, "lib")]);
  } else if (CTX.database === "prisma") {
    updatePackageJson({
      projectDir,
      scripts: { postinstall: "prisma generate" },
    });
  }

  if (!CTX.useDockerCompose) {
    fs.removeSync(path.join(projectDir, "docker-compose.yml"));
  }
}

main();
