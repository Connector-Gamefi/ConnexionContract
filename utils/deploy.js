const hre = require('hardhat');

exports.deployTreasure = async function (controller, timelock, signers) {
    const GameLootTreasure = await hre.ethers.getContractFactory("GameLootTreasure");
    treasure = await GameLootTreasure.deploy(controller, timelock, signers);
    await treasure.deployed();
    return treasure;
}

exports.deployReveal = async function () {
    const GameLootReveal = await hre.ethers.getContractFactory("GameLootReveal");
    revealSVG = await GameLootReveal.deploy();
    await revealSVG.deployed();
    return revealSVG;
}

exports.deployTimelocker = async function (delay) {
    const GameLootTimelocker = await hre.ethers.getContractFactory("GameLootTimelocker");
    timelocker = await GameLootTimelocker.deploy(delay);
    await timelocker.deployed();
    return timelocker;
}

exports.deployEquipment = async function (reveal, name, symbol, treasure, vault, timelocker, signers, cap) {
    const GameLootEquipment = await hre.ethers.getContractFactory("GameLootEquipment");
    equipment = await GameLootEquipment.deploy(
        reveal, name, symbol, treasure, vault, timelocker, signers, cap);
    await equipment.deployed();
    return equipment;
}

exports.deploySeller = async function (equipment, timelocker, maxSupply, price, signers) {
    const GameLootSeller = await hre.ethers.getContractFactory("GameLootSeller");
    seller = await GameLootSeller.deploy(equipment, timelocker, maxSupply, price, signers);
    await seller.deployed();
    return seller;
}

exports.deployGameMinter = async function (equipment, timelocker, controller, signers) {
    const GameLootGameMinter = await hre.ethers.getContractFactory("GameLootGameMinter");
    gameMinter = await GameLootGameMinter.deploy(equipment, timelocker, controller, signers);
    await gameMinter.deployed();
    return gameMinter;
}

exports.deployRegistry = async function () {
    const MonsterRegistry = await hre.ethers.getContractFactory("MonsterRegistry");
    registry = await MonsterRegistry.deploy();
    await registry.deployed();
    return registry;
}

exports.deployBinanceSell = async function (equipment, binanceFirstNFT, binanceSecondNFT, signers) {
    const GameLootBinanceSeller = await hre.ethers.getContractFactory("GameLootBinanceSeller");
    binanceSeller = await GameLootBinanceSeller.deploy(equipment, binanceFirstNFT, binanceSecondNFT, signers);
    await binanceSeller.deployed();
    return binanceSeller;
}

exports.deployTestNFT = async function (name, symbol) {
    const TestNFT = await hre.ethers.getContractFactory("TestNFT");
    testNFT = await TestNFT.deploy(name, symbol);
    await testNFT.deployed();
    return testNFT;
}

exports.deployERC20Factory = async function () {
    const GameERC20Factory = await hre.ethers.getContractFactory("GameERC20Factory");
    const erc20Factory = await GameERC20Factory.deploy();
    await erc20Factory.deployed();
    erc20Factory.logicAddress = await erc20Factory.logic();
    return erc20Factory;
}

exports.deployERC20Treasure = async function (signers, token, controller, timelock) {
    const GameERC20Treasure = await hre.ethers.getContractFactory("GameERC20Treasure");
    const erc20Treasure = await GameERC20Treasure.deploy(signers, token, controller, timelock);
    await erc20Treasure.deployed();
    return erc20Treasure;
}

exports.deployFixedPriceNFT = async function (feeAccount) {
    const GameDaoFixedNFT = await hre.ethers.getContractFactory("GameDaoFixedNFT");
    const gameDaoFixedNFT = await hre.upgrades.deployProxy(GameDaoFixedNFT,
        [feeAccount],
        { initializer: 'initialize' });
    await gameDaoFixedNFT.deployed();
    return gameDaoFixedNFT;
}

exports.deployInvestor = async function (investors, amounts, period, token) {
    const Investor = await hre.ethers.getContractFactory("Investor");
    const investor = await Investor.deploy(investors, amounts, period, token);
    await investor.deployed();
    return investor;
}

exports.deployERC721Factory = async function () {
    const GameERC721Factory = await hre.ethers.getContractFactory("GameERC721Factory");
    let erc721Factory = await GameERC721Factory.deploy();
    await erc721Factory.deployed();
    erc721Factory.logicAddress = await erc721Factory.logic();
    return erc721Factory;
}

exports.deployERC721Treasure = async function (controller, timelock, signers) {
    const GameERC721Treasure = await hre.ethers.getContractFactory("GameERC721Treasure");
    treasure = await GameERC721Treasure.deploy(controller, timelock, signers);
    await treasure.deployed();
    return treasure;
}

exports.deployInvestorTicket = async function (uri) {
    const InvestorTicket = await hre.ethers.getContractFactory("InvestorTicket");
    const investorTicket = await InvestorTicket.deploy(uri);
    await investorTicket.deployed();
    return investorTicket;
}