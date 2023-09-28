const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3(Web3.givenProvider);
const { assert } = require('./common');
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');
const tokenABI = require('../../artifacts/contracts/GameERC20Token.sol/GameERC20Token.json').abi;

describe("Investor", async function () {
    let investorTicket;
    let owner, user;

    const uri = "ipfs://QmQCkjsvKiKMiPNp8QHLLvQcFZQV5qTNKkvtfEqfiurgux/";

    beforeEach(async function () {
        [owner, user] = await hre.ethers.getSigners();

        //  Investor
        investorTicket = await deployer.deployInvestorTicket(uri);
    });

    it('constructor state', async () => {
        await investorTicket.mint(user.address, 0, 1);
        assert.equal(await investorTicket.uri(0), uri + 0);
    })

    it('setUri test', async () => {
        const testURI = "http://testURI"
        await assert.revert(
            investorTicket.connect(user).setUri(testURI),
            "Ownable: caller is not the owner"
        );

        await investorTicket.connect(owner).setUri(testURI);
        await investorTicket.mint(user.address, 0, 1);
        await investorTicket.mint(user.address, 10, 1);
        assert.equal(await investorTicket.uri(0), testURI + 0);
        assert.equal(await investorTicket.uri(10), testURI + 10);
    })

    it('mint test', async () => {
        await assert.revert(
            investorTicket.connect(user).mint(user.address, 1, 1000),
            "Ownable: caller is not the owner"
        );

        await investorTicket.connect(owner).mint(user.address, 2, 500);
        assert.equal(await investorTicket.balanceOf(user.address, 2), 500);
    })

    it('mintBatch test', async () => {
        const amount1 = 1000;
        const amount2 = 2000;
        await assert.revert(
            investorTicket.connect(user).mintBatch(user.address, [1, 2], [amount1, amount2]),
            "Ownable: caller is not the owner"
        );

        await investorTicket.connect(owner).mintBatch(user.address, [1, 2], [amount1, amount2]);
        assert.equal(await investorTicket.balanceOf(user.address, 1), amount1);
        assert.equal(await investorTicket.balanceOf(user.address, 2), amount2);
    })
})