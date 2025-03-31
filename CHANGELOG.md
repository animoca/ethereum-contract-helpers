# Changelog

## 1.0.5

- Use `node:util:isDeepStrictEqual` instead of `lodash.isequal`.
- Updated to latest dependencies.

## 1.0.4

- Upgrade all dependencies to latest versions.
- Move some `devDependencies` to `dependencies`.

## 1.0.3

- Downgrade `glob` to fix some dependency issue related to `eslint`.

## 1.0.2

- Fix `hardhat-deploy-ethers` issue with `getContractFactory` in `deployContract`.

## 1.0.1

- Move some `devDependencies` to `dependencies`.

## 1.0.0

- Updated to using `^ethers@6`.

## 0.0.6

- Add function `expectRevert` to handle both legacy or custom errors in test templates.

## 0.0.5

- Prevent events duplications in merged diamond ABIs.

## 0.0.4

- Fix dependabot security alerts.

## 0.0.3

- Remove the accounts section of the output hardhat configuration file in every case.

## 0.0.2

- Fix usage of new glob version.

## 0.0.1

- Initial release.
