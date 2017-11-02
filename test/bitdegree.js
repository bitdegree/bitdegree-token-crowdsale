var BitDegreeToken = artifacts.require('./BitDegreeToken.sol');
var BitDegreeCrowdsale = artifacts.require('./BitDegreeCrowdsale.sol');

var currentTime;

contract('BitDegreeToken', function (accounts) {

    var owner = accounts[0], crowdsale = accounts[accounts.length-1];

    it('should initialize token distribution', function () {
        var token, totalSupply, lockedAmount, reservedAmount, publicAmount;
        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.totalSupply.call();
        }).then(function (_totalSupply) {
            totalSupply = _totalSupply.toNumber();
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount.toNumber();
            return token.publicAmount.call();
        }).then(function (_publicAmount) {
            publicAmount = _publicAmount.toNumber();
            assert.isAbove(totalSupply, 0);
            assert.isBelow(publicAmount, totalSupply);
            assert.isBelow(lockedAmount, totalSupply);
            assert.isBelow(publicAmount + lockedAmount, totalSupply);
        });
    });

    it('should set the owner', function () {
        var token;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.owner.call();
        }).then(function (_owner) {
            assert.equal(owner, _owner);
        });
    });

    it('should set correctly the initial balance of the owner', function () {
        var token, totalSupply;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.totalSupply.call();
        }).then(function (_totalSupply) {
            totalSupply = _totalSupply;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.equal(totalSupply.valueOf(), balance.valueOf());
        })
    });

    it('should set the start and lock times', function () {
        var token, startTime;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.startTime.call();
        }).then(function (_startTime) {
            startTime = _startTime.toNumber();
            assert.isAbove(startTime, 0);
            return token.lockReleaseTime.call();
        }).then(function (lockReleaseTime) {
            assert.equal(160 * 3600 * 24 + startTime, lockReleaseTime.toNumber());
        });
    });

    it('should allow regular accounts to set allowance', function () {
        var token, allowanceToSet = 100;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.equal(allowance, 0);
            return token.approve(accounts[2], allowanceToSet, {from: accounts[1]});
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.equal(allowance, allowanceToSet);
        });
    });

    it('should not allow accounts to change allowance to non-zero value', function () {
        var token, newAllowance = 200;
        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.approve(accounts[2], newAllowance, {from: accounts[1]}).catch(function () {
            });
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.notEqual(allowance.toNumber(), newAllowance);
        });
    });

    it('should allow accounts to change allowance to zero', function () {
        var token;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.approve(accounts[2], 0, {from: accounts[1]});
        }).then(function () {
            return token.allowance.call(accounts[1], accounts[2]);
        }).then(function (allowance) {
            assert.equal(allowance, 0);
        });
    });


    it('should allow owner to set the crowdsale address', function () {
        var token;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.setCrowdsaleAddress(crowdsale, {from: owner});
        }).then(function () {
            return token.crowdsaleAddress.call();
        }).then(function (currentAddress) {
            assert.equal(crowdsale, currentAddress);
        });
    });


    it('should set the initial allowance for the crowdsale address', function () {
        var token, allowance;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.allowance.call(owner, crowdsale);
        }).then(function (_allowance) {
            allowance = _allowance.valueOf();
            return token.publicAmount.call();
        }).then(function (publicAmount) {
            assert.equal(publicAmount.valueOf(), allowance);
        });
    });

    it('should prevent regular accounts from setting the crowdsale address', function () {
        var token;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.setCrowdsaleAddress(accounts[2], {from: accounts[1]}).catch(function () {
            });
        }).then(function () {
            return token.crowdsaleAddress.call();
        }).then(function (address) {
            assert.equal(address, crowdsale);
            assert.notEqual(crowdsale, accounts[2]);
        });
    });

    it('should prevent transfers before start time', function () {
        var token, startTime, balanceBefore, balanceAfter, transferAmount = 100;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.startTime.call();
        }).then(function (_startTime) {
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            startTime = _startTime;
            assert.isAbove(startTime, currentTime);
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.isAbove(balance, transferAmount);
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transfer(accounts[1], transferAmount, {from: owner}).catch(function () {
            });
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance.toNumber();
            assert.isAbove(transferAmount, 0);
            assert.equal(balanceBefore, balanceAfter);
        });
    });

    it('should prevent non-owners tokens from being spent before start time', function () {
        var token, startTime, balanceBefore, balanceAfter, transferAmount = 50;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.startTime.call();
        }).then(function (_startTime) {
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            startTime = _startTime;
            assert.isAbove(startTime, currentTime);
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            assert.isAbove(balance, transferAmount);
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transferFrom(accounts[1], accounts[2], transferAmount, {from: accounts[2]}).catch(function () {
            });
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance.toNumber();
            assert.isAbove(transferAmount, 0);
            assert.equal(balanceBefore, balanceAfter);
        });
    });

    it('should allow ICO to spend owner\'s tokens', function () {
        var token, balanceBefore, balanceAfter, transferAmount = 100;
        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transferFrom(owner, accounts[1], transferAmount, {from: crowdsale});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance.toNumber();
            assert.equal(balanceBefore + transferAmount, balanceAfter);
        });
    });

    it('should not allow account to spend more than its allowance', function () {
        var token, allowance, balanceBefore, balanceAfter;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.allowance.call(owner, crowdsale);
        }).then(function (_allowance) {
            allowance = _allowance.toNumber();
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transferFrom(owner, accounts[1], allowance + 1).catch(function () {
            });
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance.toNumber();
            assert.equal(balanceBefore, balanceAfter);
        })
    });

    it('should allow everyone to make transfers after start time', function () {
        var token, currentTime, startTime, transferAmount = 50, balanceFromBefore, balanceFromAfter, balanceToBefore,
            balanceToAfter;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            return token.startTime.call();
        }).then(function (timestamp) {
            startTime = timestamp.toNumber();
            // Advance time
            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [startTime-currentTime],
                id: new Date().getTime()
            });
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceFromBefore = balance.toNumber();
            return token.balanceOf.call(accounts[2]);
        }).then(function (balance) {
            balanceToBefore = balance.toNumber();
            return token.transfer(accounts[2], transferAmount, {from: accounts[1]});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceFromAfter = balance.toNumber();
            return token.balanceOf.call(accounts[2]);
        }).then(function (balance) {
            balanceToAfter = balance.toNumber();
            assert.equal(balanceFromBefore, balanceFromAfter + transferAmount);
            assert.equal(balanceToBefore, balanceToAfter - transferAmount);
            assert.isAtLeast(web3.eth.getBlock(web3.eth.blockNumber).timestamp, startTime);
        });
    });

    it('should prevent the owner from spending more than the locked amount', function () {
        var token, lockReleaseTime, ownerBalanceBefore, ownerBalanceAfter, balanceBefore, balanceAfter, lockedAmount,
            currentTime;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.lockReleaseTime.call();
        }).then(function (timestamp) {
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            lockReleaseTime = timestamp.toNumber();
            assert.isBelow(currentTime, lockReleaseTime);
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceBefore = balance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount;
            assert.isAbove(_lockedAmount, 0);
            var amountToSpend = ownerBalanceBefore.sub(lockedAmount).add(1);
            return token.transfer(accounts[1], amountToSpend, {from: owner}).catch(function () {});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.equal(balanceBefore.toFixed(), balanceAfter.toFixed());
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceAfter = balance;
            assert.equal(ownerBalanceBefore.toFixed(), ownerBalanceAfter.toFixed());
        });
    });

    it('should allow owner to spend more than the locked amount after lock is released', function () {
        var token, lockReleaseTime, ownerBalanceBefore, ownerBalanceAfter, balanceBefore, balanceAfter, lockedAmount,
            currentTime, transferAmount;

        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.lockReleaseTime.call();
        }).then(function (timestamp) {
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            lockReleaseTime = timestamp.toNumber();
            assert.isBelow(currentTime, lockReleaseTime);

            web3.currentProvider.send({
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [lockReleaseTime-currentTime],
                id: new Date().getTime()
            });

            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceBefore = balance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            return token.lockedAmount.call();
        }).then(function (_lockedAmount) {
            lockedAmount = _lockedAmount;
            assert.isAbove(_lockedAmount, 0);
            transferAmount = ownerBalanceBefore.sub(lockedAmount).add(1);
            return token.transfer(accounts[1], transferAmount, {from: owner});
        }).then(function () {
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            assert.isAtLeast(currentTime.toFixed(), lockReleaseTime.toFixed());
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.equal(balanceAfter.toFixed(), balanceBefore.add(transferAmount).toFixed());
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalanceAfter = balance;
            assert.equal(ownerBalanceAfter.toFixed(), ownerBalanceBefore.sub(transferAmount).toFixed());
        });
    });

    it('should allow the owner to pause and unpause transfers', function () {
        var token, amount = 100, balanceBefore, balanceAfter;
        return BitDegreeToken.deployed().then(function (instance) {
            token = instance;
            return token.pause({from: owner});
        }).then(function(){
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transfer(accounts[1], amount, {from: owner}).catch(function () {});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function(balance){
        	balanceAfter = balance.toNumber();
        	assert.equal(balanceBefore, balanceAfter);
        }).then(function () {
            return token.unpause({from: owner});
        }).then(function(){
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance.toNumber();
            return token.transfer(accounts[1], amount, {from: owner});
        }).then(function () {
            return token.balanceOf.call(accounts[1]);
        }).then(function(balance){
            balanceAfter = balance.toNumber();
            assert.equal(balanceAfter, balanceBefore + amount);
        });
    });
});


contract('BitDegreeCrowdsale', function (accounts) {
    var token, ico, rate = 10000, owner = accounts[0], wallet = accounts[9], startTime, endTime, softCap, hardCap;

    function resetContracts(cb) {
        startTime = (currentTime || web3.eth.getBlock(web3.eth.blockNumber).timestamp) + 100000000;
        endTime = startTime + 1000;

        BitDegreeToken.new(endTime).then(function (instance) {
            token = instance;
            return instance.owner.call();
        }).then(function (owner) {
            return BitDegreeCrowdsale.new(
                startTime,
                endTime,
                rate,
                wallet, // destination wallet
                token.address, // deployed contract
                owner
            ).then(function(instance){
                ico = instance;
                cb();
            });
        });
    }

    before(resetContracts);

    it('should initialize', function () {
        return ico.startTime.call().then(function(_startTime){
            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            startTime = _startTime.toNumber();
            assert.isAtLeast(startTime, currentTime);
            return ico.endTime.call();
        }).then(function(_endTime){
            endTime = _endTime.toNumber();
            assert.isAbove(endTime, startTime);
            return ico.rate.call();
        }).then(function(_rate){
            rate = _rate;
        	assert.equal(rate, _rate.toNumber());
        	return ico.owner.call();
        }).then(function(_owner){
            assert.equal(owner, _owner);
        	return ico.wallet.call();
        }).then(function (_wallet) {
            assert.equal(wallet, _wallet);
            return ico.reward.call();
        }).then(function (reward) {
            assert.equal(reward, token.address);
        });
    });

    it('should prevent investments before start time', function () {
        var weiBefore, weiAfter, account = accounts[1], amount = 100;
        return ico.balanceOf.call(account).then(function(balance){
        	weiBefore = balance.toNumber();
        	return ico.buyTokens(account, {from: account, value: amount}).catch(function () {});
        }).then(function(){
            assert.isBelow(web3.eth.getBlock(web3.eth.blockNumber).timestamp, startTime);
        	return ico.balanceOf.call(account);
        }).then(function(balance){
        	weiAfter = balance.toNumber();
        	assert.equal(weiBefore, weiAfter);
        });
    });

    it('should prevent empty (0 Wei) donations', function () {
        // Advance time
        currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [startTime-currentTime],
            id: new Date().getTime()
        });

        // Set crowdsale address to reward token first
        return token.setCrowdsaleAddress(ico.address, {from: owner}).then(function () {
            return ico.buyTokens(accounts[1], {from: accounts[1], value: 0}).then(function () {
                currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
                assert.isAtLeast(currentTime,startTime);
                assert.equal(1,0, 'promise was fulfilled');
            }).catch(function () {});
        })
    });

    it('should accept investments and correctly distribute tokens', function () {
        var weiBefore, weiAfter, tokensBefore, tokensAfter, raisedBefore, raisedAfter, account = accounts[1], amount = 500;

        return ico.balanceOf.call(account).then(function (balance) {
            weiBefore = balance.toNumber();
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedBefore = balance.toNumber();
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensBefore = balance.toNumber();
            return ico.buyTokens(account, {from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(account);
        }).then(function (balance) {
            weiAfter = balance.toNumber();
            assert.equal(weiAfter, weiBefore + amount);
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedAfter = balance.toNumber();
            assert.equal(raisedAfter, raisedBefore + amount);
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensAfter = balance.toNumber();
            assert.equal(tokensAfter, tokensBefore + amount * rate);
        });
    });

    it('should allow the owner to change the token rate', function () {
        var rateBefore, newRate = rate.add(1000);

        return ico.rate.call().then(function (rate) {
            rateBefore = rate;
            assert.notEqual(rateBefore.toNumber(), newRate.toNumber());
            return ico.setRate(newRate, {from: owner});
        }).then(function () {
            return ico.rate.call();
        }).then(function (rateAfter) {
            assert.equal(rateAfter.toNumber(), newRate.toNumber());
            assert.notEqual(rateBefore.toNumber(), rateAfter.toNumber());
            return ico.setRate(rateBefore, {from: owner}); // return to old rate
        });
    });

    it('should prevent non-owners from changing the token rate', function () {
        var rateBefore, newRate = rate.add(1500), account = accounts[1];

        return ico.rate.call().then(function (rate) {
            rateBefore = rate;
            assert.notEqual(account, owner);
            return ico.setRate(newRate, {from: account}).catch(function(){});
        }).then(function () {
            return ico.rate.call();
        }).then(function (rateAfter) {
            assert.equal(rateAfter.toNumber(), rateBefore.toNumber());
        });
    });

    it('should accept investments for third party beneficiaries and correctly distribute their tokens', function () {
        var weiBefore, weiAfter, tokensBefore, tokensAfter, raisedBefore, raisedAfter, account = accounts[1], beneficiary = accounts[2], amount = 30;

        return ico.balanceOf.call(beneficiary).then(function (balance) {
            weiBefore = balance.toNumber();
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedBefore = balance.toNumber();
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensBefore = balance.toNumber();
            return ico.buyTokens(beneficiary, {from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(beneficiary);
        }).then(function (balance) {
            weiAfter = balance.toNumber();
            assert.equal(weiAfter, weiBefore + amount);
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedAfter = balance.toNumber();
            assert.equal(raisedAfter, raisedBefore + amount);
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensAfter = balance.toNumber();
            assert.equal(tokensAfter, tokensBefore + amount * rate);
        });
    });

    it('should should accept investments through the fallback function', function () {
        var weiBefore, weiAfter, tokensBefore, tokensAfter, raisedBefore, raisedAfter, account = accounts[1], amount = web3.toWei(1, "ether");

        return ico.balanceOf.call(account).then(function (balance) {
            weiBefore = balance;
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedBefore = balance;
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.sendTransaction({from: account, value: amount});
        }).then(function () {
            return ico.balanceOf.call(account);
        }).then(function (balance) {
            weiAfter = balance;
            assert.equal(weiAfter.toFixed(), weiBefore.add(amount).toFixed());
            return ico.weiRaised.call();
        }).then(function (balance) {
            raisedAfter = balance;
            assert.equal(raisedAfter.toFixed(), raisedBefore.add(amount).toFixed());
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensAfter = balance;
            assert.equal(tokensAfter.toFixed(), tokensBefore.add(rate.times(amount)).toFixed());
        });
    });

    it('should prevent investments if it exceeds hard cap', function () {
        var weiRaised, toSpend;
        return ico.weiRaised.call().then(function (_weiRaised) {
            weiRaised = _weiRaised;
            return ico.hardCap.call();
        }).then(function (_hardCap) {
            hardCap = _hardCap;
            assert.isBelow(weiRaised, hardCap);
            toSpend = hardCap.sub(weiRaised).add(1);
            return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend.toFixed()}).catch(function () {});
        }).then(function(){
        	return ico.weiRaised.call();
        }).then(function (balance) {
            assert.equal(balance.toFixed(), weiRaised.toFixed());
        });
    });

    it('should prevent finalization before end time', function () {
        var stateBefore, stateAfter;
        return ico.isFinalized.call().then(function (state) {
            stateBefore = state;

            currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
            assert.isBelow(currentTime, endTime);

            return ico.finalize({from: owner}).catch(function () {});
        }).then(function () {
            return ico.isFinalized.call();
        }).then(function (state) {
            stateAfter = state;
            assert.equal(stateBefore, stateAfter);
            assert.isFalse(stateBefore);
        });
    });

    it('should be possible to reach hard cap', function () {
        var weiRaised, hardCap, toSpend, publicTokens, tokensSold;
        return ico.weiRaised.call().then(function (_weiRaised) {
            weiRaised = _weiRaised;
            return ico.hardCap.call();
        }).then(function (_hardCap) {
            hardCap = _hardCap;
            assert.isBelow(weiRaised, hardCap);
            toSpend = hardCap.sub(weiRaised);
            return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend.toFixed()});
        }).then(function(){
            return token.publicAmount.call();
        }).then(function (amount) {
            publicTokens = amount;
            return token.balanceOf.call(accounts[1]);
        }).then(function (tokens) {
            tokensSold = tokens;
            return token.balanceOf.call(accounts[2]);
        }).then(function (tokens) {
            tokensSold = tokensSold.add(tokens);
            // check if exactly the maximum number of public tokens was sold
            assert.equal(tokensSold.toFixed(), publicTokens.toFixed());
            return ico.weiRaised.call();
        }).then(function (balance) {
            assert.equal(balance.toFixed(), weiRaised.add(toSpend).toFixed());
            assert.equal(balance.toFixed(), hardCap.toFixed());
        });
    });

    it('should be finalized if end time has been reached', function () {
        // Advance time
        currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
        assert.isBelow(currentTime, endTime);

        web3.currentProvider.send({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [endTime-currentTime+1],
            id: new Date().getTime()
        });

        var stateBefore, stateAfter;

        return ico.isFinalized.call().then(function (state) {
            stateBefore = state;

            return ico.finalize({from: owner});
        }).then(function () {
            return ico.isFinalized.call();
        }).then(function (state) {
            stateAfter = state;

            assert.isFalse(stateBefore);
            assert.isTrue(stateAfter);
        });
    });

    it('should not be possible to transfer funds after crowdsale is finalized and soft cap is reached', function (cb) {
        // Reset the contracts
        resetContracts(function () {

            var weiBefore, weiAfter, account = accounts[2];

            // Set the crowdsale address first
            token.setCrowdsaleAddress(ico.address, {from: owner}).then(function () {
                return ico.startTime.call();
            }).then(function () {
                currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
                web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [startTime-currentTime],
                    id: new Date().getTime()
                });
                return ico.softCap.call();
            }).then(function (_softCap) {
                softCap = _softCap;
                return ico.buyTokens(account, {from: account, value: softCap.toFixed()});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiBefore = balance;
                assert.equal(softCap.toFixed(), weiBefore.toFixed());
                currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
                web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [endTime-currentTime+1],
                    id: new Date().getTime()
                });
                return ico.finalize({from: owner});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiAfter = balance;
                assert.equal(weiBefore.toFixed(), weiAfter.toFixed());
                weiBefore = weiAfter;
                weiAfter = null;
                return ico.isFinalized.call();
            }).then(function (isFinalized) {
                assert.isTrue(isFinalized);
                return ico.buyTokens(account, {from: account, value: 100}).catch(function () {});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiAfter = balance;
                assert.equal(weiBefore.toFixed(), weiAfter.toFixed());
                cb();
            });
        });
    });

    it('should not be possible to transfer funds after crowdsale is finalized and soft cap is not reached', function (cb) {
        // Reset the contracts
        resetContracts(function () {

            var weiBefore, weiAfter, transferAmount, account = accounts[2];

            // Set the crowdsale address first
            token.setCrowdsaleAddress(ico.address, {from: owner}).then(function () {
                return ico.startTime.call();
            }).then(function () {
                currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
                web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [startTime-currentTime],
                    id: new Date().getTime()
                });
                transferAmount = softCap.sub(1);
                return ico.buyTokens(account, {from: account, value: transferAmount.toFixed()});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiBefore = balance;
                assert.isBelow(balance.toFixed(), softCap.toFixed());
                currentTime = web3.eth.getBlock(web3.eth.blockNumber).timestamp;
                web3.currentProvider.send({
                    jsonrpc: "2.0",
                    method: "evm_increaseTime",
                    params: [endTime-currentTime+1],
                    id: new Date().getTime()
                });
                return ico.finalize({from: owner});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiAfter = balance;
                assert.equal(weiBefore.toFixed(), weiAfter.toFixed());
                weiBefore = weiAfter;
                weiAfter = null;
                return ico.isFinalized.call();
            }).then(function (isFinalized) {
                assert.isTrue(isFinalized);
                return ico.buyTokens(account, {from: account, value: 100}).catch(function () {});
            }).then(function () {
                return ico.weiRaised.call();
            }).then(function (balance) {
                weiAfter = balance;
                assert.equal(weiBefore.toFixed(), weiAfter.toFixed());
                cb();
            });
        });
    });

    it('should be possible for the wallet to return funds to allow refunds', function () {
        var weiRaisedBefore, walletBalanceBefore, icoBalanceBefore, weiRaisedAfter, walletBalanceAfter, icoBalanceAfter;

        return ico.weiRaised.call().then(function (amount) {
            weiRaisedBefore = amount;
            assert.isAbove(weiRaisedBefore, 0);
            walletBalanceBefore = web3.eth.getBalance(wallet);
            icoBalanceBefore = web3.eth.getBalance(ico.address);
            return ico.sendTransaction({from: wallet, value: weiRaisedBefore.toFixed()});
        }).then(function() {
            walletBalanceAfter = web3.eth.getBalance(wallet);
            icoBalanceAfter = web3.eth.getBalance(ico.address);
            return ico.weiRaised.call();
        }).then(function (balance) {
            weiRaisedAfter = balance;
            assert.isBelow(walletBalanceAfter.toFixed(), walletBalanceBefore.toFixed());
            assert.equal(icoBalanceBefore.toFixed(), 0);
            assert.equal(weiRaisedBefore.toFixed(), weiRaisedAfter.toFixed());
            assert.equal(weiRaisedBefore.toFixed(), icoBalanceAfter.toFixed());
        });
    });

    it('should allow withdrawals if soft cap was not reached and funds have been returned from the wallet', function () {
        var weiRaised, icoBalanceBefore, icoBalanceAfter, balanceBefore, balanceAfter, account = accounts[2];

        return ico.weiRaised.call().then(function (amount) {
            weiRaised = amount;
            assert.isBelow(weiRaised.toFixed(), softCap.toFixed());
            return ico.isFinalized.call();
        }).then(function(isFinalized){
        	assert.isTrue(isFinalized);
            return ico.balanceOf.call(account);
        }).then(function(balance){
        	icoBalanceBefore = balance;
        	assert.isAbove(icoBalanceBefore.toFixed(), 0);
            balanceBefore = web3.eth.getBalance(account);
            return ico.claimRefund({from: account});
        }).then(function(){
        	balanceAfter = web3.eth.getBalance(account);
        	assert.isAbove(balanceAfter.toFixed(), balanceBefore.toFixed());
        	return ico.balanceOf.call(account);
        }).then(function (balance) {
            icoBalanceAfter = balance;
            assert.equal(icoBalanceAfter, 0);
        });
    });
});
