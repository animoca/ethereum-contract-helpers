const {ethers} = require('hardhat');
const {getArtifactFromFolders} = require('hardhat-deploy/dist/src/utils');

async function deployContract(name, ...args) {
  const contract = await (await ethers.getContractFactoryFromArtifact(await deployments.getArtifact(name))).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function deployContractFromPath(name, path, ...args) {
  const artifact = await getArtifactFromFolders(name, [path]);
  const contract = await (await ethers.getContractFactory(artifact.abi, artifact.bytecode)).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

module.exports = {
  deployContract,
  deployContractFromPath,
};
