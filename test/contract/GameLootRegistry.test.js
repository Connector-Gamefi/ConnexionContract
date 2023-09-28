const hre = require('hardhat');
const { toBN, toWei } = require('web3-utils');
const Web3 = require('web3');
const { assert } = require('./common');
const web3 = new Web3(Web3.givenProvider);
const { currentTime, toUnit, fastForward } = require('../utils')();
const deployer = require('../../utils/deploy');

describe("GameLootRegistry", async function () {
    let treasure, equipment, gameMinter, timelocker, revealSVG, registry;

    let owner, controller, signer, vault, user1, user2;
    let signers;

    /* --------- constructor args --------- */
    // 2 days
    const DAY = 86400;
    const cap = 90;
    const symbol = "Archloot";
    const name = "Archloot";

    beforeEach(async function () {
        [owner, controller, signer, vault, user1, user2] = await hre.ethers.getSigners();
        signers = [signer.address];

        // deploy
        timelocker = await deployer.deployTimelocker(DAY * 2)
        treasure = await deployer.deployTreasure(controller.address, timelocker.address, signers);
        revealSVG = await deployer.deployReveal();
        equipment = await deployer.deployEquipment(
            revealSVG.address, name, symbol, treasure.address, vault.address, timelocker.address, signers, cap)
        gameMinter = await deployer.deployGameMinter(equipment.address, timelocker.address, controller.address, signers);
        registry = await deployer.deployRegistry();

        /* ------------- set seller and gameMinter into equipment ------------- */
        //  init timelock params
        const target = equipment.address;
        const value = '0';
        const setGameMinterSign = "setGameMinter(address)";
        const setGameMinterData = web3.eth.abi.encodeParameter('address', gameMinter.address);
        const now = await currentTime();
        const eta = now + DAY * 3;

        // queue tx
        await timelocker.connect(owner).queueTransaction(target, value, setGameMinterSign, setGameMinterData, eta);

        await fastForward(DAY * 4);

        // execute tx
        await timelocker.connect(owner).executeTransaction(target, value, setGameMinterSign, setGameMinterData, eta);
    });

    it('registry should be success: ', async () => {
        const fillData = [[0, "SkillRandomStrengthenAntiInjuryState"], [1, "hhh"]];

        await registry.fill(fillData);

        const nonce = 0;
        const eqID = 10;
        const attrIDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        const attrValues = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

        //  generate hash
        const originalData = hre.ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "uint256", "uint256", "uint256[]", "uint256[]"],
            [user1.address, gameMinter.address, nonce, eqID, attrIDs, attrValues]
        );
        const hash = hre.ethers.utils.keccak256(originalData);
        const signData = await signer.signMessage(web3.utils.hexToBytes(hash));

        await gameMinter.connect(user1).gameMint(nonce, eqID, attrIDs, attrValues, signData);

        const result = await equipment.attributesName(0, registry.address);
    })

    it('fill: ', async () => {
        const fillData = [[0, "SkillRandomStrengthenAntiInjuryState"], [1, "hhh"]];
        await assert.revert(registry.connect(user1).fill(fillData), "Ownable: caller is not the owner");
        await registry.connect(owner).fill(fillData);
        assert.equal(await registry.attrMetadata(0), "SkillRandomStrengthenAntiInjuryState");
    })

    it('update: ', async () => {
        const fillData = [[0, "SkillRandomStrengthenAntiInjuryState"], [1, "hhh"]];
        await registry.connect(owner).fill(fillData);
        await assert.revert(registry.connect(user1).update(0, "test"), "Ownable: caller is not the owner");
        await registry.connect(owner).update(0, "test");
        assert.equal(await registry.attrMetadata(0), "test");
    })
})