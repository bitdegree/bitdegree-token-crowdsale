var BitDegreeCrowdsale = artifacts.require("./BitDegreeCrowdsale.sol");
var BitDegreeToken = artifacts.require("./BitDegreeToken.sol");

module.exports = function(deployer) {
  const startTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp + 1000, endTime = startTime + 1000;

  deployer.deploy(BitDegreeToken);

  BitDegreeToken.deployed().then(function (instance) {
      instance.owner.call().then(function(owner){
          deployer.deploy(BitDegreeCrowdsale,
              startTime,
              endTime,
              10000,
              owner, // destination wallet
              instance.address, // deployed contract
              owner // owner
          );
      });
  });
};

