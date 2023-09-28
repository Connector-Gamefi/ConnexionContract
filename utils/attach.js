exports.attachContract = async (address,contractName) => {
    const GameLootEquipment = await ethers.getContractFactory(contractName);
    return GameLootEquipment.attach(address);
}