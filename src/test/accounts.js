const {ethers} = require('hardhat');

async function getSignerAddress(index) {
  return (await ethers.getSigners())[index].address;
}

async function getDeployerAddress() {
  return getSignerAddress(0);
}

module.exports = {
  getSignerAddress,
  getDeployerAddress,
};
