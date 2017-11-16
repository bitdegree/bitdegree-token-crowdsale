var Promise = require('pinkie-promise');
var Big = require('bignumber.js');

var BitDegreeToken = artifacts.require('./BitDegreeToken.sol');
var BitDegreeCrowdsale = artifacts.require('./BitDegreeCrowdsale.sol');

contract('BitDegreeToken', function (accounts) {

    var owner = accounts[0], crowdsale = accounts[accounts.length-1], token;

    before(function (cb) {
        BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            cb();
        }).catch(cb)
    });

    it('should initialize token distribution', function () {
        var totalSupply, lockedAmount, reservedAmount, publicAmount;
        return token.totalSupply.call().then(function (_totalSupply) {
            totalSupply = _totalSupply;
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount;
            return token.publicAmount.call();
        }).then(function (_publicAmount) {
            publicAmount = _publicAmount;
            assert.isTrue(totalSupply.gt(0), 'total supply is a non-zero value');
            assert.isTrue(publicAmount.lt(totalSupply), 'public amount is lower than total supply');
            assert.isTrue(lockedAmount.lt(totalSupply), 'locked amount is lower than total supply');
            assert.isTrue(publicAmount.add(lockedAmount).lte(totalSupply), 'public amount and locked amount do not exceed total supply');
        });
    });

    it('should set the owner', function () {
        return token.owner.call().then(function (_owner) {
            assert.equal(owner, _owner);
        });
    });

    it('should set correctly the initial balance of the owner', function () {
        var totalSupply;

        return token.totalSupply.call().then(function (_totalSupply) {
            totalSupply = _totalSupply;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.isTrue(totalSupply.eq(balance), 'owner hold all of the tokens');
        })
    });

    it('should set the start and lock times', function () {
        var startTime;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            assert.isTrue(startTime.gt(0), 'start time is set');
            return token.lockReleaseTime.call();
        }).then(function (lockReleaseTime) {
            assert.isTrue(startTime.add(160 * 3600 * 24).eq(lockReleaseTime), 'lock release time is set to exactly 160 days from start time');
        });
    });

    it('should prevent ownership transfers before token lock is released', function () {
        var currentOwner, newOwner = accounts[3], lockReleaseTime;
        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner);
            return token.lockReleaseTime.call();
        }).then(function (_lockReleaseTime) {
            lockReleaseTime = _lockReleaseTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(lockReleaseTime.gt(currentTime), 'lock release time is in the future');
            return token.transferOwnership(newOwner, {from: owner}).catch(function () { });
        }).then(function () {
            return token.owner.call();
        }).then(function (_owner) {
            assert.equal(_owner, currentOwner);
        });
    });

    it('should allow regular accounts to set allowance', function () {
        var allowanceToSet = 100;

        return token.allowance.call(accounts[1], accounts[2]).then(function (allowance) {
            assert.isTrue(allowance.eq(0), 'allowance is equal to zero');
            return token.approve(accounts[2], allowanceToSet, {from: accounts[1]});
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.isTrue(allowance.eq(allowanceToSet), 'allowance is set correctly');
        });
    });

    it('should not allow accounts to change allowance to non-zero value', function () {
        var newAllowance = 200;

        return token.allowance.call(accounts[1], accounts[2]).then(function (allowance) {
            assert.isTrue(allowance.gt(0), 'allowance above zero');
            return token.approve(accounts[2], newAllowance, {from: accounts[1]}).catch(function () {});
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.isFalse(allowance.eq(newAllowance), 'allowance remained the same');
        });
    });

    it('should allow accounts to change allowance to zero', function () {
        return token.allowance.call(accounts[1], accounts[2]).then(function (allowance) {
            assert.isFalse(allowance.eq(0), 'allowance is a non-zero value');
            return token.approve(accounts[2], 0, {from: accounts[1]});
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.isTrue(allowance.eq(0), 'allowance changed to 0');
        });
    });


    it('should allow owner to set the crowdsale address', function () {
        return token.setCrowdsaleAddress(crowdsale, {from: owner}).then(function () {
            return token.crowdsaleAddress.call();
        }).then(function (currentAddress) {
            assert.equal(crowdsale, currentAddress, 'crowdsale address is set correctly');
        });
    });


    it('should set the initial allowance for the crowdsale address', function () {
        var allowance;

        return token.allowance.call(owner, crowdsale).then(function (_allowance) {
            allowance = _allowance;
            return token.publicAmount.call();
        }).then(function (publicAmount) {
            assert.isTrue(publicAmount.eq(allowance), 'crowdsale allowance is equal to public supply');
        });
    });

    it('should prevent regular accounts from setting the crowdsale address', function () {
        var addressBefore;

        return token.crowdsaleAddress.call().then(function (address) {
            addressBefore = address;
            return token.setCrowdsaleAddress(accounts[2], {from: accounts[1]}).catch(function () { });
        }).then(function () {
            return token.crowdsaleAddress.call();
        }).then(function (addressAfter) {
            assert.equal(addressBefore, addressAfter, 'address did not change');
            assert.notEqual(addressAfter, accounts[2], 'address is not equal to the one that was attempted to set');
        });
    });

    it('should prevent transfers before start time', function () {
        var startTime, balanceBefore, balanceAfter, transferAmount = new Big(100);

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(startTime.gt(currentTime), 'start time is in the future');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.isTrue(balance.gte(transferAmount), 'sender has enough tokens in balance');
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.transfer(accounts[1], transferAmount, {from: owner}).catch(function () { });
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(transferAmount.gt(0), 'transfer amount is greater than zero');
            assert.isTrue(balanceBefore.eq(balanceAfter), 'balance remained unchanged');
        });
    });

    it('should prevent transfers through allowance (unless sending from owner) before start time', function () {
        var startTime, recipientBefore, recipientAfter, transferAmount = new Big(50), allowanceBefore, allowanceAfter, source = owner, sender = accounts[1], recipient = accounts[2];

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(startTime.gt(currentTime), 'start time is in the future');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.isTrue(balance.gt(transferAmount), 'owner has enough balance to make the transfer');
            return token.approve(sender, transferAmount.toNumber(), {from: source});
        }).then(function () {
            return token.allowance.call(source, sender);
        }).then(function (allowance) {
            allowanceBefore = allowance;
            assert.isTrue(allowanceBefore.eq(transferAmount), 'allowance was set correctly');
            return token.balanceOf.call(recipient);
        }).then(function (balance) {
            recipientBefore = balance;
            assert.equal(owner, source, 'source is the owner');
            // should not fail because owner is exempt from transferFrom limitations
            return token.transferFrom(source, recipient, transferAmount, {from: sender});
        }).then(function () {
            return token.allowance.call(source, sender);
        }).then(function (allowance) {
            allowanceAfter = allowance;
            return token.balanceOf.call(recipient);
        }).then(function (balance) {
            recipientAfter = balance;
            assert.isTrue(transferAmount.gt(0), 'transfer amount was non-zero');
            assert.isTrue(allowanceAfter.eq(0), 'allowance reduced to 0');
            assert.isTrue(recipientBefore.add(transferAmount).eq(recipientAfter), 'balance increased correctly');
            source = recipient;
            recipient = owner;
            return token.approve(sender, transferAmount, {from: source});
        }).then(function () {
            return token.balanceOf.call(recipient)
        }).then(function (balance) {
            recipientBefore = balance;
            return token.allowance.call(source, sender);
        }).then(function (allowance) {
            allowanceBefore = allowance;
            assert.isTrue(allowanceBefore.eq(transferAmount), 'allowance was set correctly');
            return token.transferFrom(source, recipient, transferAmount, {from: sender}).catch(function () { });
        }).then(function () {
            return token.balanceOf.call(recipient)
        }).then(function (balance) {
            recipientAfter = balance;
            return token.allowance.call(source, sender);
        }).then(function (allowance) {
            allowanceAfter = allowance;
            assert.isTrue(allowanceBefore.eq(allowanceAfter), 'allowance remained unchanged');
            assert.isTrue(recipientBefore.eq(recipientAfter), 'recipient balance remained unchanged');
        });
    });

    it('should allow ICO to spend owner\'s tokens', function () {
        var balanceBefore, balanceAfter, transferAmount = 100;
        return token.balanceOf.call(accounts[1]).then(function (balance) {
            balanceBefore = balance;
            return token.transferFrom(owner, accounts[1], transferAmount, {from: crowdsale});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceBefore.add(transferAmount).eq(balanceAfter), 'balance was increased correctly ');
        });
    });

    it('should not allow account to spend more than its allowance', function () {
        var allowance, balanceBefore, balanceAfter;

        return token.allowance.call(owner, crowdsale).then(function (_allowance) {
            allowance = _allowance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.transferFrom(owner, accounts[1], allowance.add(1), {from: crowdsale}).catch(function () { });
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceBefore.eq(balanceAfter), 'balance remained unchanged');
        })
    });

    it('should allow everyone to make transfers after start time', function () {
        var startTime, transferAmount = 50, balanceFromBefore, balanceFromAfter, balanceToBefore, balanceToAfter, fromAccount = accounts[1], toAccount = accounts[2];

        return token.startTime.call().then(function (timestamp) {
            startTime = timestamp;
            return advanceTime(startTime);
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gt(startTime), 'ICO started');
            return token.balanceOf.call(fromAccount);
        }).then(function (balance) {
            balanceFromBefore = balance;
            return token.balanceOf.call(toAccount);
        }).then(function (balance) {
            balanceToBefore = balance;
            return token.transfer(toAccount, transferAmount, {from: fromAccount});
        }).then(function () {
            return token.balanceOf.call(fromAccount);
        }).then(function (balance) {
            balanceFromAfter = balance;
            return token.balanceOf.call(toAccount);
        }).then(function (balance) {
            balanceToAfter = balance;
            assert.isTrue(balanceFromBefore.eq(balanceFromAfter.add(transferAmount)), 'sender balance reduced by the correct amount');
            assert.isTrue(balanceToBefore.eq(balanceToAfter.sub(transferAmount)), 'recipient balance increased by the correct amount');
        });
    });

    it('should prevent the owner from spending more than the locked amount', function () {
        var lockReleaseTime, ownerBalanceBefore, ownerBalanceAfter, balanceBefore, balanceAfter, lockedAmount;

        return token.lockReleaseTime.call().then(function (timestamp) {
            lockReleaseTime = timestamp;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.lt(lockReleaseTime));
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceBefore = balance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount;
            assert.isTrue(_lockedAmount.gt(0), 'locked amount is a non-zero value');
            assert.isTrue(ownerBalanceBefore.gt(lockedAmount), 'owner has more tokens in balance than the locked amount');
            var amountToSpend = ownerBalanceBefore.sub(lockedAmount).add(1);
            return token.transfer(accounts[1], amountToSpend, {from: owner}).catch(function () {});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceBefore.eq(balanceAfter), 'recipient balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceAfter = balance;
            assert.isTrue(ownerBalanceBefore.eq(ownerBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should allow owner to spend more than the locked amount after lock is released', function () {
        var lockReleaseTime, ownerBalanceBefore, ownerBalanceAfter, balanceBefore, balanceAfter, lockedAmount, transferAmount;

        return token.lockReleaseTime.call().then(function (timestamp) {
            lockReleaseTime = timestamp;
            return advanceTime(lockReleaseTime);
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gt(lockReleaseTime), 'lock release date had passed');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceBefore = balance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount;
            assert.isTrue(lockedAmount.gt(0), 'locked amount is a non-zero value');
            transferAmount = ownerBalanceBefore.sub(lockedAmount).add(1);
            return token.transfer(accounts[1], transferAmount, {from: owner});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(transferAmount)), 'recipient balance was increased by the correct amount');
            assert.isTrue(ownerBalanceAfter.eq(ownerBalanceBefore.sub(transferAmount)), 'owner balance was reduced by the correct amount');
        });
    });


    it('should prevent ownership transfers for non-owners', function () {
        var currentOwner, newOwner = accounts[3], notOwner = accounts[4], lockReleaseTime;

        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner);
            return token.lockReleaseTime.call();
        }).then(function (_lockReleaseTime) {
            lockReleaseTime = _lockReleaseTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockReleaseTime), 'lock release time had passed');
            assert.notEqual(notOwner, currentOwner, 'the new owner address does not match current owner address');
            return token.transferOwnership(newOwner, {from: notOwner}).catch(function () { });
        }).then(function () {
            return token.owner.call();
        }).then(function (_owner) {
            assert.notEqual(_owner, newOwner, 'current owner is not the address that was attempted to set');
            assert.equal(_owner, currentOwner, 'current owner remained the same');
        });
    });

    it('should allow ownership transfers after token lock is released', function () {
        var currentOwner, newOwner = accounts[3], lockReleaseTime;
        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner, 'new owner does not match the current owner');
            return token.lockReleaseTime.call();
        }).then(function (_lockReleaseTime) {
            lockReleaseTime = _lockReleaseTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockReleaseTime), 'lock release time had passed');
            return token.transferOwnership(newOwner, {from: owner});
        }).then(function () {
            return token.owner.call();
        }).then(function (_owner) {
            assert.equal(_owner, newOwner, 'owner was changed successfully');
            return token.transferOwnership(currentOwner, {from: newOwner}); // revert changes
        });
    });

    it('should allow the owner to pause and unpause transfers', function () {
        var amount = 100, balanceBefore, balanceAfter;

        return token.pause({from: owner}).then(function(){
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.transfer(accounts[1], amount, {from: owner}).catch(function () {});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function(balance){
        	balanceAfter = balance;
        	assert.isTrue(balanceBefore.eq(balanceAfter), 'balance remained unchanged');
        }).then(function () {
            return token.unpause({from: owner});
        }).then(function(){
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.transfer(accounts[1], amount, {from: owner});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function(balance){
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was changed correctly');
        });
    });
});

contract('BitDegreeCrowdsale', function (accounts) {
    var token, ico, rate = 10000, owner = accounts[0], wallet = accounts[9], startTime, endTime, softCap, hardCap;

    function resetContracts(cb) {
        BitDegreeToken.new().then(function (instance) {
            token = instance;
            return advanceTime(1000);
        }).then(function (newTime) {
            startTime = newTime.add(1000);
            endTime = startTime.add(1000);
            return token.owner.call();
        }).then(function (_owner) {
            return BitDegreeCrowdsale.new(
                startTime,
                endTime,
                rate,
                wallet, // destination wallet
                token.address, // deployed contract
                _owner
            );
        }).then(function(instance){
            ico = instance;

            token.setCrowdsaleAddress(ico.address, {from: owner}).then(function () {
                cb();
            }).catch(cb);
        });
    }

    before(resetContracts);

    it('should initialize', function () {
        var currentTime;

        return getTime().then(function(_currentTime) {
            currentTime = _currentTime;
            return ico.startTime.call();
        }).then(function(_startTime){
            startTime = _startTime;
            assert.isTrue(startTime.gte(currentTime), 'start time is in the future');
            return ico.endTime.call();
        }).then(function(_endTime){
            endTime = _endTime;
            assert.isTrue(endTime.gt(startTime), 'end time is after start time');
            return ico.rate.call();
        }).then(function(_rate){
            rate = _rate;
            assert.isTrue(rate.gte(10000), 'rate is at least 10k');
            assert.isTrue(rate.lte(12500), 'rate is at most 12.5k');
            return ico.owner.call();
        }).then(function(_owner){
            assert.equal(owner, _owner, 'owner is set correctly');
            return ico.wallet.call();
        }).then(function (_wallet) {
            assert.equal(wallet, _wallet, 'wallet is set correctly');
            return ico.reward.call();
        }).then(function (reward) {
            assert.equal(reward, token.address, 'reward address is set correctly');
        });
    });

    it('should prevent investments before start time', function () {
        var balanceBefore, balanceAfter, account = accounts[1], amount = 100;
        return ico.balanceOf.call(account).then(function(balance){
            balanceBefore = balance;
            return ico.buyTokens(account, {from: account, value: amount}).catch(function () {});
        }).then(function(){
            return getTime();
        }).then(function(currentTime){
            assert.isTrue(currentTime.lt(startTime), 'start time is in the future');
            return ico.balanceOf.call(account);
        }).then(function(balance){
            balanceAfter = balance;
            assert.isTrue(balanceBefore.eq(balanceAfter), 'balance remained unchanged');
        });
    });

    it('should prevent empty (0 Wei) donations', function () {
        var currentTime;
        return ico.startTime.call().then(function (startTime) {
            return advanceTime(startTime);
        }).then(function (_currentTime) {
            currentTime = _currentTime;
            return ico.buyTokens(accounts[1], {from: accounts[1], value: 0});
        }).then(function () {
            assert.isAtLeast(currentTime.gte(startTime), 'start time had passed');
            assert.equal(1,0, '0 wei donation was accepted');
        }).catch(function () {});
    });


    it('should accept investments and correctly distribute tokens', function () {
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, account = accounts[1], amount = new Big(500);

        return ico.balanceOf.call(account).then(function (balance) {
            balanceBefore = balance;
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldBefore = balance;
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.buyTokens(account, {from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(account);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was increased correctly');
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldAfter = balance;
            assert.isTrue(soldAfter.eq(soldBefore.add(amount.mul(rate))), 'number of sold tokens was increased correctly');
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensAfter = balance;
            assert.isTrue(tokensAfter.eq(tokensBefore.add(amount.mul(rate))), 'token balance was increased correctly');
        });
    });

    it('should prevent the owner from using too high or too low token rates', function () {
        var rateBefore, minValue = new Big(10000), maxValue = new Big(12500);

        return ico.rate.call().then(function (rate) {
            rateBefore = rate;
            assert.isTrue(rate.gte(minValue), 'rate is greater than or equal to min value');
            assert.isTrue(rate.lte(maxValue), 'rate is lower than or equal to max value');
            return ico.setRate(minValue.sub(1), {from: owner}).catch(function () {});
        }).then(function () {
            return ico.rate.call();
        }, function (rate) {
            assert.isTrue(rate.eq(rateBefore), 'rate remained unchanged');
            return ico.setRate(maxValue+1, {from: owner}).catch(function () {});
        }, function () {
            return ico.rate.call();
        }, function (rate) {
            assert.isTrue(rate.eq(rateBefore), 'rate remained unchanged');
        })
    });

    it('should allow the owner to change the token rate', function () {
        var rateBefore, newRate = rate.add(1000);

        return ico.rate.call().then(function (rate) {
            rateBefore = rate;
            assert.isFalse(rateBefore.eq(newRate), 'new rate is not the same as existing rate');
            return ico.setRate(newRate, {from: owner});
        }).then(function () {
            return ico.rate.call();
        }).then(function (rateAfter) {
            assert.isTrue(rateAfter.eq(newRate), 'new rate was set');
            assert.isFalse(rateBefore.eq(rateAfter), 'rate was changed compared to previous rate');
            return ico.setRate(rateBefore, {from: owner}); // return to old rate @todo ?
        });
    });

    it('should prevent non-owners from changing the token rate', function () {
        var rateBefore, newRate = rate.add(1500), account = accounts[1];

        return ico.rate.call().then(function (rate) {
            rateBefore = rate;
            assert.notEqual(account, owner, 'the calling account is not an owner');
            return ico.setRate(newRate, {from: account}).catch(function(){});
        }).then(function () {
            return ico.rate.call();
        }).then(function (rateAfter) {
            assert.isTrue(rateAfter.eq(rateBefore), 'rate remained unchanged');
        });
    });

    it('should accept investments for third party beneficiaries and correctly distribute their tokens', function () {
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, account = accounts[1], beneficiary = accounts[2], amount = new Big(30);

        return ico.balanceOf.call(beneficiary).then(function (balance) {
            balanceBefore = balance;
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldBefore = balance;
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.buyTokens(beneficiary, {from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(beneficiary);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was increased correctly');
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldAfter = balance;
            assert.isTrue(soldAfter.eq(soldBefore.add(amount.mul(rate))), 'sold tokens counter was increased correctly');
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensAfter = balance;
            assert.isTrue(tokensAfter.eq(tokensBefore.add(amount.mul(rate))), 'token balance was increased correctly');
        });
    });

    it('should should accept investments through the fallback function', function () {
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, account = accounts[1], amount = web3.toWei(1, "ether");

        return ico.balanceOf.call(account).then(function (balance) {
            balanceBefore = balance;
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldBefore = balance;
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.sendTransaction({from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(account);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was increased correctly');
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldAfter = balance;
            assert.isTrue(soldAfter.eq(soldBefore.add(rate.mul(amount))), 'sold tokens counter was increased correctly');
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensAfter = balance;
            assert.isTrue(tokensAfter.eq(tokensBefore.add(rate.mul(amount))), 'token balance was increase correctly');
        });
    });

    it('should NOT be possible for the wallet to return funds if crowdsale had not ended', function () {
        var walletBalanceBefore = web3.eth.getBalance(wallet), icoBalanceBefore = web3.eth.getBalance(ico.address);
        var icoBalanceAfter, softCap;

        return ico.softCap.call().then(function (_softCap) {
            softCap = _softCap;
            assert.isTrue(softCap.lt(walletBalanceBefore), 'wallet has enough funds');
            assert.isTrue(icoBalanceBefore.eq(0), 'ICO balance 0 before ETH is returned');
            return ico.sendTransaction({from: wallet, value: softCap}).catch(function () { });
        }).then(function () {
            icoBalanceAfter = web3.eth.getBalance(ico.address);
            assert.isTrue(icoBalanceAfter.eq(icoBalanceBefore), 'ICO balance unchanged');
        });
    });

    it('should be possible to reach hard cap', function () {
        var tokensSold, hardCap, toSpend;
        return ico.tokensSold.call().then(function (_sold) {
            tokensSold = _sold;
            return ico.hardCap.call();
        }).then(function (_hardCap) {
            hardCap = _hardCap;
            assert.isTrue(tokensSold.lt(hardCap), 'not all tokens are sold');
            toSpend = hardCap.sub(tokensSold).div(rate);
            return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend.toFixed()});
        }).then(function () {
            // check if exactly the maximum number of public tokens was sold
            return ico.tokensSold.call();
        }).then(function (sold) {
            assert.isTrue(sold.eq(hardCap), 'exactly hard cap was sold');
        });
    });

    it('should not be possible to transfer funds after crowdsale end time had passed and soft cap was reached', function (cb) {
        // Reset the contracts
        resetContracts(function () {
            var soldBefore, soldAfter, account = accounts[2], softCapPrice;

            // Set the crowdsale address first
            ico.startTime.call().then(function () {
                return advanceTime(startTime);
            }).then(function () {
                return ico.softCap.call();
            }).then(function (_softCap) {
                softCap = _softCap;
                softCapPrice = softCap.div(rate);
                return ico.buyTokens(account, {from: account, value: softCapPrice});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (balance) {
                soldBefore = balance;
                assert.isTrue(softCap.eq(soldBefore), 'exactly soft cap is sold');
                return advanceTime(endTime);
            }).then(function () {
                return ico.buyTokens(account, {from: account, value: 100}).catch(function () {});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (balance) {
                soldAfter = balance;
                assert.isTrue(soldBefore.eq(soldAfter), 'no extra tokens were sold');
                cb();
            });
        });
    });

    it('should NOT be possible for the wallet to return funds if crowdsale ended but soft cap was reached', function () {
        var walletBalanceBefore = web3.eth.getBalance(wallet), icoBalanceBefore = web3.eth.getBalance(ico.address);
        var icoBalanceAfter, softCap, tokensSold;

        return ico.softCap.call().then(function (_softCap) {
            softCap = _softCap;
            assert.isTrue(softCap.lt(walletBalanceBefore), 'wallet has enough funds');
            assert.isTrue(icoBalanceBefore.eq(0), 'ICO balance 0 before ETH is returned');
            return ico.tokensSold.call();
        }).then(function (_tokensSold) {
            tokensSold = _tokensSold;
            assert.isTrue(tokensSold.gte(softCap), 'the number of sold tokens is greater than or equal to the soft cap');
            return ico.sendTransaction({from: wallet, value: softCap}).catch(function () { });
        }).then(function () {
            icoBalanceAfter = web3.eth.getBalance(ico.address);
            assert.isTrue(icoBalanceAfter.eq(icoBalanceBefore), 'ICO balance unchanged');
        });
    });

    it('should not be possible to buy tokens after crowdsale end time had passed and soft cap is not reached', function (cb) {
        resetContracts(function () {
            var soldBefore, soldAfter, transferAmount, account = accounts[2], account2 = accounts[3], softCap, rate;

            ico.startTime.call().then(function () {
                return advanceTime(startTime);
            }).then(function () {
                return ico.rate.call();
            }).then(function (_rate) {
                rate = _rate;
                return ico.softCap.call();
            }).then(function (_softCap) {
                softCap = _softCap;
                transferAmount = softCap.sub(rate.mul(2)).div(rate);
                return ico.buyTokens(account, {from: account, value: transferAmount});
            }).then(function () {
                return ico.buyTokens(account, {from: account2, value: 1}); // buy from 2 accounts, used in further tests
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (sold) {
                soldBefore = sold;
                assert.isTrue(soldBefore.lt(softCap), 'soft cap not reached');
                return advanceTime(endTime);
            }).then(function () {
                return ico.buyTokens(account, {from: account, value: 100}).catch(function () {});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (balance) {
                soldAfter = balance;
                assert.isTrue(soldBefore.eq(soldAfter), 'no extra tokens were sold');
                cb();
            });
        });
    });

    it('should be possible for the wallet to return funds to allow refunds (crowdsale ended, soft cap not reached)', function () {
        var walletBalanceBefore = web3.eth.getBalance(wallet), icoBalanceBefore = web3.eth.getBalance(ico.address);
        var walletBalanceAfter, icoBalanceAfter, softCap;

        return ico.softCap.call().then(function (_softCap) {
            softCap = _softCap;
            assert.isTrue(softCap.lt(walletBalanceBefore), 'wallet has enough funds');
            assert.isTrue(icoBalanceBefore.eq(0), 'ICO balance 0 before ETH is returned');
            return ico.sendTransaction({from: wallet, value: softCap});
        }).then(function () {
            walletBalanceAfter = web3.eth.getBalance(wallet);
            icoBalanceAfter = web3.eth.getBalance(ico.address);
            assert.isTrue(walletBalanceBefore.gt(walletBalanceAfter), 'wallet balance was reduced');
            assert.isTrue(icoBalanceAfter.eq(softCap), 'ICO balance is equal to soft cap (an arbitrary number that was sent from the wallet)');
        });
    });

    it('should allow withdrawals if soft cap was not reached and funds have been returned from the wallet', function () {
        var tokensSold, donationBefore, donationAfter, accountBalanceBefore, accountBalanceAfter, icoBalanceBefore, icoBalanceAfter, account = accounts[2], endTime;

        return ico.tokensSold.call().then(function (_tokensSold) {
            tokensSold = _tokensSold;
            assert.isTrue(tokensSold.lt(softCap), 'soft cap was not reached');
            return ico.endTime.call();
        }).then(function(_endTime) {
            endTime = _endTime;
            return getTime();
        }).then(function(timestamp) {
            assert.isTrue(endTime.lt(timestamp), 'end time had passed');
            return ico.balanceOf.call(account);
        }).then(function(balance){
        	donationBefore = balance;
            accountBalanceBefore = web3.eth.getBalance(account);
            icoBalanceBefore = web3.eth.getBalance(ico.address);
            assert.isTrue(donationBefore.gt(0), 'user donated at least 1 wei');
            assert.isTrue(icoBalanceBefore.gt(donationBefore), 'ICO has enough funds to refund the user');
            return ico.claimRefund({from: account});
        }).then(function(){
        	accountBalanceAfter = web3.eth.getBalance(account);
            icoBalanceAfter = web3.eth.getBalance(ico.address);
        	assert.isTrue(accountBalanceAfter.gt(accountBalanceBefore), 'balance increased after refund was claimed');
        	assert.isTrue(icoBalanceBefore.sub(donationBefore).eq(icoBalanceAfter), 'correct amount of ETH was sent from ICO');
        	assert.isTrue(icoBalanceBefore.gt(0), 'not all ETH was sent from ICO');
        	return ico.balanceOf.call(account);
        }).then(function (balance) {
            donationAfter = balance;
            assert.isTrue(donationAfter.eq(0), 'donation reset to 0');
        });
    });

    it('should return excess ether to the buyer if their contribution exceeds the hard cap', function (cb) {
        resetContracts(function () {
            var transferAmount, soldBefore, soldAfter, walletBefore, walletAfter, accountBalanceBefore, accountBalanceAfter, tokensBefore, tokensAfter, contributionBefore, contributionAfter, hardCap, hardCapPrice, rate, wallet;
            var account = accounts[2], exceedBy = new Big(1500000000);

            ico.hardCap.call().then(function (cap) {
                hardCap = cap;
                return ico.wallet.call();
            }).then(function (_wallet) {
                wallet = _wallet;
                return ico.rate.call();
            }).then(function (_rate) {
                rate = _rate;
                return ico.startTime.call();
            }).then(function (startTime) {
                transferAmount = hardCap.add(exceedBy);
                assert.isTrue(exceedBy.gt(0), 'exceed number is greater than 0');
                assert.isTrue(transferAmount.gt(hardCap), 'hard cap will actually be exceeded');
                return advanceTime(startTime.add(500));
            }).then(function () {
                return ico.balanceOf.call(account);
            }).then(function (balance) {
                contributionBefore = balance;
                assert.isTrue(contributionBefore.eq(0), 'user made no contributions so far');
                return ico.tokensSold.call();
            }).then(function (_tokensSold) {
                soldBefore = _tokensSold;
                assert.isTrue(soldBefore.eq(0), 'no tokens were sold yet');
                return web3.eth.getBalance(account);
            }).then(function (balance) {
                accountBalanceBefore = balance;
                assert.isTrue(accountBalanceBefore.gt(transferAmount), 'account has enough funds to make the transfer');
                return web3.eth.getBalance(wallet);
            }).then(function (balance) {
                walletBefore = balance;
                return token.balanceOf.call(account);
            }).then(function (balance) {
                tokensBefore = balance;
                assert.isTrue(tokensBefore.eq(0), 'account does not hold any tokens');
                return ico.buyTokens(account, {from: account, value: transferAmount});
            }).then(function () {
                return ico.balanceOf.call(account);
            }).then(function (balance) {
                contributionAfter = balance;
                hardCapPrice = hardCap.div(rate);
                assert.isTrue(contributionBefore.add(hardCapPrice).eq(contributionAfter), 'only the hard cap worth of wei was counted in balances mapping');
                return ico.tokensSold.call();
            }).then(function (_tokensSold) {
                soldAfter = _tokensSold;
                assert.isTrue(hardCap.eq(soldAfter), 'the number of sold tokens is exactly the same as the hard cap');
                return web3.eth.getBalance(account);
            }).then(function (balance) {
                accountBalanceAfter = balance;
                assert.isTrue(accountBalanceBefore.sub(transferAmount).lt(accountBalanceAfter), 'excess funds were returned to the user');
                return web3.eth.getBalance(wallet);
            }).then(function (balance) {
                walletAfter = balance;
                assert.isTrue(walletBefore.add(hardCapPrice).eq(walletAfter), 'ICO wallet received only the hard cap worth of ETH');
                return token.balanceOf.call(account);
            }).then(function (balance) {
                tokensAfter = balance;
                assert.isTrue(tokensBefore.add(hardCap).eq(tokensAfter), 'user received only the hard cap worth of tokens');
                cb();
            });
        });
    });

});


function advanceTime(to) {
    to = new Big(to);
    return new Promise(function (resolve, reject) {
        try {
            var currentTime = new Big(web3.eth.getBlock(web3.eth.blockNumber).timestamp);
            var increaseBy = to.sub(currentTime).add(1);

            if (increaseBy < 0) {
                increaseBy = to;
            }

            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [increaseBy.toNumber()],
                id: new Date().getTime()
            });

            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_mine",
                params: [],
                id: new Date().getTime()
            });

            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;

            resolve(new Big(currentTime));
        }catch (e) {
            console.error(e);
            reject(e);
        }
    });
}

function getTime() {
    return new Promise(function (resolve) {
        resolve(new Big(web3.eth.getBlock(web3.eth.blockNumber).timestamp));
    });
}
