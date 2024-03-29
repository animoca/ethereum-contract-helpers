const fse = require('fs-extra');
const path = require('path');
const {globSync} = require('glob');
const {TASK_FLATTEN_GET_FLATTENED_SOURCE} = require('hardhat/builtin-tasks/task-names');
const {extendConfig, task} = require('hardhat/config');
const {normalizePath} = require('../utils');

extendConfig((config, userConfig) => {
  config.paths.flattened = normalizePath(config, userConfig.paths ? userConfig.paths.flattened : undefined, 'flattened');
});

task('flatten-all', 'Flattens and saves each individual solidity file', async (taskArguments, env) => {
  const contractsPath = path.relative(process.cwd(), env.config.paths.sources);
  const files = globSync(`${contractsPath}/**/*.sol`);
  for (const file of files) {
    const source = await env.run(TASK_FLATTEN_GET_FLATTENED_SOURCE, {
      files: [file],
    });

    const regex1 = /\n\/\/ SPDX.*\n/gm;

    let i = 0;
    const newSource = source.replace(regex1, (m) => (!i++ ? m : ''));

    fse.mkdirpSync(path.join(env.config.paths.flattened, path.dirname(file)));
    fse.writeFileSync(path.join(env.config.paths.flattened, file), newSource);
  }
});
