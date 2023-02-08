# ConnexionContract

## Project architecture

### Equipment

Contract name | Description
--- | ---
 GameLoot.sol | Base contract for equipment
 GameLootBinanceSeller.sol | Provides the ability to convert Binance NFTs to equipment NFTs
 GameLootEquipment.sol | Equipment NFT contract
 GameLootGameMinter.sol | When new equipment is produced from the game, this contract will have the right to mint it on chain
 GameLootReveal.sol | SVG Maker for equipment NFTs
 GameLootSeller.sol | When equipment is sold on chain, this contract will contain the sale rules
 GameLootTimelocker.sol | A timelocker for important settings
 GameLootTreasure.sol | A treasure contract that stores equipment NFTs user recharged to the game
 IGameLoot.sol | Base interface

### Porps

Contract name | Description
--- | ---
GameERC721Factory.sol | Factory contract for props
GameERC721Proxy.sol | Props proxy contract
GameERC721Token.sol | Props logic contract
GameERC721Treasure.sol | A treasure contract that stores prop NFTs user recharged to the game

### ERC20

Contract name | Description
--- | ---
GameERC20Factory.sol | Factory contract for ERC20 tokens
GameERC20FactoryNoCap.sol | Factory contract for ERC20 tokens which have not cap
GameERC20Token.sol | Logic contract for ERC20 tokens
GameERC20NoCapToken.sol | Logic contract for ERC20 tokens which have not cap
GameERC20Proxy.sol | Proxy contract for ERC20 tokens
GameERC20Treasure.sol | A treasure contract that stores ERC20 token user recharged to the game

### Market

Contract name | Description
--- | ---
GameDaoFixedNFT.sol | A marketplace for trading NFT

### Ticket and farm (beta)

Contract name | Description
--- | ---
Investor.sol | Linear Release Rewards
InvestorStake.sol | A contract for farming
InvestorTicket.sol | A ERC1155 contract for tickets

## Advanced Sample Hardhat Project

This project demonstrates an advanced Hardhat use case, integrating other tools commonly used alongside Hardhat in the ecosystem.

The project comes with a sample contract, a test for that contract, a sample script that deploys that contract, and an example of a task implementation, which simply lists the available accounts. It also comes with a variety of other tools, preconfigured to work with the project code.

Try running some of the following tasks:

```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.js
node scripts/deploy.js
npx eslint '**/*.js'
npx eslint '**/*.js' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```

## Etherscan verification

To try out Etherscan verification, you first need to deploy a contract to an Ethereum network that's supported by Etherscan, such as Ropsten.

In this project, copy the .env.example file to a file named .env, and then edit it to fill in the details. Enter your Etherscan API key, your Ropsten node URL (eg from Alchemy), and the private key of the account which will send the deployment transaction. With a valid .env file in place, first deploy your contract:

```shell
hardhat run --network ropsten scripts/deploy.js
```

Then, copy the deployment address and paste it in to replace `DEPLOYED_CONTRACT_ADDRESS` in this command:

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS "Hello, Hardhat!"
```

## Git Commit Message Conventions

A commit message consists of a **header**, a **body** and a **footer**, separated by a blank line.

```bash
<type>(<scope>): <subject>
//  BLANK LINE
<body>
//  BLANK LINE
<footer>
```

The Header is required, and the Body and Footer can be omitted. Any line of the commit message cannot be longer **100 characters**.

### Header

The message header is a single line that contains succinct description of the change; containing a type, an optional scope and a subject.

#### type

Type Indicates the type of commit. Only the following seven identifiers are allowed.

> - feat: new feature
> - fix: bug fix
> - docs: documentation
> - style: formatting(Changes that do not affect code execution)
> - refactor: scrap all the old code
> - test: when adding missing tests
> - chore: changes to the ancillary tools

#### scope(option)

Scope is used to specify the scope of the commit impact, such as the data layer, control layer, view layer, and so on, depending on the project.

#### subject

Subject is a short description of the commit purpose, no more than 50 characters long.

> - Start with a verb and use the present first-person tense such as 'change' rather than 'changed' or 'changes';
> - The first letter should be lowercase;
> - No dot (.) at the end.

### Body

The Body section is a detailed description of the commit, broken into multiple lines.

There are two caveats:

> - start with a verb and use the present first-person tense such as 'change' rather than 'changed' or 'changes';
> - includes motivation for the change and contrasts with previous behavior.

### Footer

The Footer section is only used in two cases.

#### Breaking changes

All breaking changes have to be mentioned as a breaking change block in the footer, which should start with the word BREAKING CHANGE: with a space or two newlines. The rest of the commit message is then the description of the change, justification and migration notes.

```sh
BREAKING CHANGE: isolate scope bindings definition has changed and
    the inject option for the directive controller injection was removed.
    
    To migrate the code follow the example below:
    
    Before:
    
    scope: {
      myAttr: 'attribute',
      myBind: 'bind',
      myExpression: 'expression',
      myEval: 'evaluate',
      myAccessor: 'accessor'
    }
    
    After:
    
    scope: {
      myAttr: '@',
      myBind: '@',
      myExpression: '&',
      // myEval - usually not useful, but in cases wgitre the expression is assignable, you can use '='
      myAccessor: '=' // in directive's template change myAccessor() to myAccessor
    }
    
    The removed `inject` wasn't generaly useful for directives so there should be no code using it.
```

#### Referencing issues

Closed bugs should be listed on a separate line in the footer prefixed with "Closes" keyword like this:

```sh
Closes #234
```

or in case of multiple issues:

```sh
Closes #123, #245, #992
```

### Examples

```sh
feat($browser): onUrlChange event (popstate/hashchange/polling)

Added new event to $browser:
- forward popstate event if available
- forward hashchange event if popstate not available
- do polling when neither popstate nor hashchange available

Breaks $browser.onHashChange, which was removed (use onUrlChange instead)
```

### Commitizen

[Commitizen](https://github.com/commitizen/cz-cli) is a tool for writing qualified Commit messages.

Installing the command line tool

```bash
npm install -g commitizen
```

Then, in the project directory, run the following command to support Angular's Commit Message format.

```bash
commitizen init cz-conventional-changelog --save --save-exact
```

Use `git cz` instead of `git commit`. At this point, options are presented to generate a Commit message that matches the format.

![image](https://github.com/commitizen/cz-cli/raw/master/meta/screenshots/add-commit.png)
