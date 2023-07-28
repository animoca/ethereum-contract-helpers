const {expect} = require('chai');

async function expectRevert(fn, contract, error, args) {
  if (error.custom) {
    const promise = expect(fn).to.be.revertedWithCustomError(contract, error.error);
    if (error.args === undefined) {
      await promise;
    } else {
      await promise.withArgs(...error.args.map((arg) => args[arg]));
    }
  } else {
    await expect(fn).to.be.revertedWith(error.message);
  }
}

module.exports = {
  expectRevert,
};
