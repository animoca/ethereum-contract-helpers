const {ethers, deployments} = require('hardhat');
const {deployContract} = require('./deploy');

const isEqual = require('lodash.isequal');

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function insertInABIWithoutDuplication(abi, extension, elementType) {
  const abiElements = abi.filter((el) => el.type === elementType);
  const extensionElements = extension.filter((el) => el.type === elementType);
  for (const extensionElement of extensionElements) {
    if (abiElements.find((el) => isEqual(el, extensionElement)) === undefined) {
      abi.push({...extensionElement});
    }
  }
}

function mergeABIs(abi, extensions, abiFilter) {
  for (const extension of extensions) {
    abi.push(...extension.filter((el) => el.type === 'function').filter(abiFilter));
    insertInABIWithoutDuplication(abi, extension, 'error');
    insertInABIWithoutDuplication(abi, extension, 'event');
  }
}

const newFacetFilter = (el) => el.type !== 'function' || (!el.name.startsWith('init') && !el.name.startsWith('__'));

function getSelectors(facet, abiFilter) {
  const selectors = [];
  facet.interface.forEachFunction((fn) => {
    if (abiFilter(fn)) {
      selectors.push(fn.selector);
    }
  });
  return selectors;
}

async function facetInit(facet, initMethod, initArgs) {
  return [await facet.getAddress(), facet.interface.encodeFunctionData(initMethod, initArgs)];
}

async function deployFacets(facetsConfig, args, abiFilter) {
  const facets = {};
  const cuts = [];
  const inits = [];
  for (const config of facetsConfig) {
    const ctorArguments = config.ctorArguments !== undefined ? config.ctorArguments.map((arg) => args[arg]) : [];
    const facet = await deployContract(config.name, ...ctorArguments);
    facets[config.name] = facet;
    cuts.push([await facet.getAddress(), FacetCutAction.Add, getSelectors(facet, abiFilter)]);
    if (config.init !== undefined) {
      const initArguments = config.init.arguments !== undefined ? config.init.arguments.map((arg) => args[arg]) : [];
      inits.push([await facet.getAddress(), facet.interface.encodeFunctionData(config.init.method, initArguments)]);
    }
  }

  return {facets, cuts, inits};
}

async function deployDiamond(facetsConfig, args, abiExtensions = [], abiFilter = newFacetFilter, implementation = 'Diamond') {
  const facetDeployments = await deployFacets(facetsConfig, args, abiFilter);
  const diamondArtifact = await deployments.getArtifact(implementation);
  const abi = [...diamondArtifact.abi];
  const facetABIs = [];
  for (const facetConfig of facetsConfig) {
    const facetArtifact = await deployments.getArtifact(facetConfig.name);
    facetABIs.push(facetArtifact.abi);
  }
  const extensionABIs = [];
  for (const extension of abiExtensions) {
    const extensionArtifact = await deployments.getArtifact(extension);
    extensionABIs.push(extensionArtifact.abi);
  }
  mergeABIs(abi, [...facetABIs, ...extensionABIs], abiFilter);
  const Diamond = await ethers.getContractFactory(abi, diamondArtifact.bytecode);
  const diamond = await Diamond.deploy(facetDeployments.cuts, facetDeployments.inits);
  await diamond.waitForDeployment();
  return {
    diamond,
    facets: facetDeployments.facets,
  };
}

module.exports = {
  FacetCutAction,
  getSelectors,
  newFacetFilter,
  facetInit,
  deployFacets,
  deployDiamond,
  mergeABIs,
};
