const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const { assert } = require('./common');
const deployer = require('../../utils/deploy');
let tokenABI = require('../../artifacts/contracts/GameERC20Token.sol/GameERC20Token.json').abi;
const logicABI = {
    "inputs": [],
    "name": "logic",
    "outputs": [
        {
            "internalType": "address",
            "name": "",
            "type": "address"
        }
    ],
    "stateMutability": "view",
    "type": "function"
};
tokenABI.push(logicABI);

describe("GameERC20ALT", async function () {
    let factory, logicAddress, token;

    let owner, user, haker, user1;

    // constructor params
    const name = "Archloot";
    const symbol = "ALT";
    const cap = toWei(toBN(100000000), 'ether');

    beforeEach(async function () {
        [owner, user, haker, user1] = await hre.ethers.getSigners();

        //  factory
        factory = await deployer.deployERC20Factory();
        logicAddress = factory.logicAddress;

        //  token
        await factory.connect(owner).generate(name, symbol, cap.toString());
        const tokenAddress = await factory.vaults(0);
        token = new hre.ethers.Contract(tokenAddress, tokenABI, owner);
    });

    it('constructor state', async () => {
        assert.equal(await token.name(), name);
        assert.equal(await token.symbol(), symbol);
        assert.equal((await token.cap()).toString(), cap.toString());
        assert.equal(await token.owner(), owner.address);
        assert.equal(await token.logic(), logicAddress);
    })

    // ============== Owner setting ==============
    it('mint owner test', async () => {
        const amount = '100000000';
        await assert.revert(
            token.connect(user).mint(user.address, amount),
            "only owner"
        );

        await token.mint(user.address, amount);
        assert.equal((await token.balanceOf(user.address)).toString(), amount);
    })
    it('lockAddress owner test', async () => {
        await assert.revert(
            token.connect(user).lockAddress(haker.address),
            "only owner"
        );

        await token.lockAddress(haker.address);
        assert.equal(await token.blackList(haker.address), true);
    })
    it('unLockAddress owner test', async () => {
        await token.lockAddress(user.address);
        await assert.revert(
            token.connect(user).unLockAddress(user.address),
            "only owner"
        );

        await token.unLockAddress(user.address);
        assert.equal(await token.blackList(user.address), false);
    })
    it('transferOwnership owner test', async () => {
        await assert.revert(
            token.connect(user).transferOwnership(user.address),
            "only owner"
        );

        await token.transferOwnership(user.address);
        assert.equal(await token.owner(), user.address);
    })

    // ============== initialize ==============
    it('initialize', async () => {
        await assert.revert(
            token.connect(user).initialize('', '', 0, user.address),
            "Initializable: contract is already initialized"
        );
    })

    // ============== mint ==============
    it('mint', async () => {
        await token.mint(user.address, cap.add(toBN(100000000)).toString());
        assert.equal((await token.balanceOf(user.address)).toString(), cap.toString());
    })

    // ============== lock and unlock ==============
    it('lock and unlock', async () => {
        const amount = '1000000000000000000';
        await token.mint(haker.address, amount);

        await token.lockAddress(haker.address);
        await assert.revert(
            token.connect(haker).transfer(user.address, '99999999999'),
            "black list error"
        );
        await token.unLockAddress(haker.address);
        await token.connect(haker).transfer(user.address, amount),
            assert.equal((await token.balanceOf(haker.address)).toString(), '0');
    })
})
