const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3();
const { assert } = require('./common');
const deployer = require('../../utils/deploy');

describe("GameERC721Factory", async function () {
    let factory, logicAddress;

    let owner, user, signer, user1,timelocker,controller;

    beforeEach(async function () {
        [owner, user, signer, user1,timelocker,controller] = await hre.ethers.getSigners();

        //  factory
        factory = await deployer.deployERC721Factory();
        logicAddress = factory.logicAddress;
    });

    // ============== Owner setting ==============
    it('pause', async () => {
        await assert.revert(
            factory.connect(user).pause(),
            "Ownable: caller is not the owner"
        );

        await factory.pause();
        assert.equal(await factory.paused(), true);
    })
    it('unpause', async () => {
        await factory.pause();
        await assert.revert(
            factory.connect(user).unpause(),
            "Ownable: caller is not the owner"
        );
        await factory.unpause();
        assert.equal(await factory.paused(), false);
    })

    // ============== generate ==============
    // 正常使用，判断效果是否符合预期
    it('generate', async () => {
        // params
        const name = "test";
        const symbol = "test";
        const timelock = timelocker.address;
        const controller_ = controller.address;
        const signers = [user1.address];

        await factory.pause();
        await assert.revert(
            factory.connect(user).generate(name, symbol, timelock, controller_, signers),
            "Pausable: paused"
        );
        await factory.unpause();

        await factory.connect(user).generate(name, symbol, timelock, controller_, signers);
        const vc = await factory.vaultCount()
        assert.equal(vc.toNumber(), 1)

        const token = await factory.vaults(0);
        const abi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function timeLocker() view returns (address)",
            "function controller() view returns (address)",
            "function signers(address) view returns (bool)",
            "function owner() view returns (address)",
        ]
        const tokenIns = new hre.ethers.Contract(token, abi, owner);
        assert.equal(await tokenIns.name(), name)
        assert.equal(await tokenIns.symbol(), symbol)
        assert.equal(await tokenIns.timeLocker(), timelock)
        assert.equal(await tokenIns.controller(), controller_)
        assert.equal(await tokenIns.owner(), user.address)
        assert.equal(await tokenIns.signers(user1.address), true)
    })
})


