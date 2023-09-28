const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const web3Utils = require('web3-utils');
const Web3 = require('web3');
const web3 = new Web3();
const { assert } = require('./common');
const deployer = require('../../utils/deploy');

describe("GameERC20Factory", async function () {
    let factory, logicAddress;

    let owner, user, signer, user1;

    beforeEach(async function () {
        [owner, user, signer, user1] = await hre.ethers.getSigners();

        //  factory
        factory = await deployer.deployERC20Factory();
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
    // Normal usage to assess if the results meet expectations.
    it('generate', async () => {
        // params
        const name = "test";
        const symbol = "test";
        const cap = toWei(toBN(100000000), 'ether');

        // Is the pause effective?
        await factory.pause();
        await assert.revert(
            factory.connect(user).generate(name, symbol, cap.toString()),
            "Pausable: paused"
        );
        await factory.unpause();

        // Is regular generation effective? Is the state correct?
        await factory.connect(user)./* callStatic. */generate(name, symbol, cap.toString());
        const vc = await factory.vaultCount()
        assert.equal(vc.toNumber(),1)

        // Verify the state of the instantiated ERC20 contract
        const token = await factory.vaults(0);
        const abi = [
            "function name() view returns (string)",
            "function symbol() view returns (string)",
            "function cap() view returns (uint256)"
        ]
        const tokenIns = new hre.ethers.Contract(token,abi,owner);
        const name_ = await tokenIns.name();
        assert.equal(await tokenIns.name(),name)
        assert.equal(await tokenIns.symbol(),symbol)
        assert.equal((await tokenIns.cap()).toString(),cap.toString())
    })
})


