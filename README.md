# Animoca Ethereum Contracts

[![NPM Package](https://img.shields.io/npm/v/@animoca/ethereum-contract-helpers.svg)](https://www.npmjs.org/package/@animoca/ethereum-contract-helpers)

Solidity contracts development helpers which uses [HardHat](https://hardhat.org/) consisting of Hardhat plugins and configurations, tooling and testing utilities.

## Solidity contract helpers

## HardHat plugins and configurations

A set of plugins and configurations are provided to improve the development experience. They can be used in your own project in your `hardhat.config.js`:

```javascript
const {mergeConfigs} = require('@animoca/ethereum-contract-helpers/src/config');

// load all the plugins (you can also load them one by one)
require("@animoca/ethereum-contract-helpers/hardhat-plugins");

// deep merges your config on top of the default provided config
module.exports = mergeConfigs(require("@animoca/ethereum-contract-helpers/hardhat-config"), {
  // my config
});
```

See the `README.md` of each plugin for more details.

## Test helpers

### Fixtures

To speed up tests execution, fixtures based one `evm_snapshot`/`evm_revert` can be used. For example:

```javascript
const { loadFixture } = require("@animoca/ethereum-contract-helpers/src/test/fixtures");

describe("MyContract", function () {
  const fixture = async function () {
    // contract(s) initialization
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });

  // tests
  // ...
});
```

### Diamond

Functions for managing deployment of diamonds and their facets are provided in `src/test/diamond.js`.

### Execution

A test runner function allows to test some contract logic in immutable, proxied or diamond setup. The contracts setup in handled via a configuration object, while the deployment logic is delegated to the tool via a function (`deployFn` in the example below).

Here is a simple usage example where the same testing logic will be applied to the immutable, proxied and facet versions of a contract:

```javascript
const { getDeployerAddress } = require("@animoca/ethereum-contract-helpers/src/test/accounts");
const { runBehaviorTests } = require("@animoca/ethereum-contract-helpers/src/test/run");
const { loadFixture } = require("@animoca/ethereum-contract-helpers/src/test/fixtures");

const config = {
  immutable: { name: "MyImmutableContract", ctorArguments: ["myArg", "registry"] },
  proxied: {
    name: "MyProxiedContract",
    ctorArguments: ["registry"],
    init: { method: "init", arguments: ["myArg"] },
  },
  diamond: {
    facets: [
      { name: "ProxyAdminFacet", ctorArguments: ["registry"], init: { method: "initProxyAdminStorage", arguments: ["initialAdmin"] } },
      { name: "DiamondCutFacet", ctorArguments: ["registry"], init: { method: "initDiamondCutStorage" } },
      {
        name: "MyFacetContract",
        ctorArguments: ["registry"],
        init: { method: "initMyStorage", arguments: ["myArg"] },
      },
    ],
  },
  defaultArguments: {
    registry: async () => {/* get registry address */},
    initialAdmin: getDeployerAddress,
  },
};

runBehaviorTests("MyContract", config, function (deployFn) {
  const fixture = async function () {
    this.contract = await deployFn({ myArg: "test" });
  };

  beforeEach(async function () {
    await loadFixture(fixture, this);
  });

  // tests
  // ...
});
```

## Installation

To install the module in your project, add it as an npm dependency:

```bash
yarn add -D @animoca/ethereum-contract-helpers
```

or

```bash
npm add --save-dev @animoca/ethereum-contract-helpers
```
