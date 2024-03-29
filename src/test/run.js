const {ethers} = require('hardhat');
const {expect} = require('chai');
const {getArtifactFromFolders} = require('hardhat-deploy/dist/src/utils');

const {deployContract, deployContractFromPath} = require('./deploy');
const {deployDiamond, facetInit, mergeABIs} = require('./diamond');

async function buildDefaultArguments(defaultArguments) {
  const result = {};
  if (defaultArguments === undefined) return result;

  for (const key of Object.keys(defaultArguments)) {
    const value = defaultArguments[key];
    if (typeof value === 'function') {
      result[key] = await value();
    } else {
      result[key] = value;
    }
  }
  return result;
}

function runBehaviorTests(name, config, behaviorFn) {
  async function deployAsImmutableContract(args = {}) {
    const defaultArguments = await buildDefaultArguments(config.defaultArguments);
    const arguments_ = {...defaultArguments, ...args};
    const ctorArguments = config.immutable.ctorArguments !== undefined ? config.immutable.ctorArguments.map((arg) => arguments_[arg]) : [];
    const abiExtensions = config.abiExtensions !== undefined ? config.abiExtensions : [];

    const artifact = await deployments.getArtifact(config.immutable.name);
    const abi = [...artifact.abi];
    const extensionABIs = [];
    for (const extension of abiExtensions) {
      const extensionArtifact = await deployments.getArtifact(extension);
      extensionABIs.push(extensionArtifact.abi);
    }
    mergeABIs(abi, extensionABIs, (el) => el.type !== 'constructor');
    const Contract = await ethers.getContractFactory(abi, artifact.bytecode);
    const contract = await Contract.deploy(...ctorArguments);
    await contract.waitForDeployment();
    return contract;
  }

  async function deployAsDiamondFacet(args = {}) {
    const facets = [...config.diamond.facets];
    const defaultArguments = await buildDefaultArguments(config.defaultArguments);
    const deployments = await deployDiamond(facets, {...defaultArguments, ...args});
    return deployments.diamond;
  }

  async function deployAsProxiedContract(args = {}) {
    const defaultArguments = await buildDefaultArguments(config.defaultArguments);
    const arguments_ = {...defaultArguments, ...args};
    const ctorArguments = config.proxied.ctorArguments !== undefined ? config.proxied.ctorArguments.map((arg) => arguments_[arg]) : [];
    const abiExtensions = config.abiExtensions !== undefined ? config.abiExtensions : [];

    const artifact = await deployments.getArtifact(config.proxied.name);
    const proxyArtifact = await getArtifactFromFolders('OptimizedTransparentUpgradeableProxy', ['node_modules/hardhat-deploy/extendedArtifacts']);
    const abi = [...proxyArtifact.abi];
    const extensionABIs = [];
    for (const extension of abiExtensions) {
      const extensionArtifact = await deployments.getArtifact(extension);
      extensionABIs.push(extensionArtifact.abi);
    }

    mergeABIs(abi, [artifact.abi, ...extensionABIs], (el) => el.type !== 'constructor');

    const contract = await deployContract(config.proxied.name, ...ctorArguments);

    let initCall = '0x';
    if (config.proxied.init !== undefined) {
      const initArguments = config.proxied.init.arguments !== undefined ? config.proxied.init.arguments.map((arg) => arguments_[arg]) : [];
      initCall = contract.interface.encodeFunctionData(config.proxied.init.method, initArguments);
    }

    const proxyAdminContract = await deployContractFromPath('ProxyAdmin', 'node_modules/hardhat-deploy/extendedArtifacts', arguments_.initialAdmin);
    const TransparentUpgradeableProxy = await ethers.getContractFactory(abi, proxyArtifact.bytecode);
    const proxy = await TransparentUpgradeableProxy.deploy(await contract.getAddress(), await proxyAdminContract.getAddress(), initCall);
    await proxy.waitForDeployment();
    return proxy;
  }

  describe(`${name}`, function () {
    before(async function () {
      this.defaultArguments = await buildDefaultArguments(config.defaultArguments);
    });
    if (config.immutable !== undefined) {
      describe(`${name} (as immutable contract)`, function () {
        if (config.immutable.testMsgData) {
          it('__msgData()', async function () {
            const ctorArguments =
              config.immutable.ctorArguments !== undefined ? config.immutable.ctorArguments.map((arg) => this.defaultArguments[arg]) : [];
            const contract = await deployContract(config.immutable.name, ...ctorArguments);
            await contract.__msgData();
          });
        }
        behaviorFn(deployAsImmutableContract);
      });
    }
    if (config.proxied !== undefined) {
      describe(`${name} (as proxied contract)`, function () {
        if (config.proxied.testMsgData) {
          it('__msgData()', async function () {
            const ctorArguments =
              config.proxied.ctorArguments !== undefined ? config.proxied.ctorArguments.map((arg) => this.defaultArguments[arg]) : [];
            const contract = await deployContract(config.proxied.name, ...ctorArguments);
            await contract.__msgData();
          });
        }
        behaviorFn(deployAsProxiedContract);
      });
    }
    if (config.diamond !== undefined) {
      describe(`${name} (as diamond facet)`, function () {
        for (const facet of config.diamond.facets) {
          describe(facet.name, function () {
            if (facet.init !== undefined) {
              describe(`${facet.init.method}`, function () {
                if (facet.init.adminProtected) {
                  it('reverts if not called by the proxy admin', async function () {
                    const facets = [...config.diamond.facets];
                    const abiExtensions = config.abiExtensions !== undefined ? config.abiExtensions : [];
                    const deployments = await deployDiamond(facets, this.defaultArguments, abiExtensions, (el) => !el.name.startsWith('__'));
                    await deployments.diamond.changeProxyAdmin(ethers.ZeroAddress);
                    const mainFacetInitArguments =
                      facet.init.arguments !== undefined ? facet.init.arguments.map((arg) => this.defaultArguments[arg]) : [];
                    await expect(deployments.diamond[facet.init.method](...mainFacetInitArguments)).to.be.revertedWithCustomError(
                      deployments.diamond,
                      'NotProxyAdmin',
                    );
                  });
                }

                if (facet.init.phaseProtected) {
                  it('reverts when trying to initialize the storage twice', async function () {
                    const facets = [...config.diamond.facets];
                    const abiExtensions = config.abiExtensions !== undefined ? config.abiExtensions : [];
                    const deployments = await deployDiamond(facets, this.defaultArguments, abiExtensions);
                    const mainFacetInitArguments =
                      facet.init.arguments !== undefined ? facet.init.arguments.map((arg) => this.defaultArguments[arg]) : [];
                    const cut = await facetInit(deployments.facets[facet.name], facet.init.method, mainFacetInitArguments);
                    await expect(
                      deployments.diamond['diamondCut((address,uint8,bytes4[])[],address,bytes)']([], ...cut),
                    ).to.be.revertedWithCustomError(deployments.diamond, 'InitializationPhaseAlreadyReached');
                  });
                }
              });
            }

            if (facet.testMsgData) {
              it('__msgData()', async function () {
                const ctorArguments = facet.ctorArguments !== undefined ? facet.ctorArguments.map((arg) => this.defaultArguments[arg]) : [];
                const contract = await deployContract(facet.name, ...ctorArguments);
                await contract.__msgData();
              });
            }
          });
        }
        behaviorFn(deployAsDiamondFacet);
      });
    }
  });
}

module.exports = {
  runBehaviorTests,
};
