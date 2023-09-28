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
    let investorContract, erc20Token;
    let deployTime;
    let owner, user, investor1, investor2, investor3, investors;

    // constructor args
    const amounts = [
        toWei('10000', 'ether'),
        toWei('15000', 'ether')
    ]
    const period = 15552000; // 6 months
    const name = "Archloot";
    const symbol = "ALT";
    const cap = toWei(toBN(100000000), 'ether');

    beforeEach(async function () {
        [owner, user, investor1, investor2, investor3] = await hre.ethers.getSigners();
        investors = [investor1.address, investor2.address];

        //  factory
        factory = await deployer.deployERC20Factory();
        //  token
        await factory.connect(owner).generate(name, symbol, cap.toString());
        const tokenAddress = await factory.vaults(0);
        erc20Token = new hre.ethers.Contract(tokenAddress, tokenABI, owner);
        //  Investor
        investorContract = await deployer.deployInvestor(investors, amounts, period, erc20Token.address);
        deployTime = await currentTime();
    });

    it('constructor state', async () => {
        assert.equal(await investorContract.owner(), owner.address);
        await fastForward(1000);
        // console.log((await investorContract.startTime()).toString(), await currentTime());
        assert.equal(await investorContract.token(), erc20Token.address);

        // rights
        const right1 = await investorContract.rights(investors[0]);
        const right2 = await investorContract.rights(investors[1]);
        assert.equal(right1.amount.toString(), amounts[0].toString());
        assert.equal(right2.amount.toString(), amounts[1].toString());


        assert.equal(right1.speed.toString(), toBN(amounts[0]).div(toBN(period)).toString());
        assert.equal(right2.speed.toString(), toBN(amounts[1]).div(toBN(period)).toString());
    })

    /* =========== owner =========== */
    it('transferOwnership test', async () => {
        await assert.revert(
            investorContract.connect(user).transferOwnership(user.address),
            "only owner"
        );

        await investorContract.connect(owner).transferOwnership(user.address);
        assert.equal(await investorContract.owner(), user.address);
    })

    it('setRight test', async () => {
        await assert.revert(
            investorContract.connect(user).setRight(investor3.address, amounts[0].toString(), period),
            "only owner"
        );

        await investorContract.connect(owner).setRight(investor3.address, amounts[0].toString(), period);
        const right = await investorContract.rights(investor3.address);

        assert.equal(right.amount.toString(), amounts[0].toString());
        assert.equal(right.speed.toString(), toBN(amounts[0]).div(toBN(period)).toString());
    })

    /* =========== unlock =========== */
    it('unlock test', async () => {
        await erc20Token.connect(owner).mint(investorContract.address, cap.toString());

        /* investor1 */
        await fastForward(period / 2);
        await investorContract.connect(investor1).unlock();
        let b = await erc20Token.balanceOf(investor1.address);
        assert.bnGte(toBN(b.toString()), toBN(amounts[0]).div(toBN(2)));

        await fastForward(period / 2);
        await investorContract.connect(investor1).unlock();
        b = await erc20Token.balanceOf(investor1.address);
        assert.bnEqual(toBN(b.toString()),toBN(amounts[0]));

       
        /* investor3 */
        await investorContract.connect(owner).setRight(investor3.address, amounts[0].toString(), period);
        await fastForward(period / 2);
        await investorContract.connect(investor3).unlock();
        b = await erc20Token.balanceOf(investor3.address);
        assert.bnGte(toBN(b.toString()), toBN(amounts[0]).div(toBN(2)));

        await fastForward(period / 2);
        await investorContract.connect(investor3).unlock();
        b = await erc20Token.balanceOf(investor3.address);
        assert.bnEqual(toBN(b.toString()),toBN(amounts[0]));
    })
})
