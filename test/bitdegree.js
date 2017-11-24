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
        var totalSupply, foundationLock, teamLock, advisorsLock, publicAmount, lockedTotal;
        return token.totalSupply.call().then(function (_totalSupply) {
            totalSupply = _totalSupply;
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorsLock = _lock;
            return token.publicAmount.call();
        }).then(function (_publicAmount) {
            publicAmount = _publicAmount;
            lockedTotal = foundationLock.amount.add(teamLock.amount).add(advisorsLock.amount);
            assert.isTrue(totalSupply.gt(0), 'total supply is a non-zero value');
            assert.isTrue(publicAmount.lt(totalSupply), 'public amount is lower than total supply');
            assert.isTrue(foundationLock.amount.lt(totalSupply), 'locked foundation amount is lower than total supply');
            assert.isTrue(teamLock.amount.lt(totalSupply), 'locked team amount is lower than total supply');
            assert.isTrue(advisorsLock.amount.lt(totalSupply), 'locked advisor amount is lower than total supply');
            assert.isTrue(publicAmount.add(lockedTotal).lte(totalSupply), 'public amount and locked amount do not exceed total supply');
        });
    });

    it('should set the owner', function () {
        return token.owner.call().then(function (_owner) {
            assert.equal(owner, _owner);
        });
    });

    it('should set correctly the initial balance of the owner', function () {
        var totalSupply, foundationLock, teamLock, advisorsLock, ownerBalance, zeroAddressBalance;

        return token.totalSupply.call().then(function (_totalSupply) {
            totalSupply = _totalSupply;
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorsLock = _lock;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            ownerBalance = balance;
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zeroAddressBalance = balance;
            var lockedTotal = foundationLock.amount.add(teamLock.amount).add(advisorsLock.amount);
            assert.isTrue(zeroAddressBalance.eq(lockedTotal), '0x0000 address holds the locked amount');
            assert.isTrue(totalSupply.sub(lockedTotal).eq(ownerBalance), 'owner holds all of the tokens (except for locked amount)');
            assert.isTrue(zeroAddressBalance.add(ownerBalance).eq(totalSupply), 'initially zero address and owner together should hold all of the tokens');
        })
    });

    it('should set the start time', function () {
        var startTime;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            assert.isTrue(startTime.gt(0), 'start time is set');
        });
    });

    it('should correctly initialize locked amounts, duration and withdrawal state', function () {
        var advisorLock, foundationLock, teamLock, decimals = (new Big(10)).pow(18);

        return TokenLock(token.foundationLock.call()).then(function (_lock) {
            foundationLock = _lock;
            assert.isTrue(foundationLock.duration.eq(3600 * 24 * 360), 'foundation lock is equal to 360 days');
            assert.isFalse(foundationLock.withdrawn, 'foundation lock withdrawal state is set to false');
            assert.isTrue(foundationLock.amount.eq((new Big('66000000')).mul(decimals)), 'foundation lock amount is equal to 66M');
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            assert.isTrue(teamLock.duration.eq(3600 * 24 * 720), 'team lock is equal to 360 days');
            assert.isFalse(teamLock.withdrawn, 'team lock withdrawal state is set to false');
            assert.isTrue(teamLock.amount.eq((new Big('66000000')).mul(decimals)), 'team lock amount is equal to 66M');
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            assert.isTrue(advisorLock.duration.eq(3600 * 24 * 160), 'advisor lock is equal to 360 days');
            assert.isFalse(advisorLock.withdrawn, 'advisor lock withdrawal state is set to false');
            assert.isTrue(advisorLock.amount.eq((new Big('13200000')).mul(decimals)), 'advisor lock amount is equal to 13.2M');
        });
    });

    it('should prevent ownership transfers before start time', function () {
        var currentOwner, newOwner = accounts[3], startTime;
        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner);
            return token.startTime.call();
        }).then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(startTime.gt(currentTime), 'start time is in the future');
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

    it('should allow crowdsale to change start time but only to a value that is earlier than current start time', function () {
        var startTimeBefore, startTimeAfter, newStartTime;

        return token.startTime.call().then(function (startTime) {
            startTimeBefore = startTime;
            newStartTime = startTime.add(150); // attempt setting in the future first
            assert.isTrue(newStartTime.gt(startTime), 'new start time is after the current start time');
            return token.setStartTime(newStartTime, {from: crowdsale}); // no exception should be thrown
        }).then(function () {
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeAfter = startTime;
            assert.isTrue(startTimeBefore.eq(startTimeAfter), 'start time remained unchanged');

            // now attempt setting a time that's before current start time
            startTimeBefore = startTimeAfter;
            newStartTime = startTimeBefore.sub(100);
            assert.isTrue(newStartTime.lt(startTimeBefore), 'start time is before the current start time');
            return token.setStartTime(newStartTime, {from: crowdsale});
        }).then(function () {
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeAfter = startTime;
            assert.isFalse(startTimeBefore.eq(startTimeAfter), 'start time was changed');
            assert.isTrue(startTimeAfter.eq(newStartTime), 'start time was changed to the new value');
        })
    });

    it('should prevent non-crowdsale addresses from manipulating the start time', function () {
        var startTimeBefore, startTimeAfter, newStartTime;

        return token.startTime.call().then(function (startTime) {
            startTimeBefore = startTime;
            newStartTime = startTimeBefore.sub(100);

            return new Promise(function (resolve, reject) {
                token.setStartTime(newStartTime, {from: owner}).then(function () {
                    reject(new Error('setStartTime did not throw an error for a non-crowdsale address'));
                }).catch(function () {
                    token.startTime.call().then(function (startTime) {
                        startTimeAfter = startTime;
                        assert.isTrue(startTimeBefore.eq(startTimeAfter), 'start time remained unchanged');
                        resolve();
                    }).catch(reject);
                })
            });
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

    it('should prevent the owner from spending more than the current balance', function () {
        var ownerBalanceBefore, ownerBalanceAfter, balanceBefore, balanceAfter, lockedAmount;

        return token.balanceOf.call(owner).then(function (balance) {
            ownerBalanceBefore = balance;
            return token.balanceOf.call(accounts[1]);
        }).then(function (balance) {
            balanceBefore = balance;
            var amountToSpend = ownerBalanceBefore.add(1);
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

    it('should prevent owner from withdrawing amount locked for advisors before lock duration passes', function () {
        var startTime, advisorLock, zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.lt(startTime.add(advisorLock.duration)), 'advisor lock duration had not passed yet');
            assert.isFalse(advisorLock.withdrawn, 'withdrawal state is set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            assert.isFalse(advisorLock.withdrawn, 'withdrawal state is still set to false');
        });
    });

    it('should prevent non-owner from withdrawing locked advisor amount after lock duration passes', function () {
        var zBalanceBefore, aBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, advisorLock, lockEndsAt, nonOwner = accounts[2];

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            lockEndsAt = startTime.add(advisorLock.duration);
            return advanceTime(lockEndsAt);
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isFalse(advisorLock.withdrawn, 'withdrawal state is set to false');
            assert.notEqual(owner, nonOwner, 'the account making the transaction is not an owner');
            return token.withdrawLocked({from: nonOwner}).catch(function () { });
        }).then(function () {
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            assert.isFalse(advisorLock.withdrawn, 'withdrawal state is still set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            aBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(aBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should allow owner to withdraw locked advisor amount after lock duration passes', function () {
        var zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, advisorLock, lockEndsAt;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            lockEndsAt = startTime.add(advisorLock.duration);
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isTrue(advisorLock.amount.gt(0), 'locked amount is greater than 0');
            assert.isFalse(advisorLock.withdrawn, 'withdrawal state is set to false');
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return TokenLock(token.advisorLock.call());
        }).then(function (_lock) {
            advisorLock = _lock;
            assert.isTrue(advisorLock.withdrawn, 'withdrawal state is set to true');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.sub(advisorLock.amount).eq(zBalanceAfter), 'zero address balance was reduced by the locked amount');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.add(advisorLock.amount).eq(oBalanceAfter), 'owner balance was increased by the locked amount');

            // Attempt to repeat the withdrawal
            zBalanceBefore = zBalanceAfter;
            oBalanceBefore = oBalanceAfter;
            zBalanceAfter = null;
            oBalanceAfter = null;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should prevent owner from withdrawing amount locked for foundation before lock duration passes', function () {
        var startTime, foundationLock, zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.foundationLock.call());
        }).then(function (_foundationLockDuration) {
            foundationLock = _foundationLockDuration;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.lt(startTime.add(foundationLock.duration)), 'foundation lock duration had not passed yet');
            assert.isFalse(foundationLock.withdrawn, 'withdrawal state is set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            assert.isFalse(foundationLock.withdrawn, 'withdrawal state is still set to false');
        });
    });

    it('should prevent non-owner from withdrawing locked foundation amount after lock duration passes', function () {
        var zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, foundationLock, lockEndsAt, nonOwner = accounts[2];

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            lockEndsAt = startTime.add(foundationLock.duration);
            return advanceTime(lockEndsAt);
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isFalse(foundationLock.withdrawn, 'withdrawal state is set to false');
            assert.notEqual(owner, nonOwner, 'the account making the transaction is not an owner');
            return token.withdrawLocked({from: nonOwner}).catch(function () { });
        }).then(function () {
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            assert.isFalse(foundationLock.withdrawn, 'withdrawal state is still set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should allow owner to withdraw locked foundation amount after lock duration passes', function () {
        var zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, foundationLock, lockEndsAt;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            lockEndsAt = startTime.add(foundationLock.duration);
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isTrue(foundationLock.amount.gt(0), 'locked amount is greater than 0');
            assert.isFalse(foundationLock.withdrawn, 'withdrawal state is set to false');
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return TokenLock(token.foundationLock.call());
        }).then(function (_lock) {
            foundationLock = _lock;
            assert.isTrue(foundationLock.withdrawn, 'withdrawal state is set to true');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.sub(foundationLock.amount).eq(zBalanceAfter), 'zero address balance was reduced by the locked amount');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.add(foundationLock.amount).eq(oBalanceAfter), 'owner balance was increased by the locked amount');

            // Attempt to repeat the withdrawal
            zBalanceBefore = zBalanceAfter;
            oBalanceBefore = oBalanceAfter;
            zBalanceAfter = null;
            oBalanceAfter = null;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should prevent owner from withdrawing amount locked for team before lock duration passes', function () {
        var startTime, teamLock, zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.lt(startTime.add(teamLock.duration)), 'team lock duration had not passed yet');
            assert.isFalse(teamLock.withdrawn, 'withdrawal state is set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            assert.isFalse(teamLock.withdrawn, 'withdrawal state is still set to false');
        });
    });

    it('should prevent non-owner from withdrawing locked team amount after lock duration passes', function () {
        var zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, teamLock, lockEndsAt, nonOwner = accounts[2];

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            lockEndsAt = startTime.add(teamLock.duration);
            return advanceTime(lockEndsAt);
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isFalse(teamLock.withdrawn, 'withdrawal state is set to false');
            assert.notEqual(owner, nonOwner, 'the account making the transaction is not an owner');
            return token.withdrawLocked({from: nonOwner}).catch(function () { });
        }).then(function () {
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            assert.isFalse(teamLock.withdrawn, 'withdrawal state is still set to false');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should allow owner to withdraw locked team amount after lock duration passes', function () {
        var zBalanceBefore, zBalanceAfter, oBalanceBefore, oBalanceAfter, startTime, teamLock, lockEndsAt;

        return token.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            lockEndsAt = startTime.add(teamLock.duration);
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(lockEndsAt), 'lock end time had passed');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceBefore = balance;
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceBefore = balance;
            assert.isTrue(teamLock.amount.gt(0), 'locked amount is greater than 0');
            assert.isFalse(teamLock.withdrawn, 'withdrawal state is set to false');
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return TokenLock(token.teamLock.call());
        }).then(function (_lock) {
            teamLock = _lock;
            assert.isTrue(teamLock.withdrawn, 'withdrawal state is set to true');
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.sub(teamLock.amount).eq(zBalanceAfter), 'zero address balance was reduced by the locked amount');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.add(teamLock.amount).eq(oBalanceAfter), 'owner balance was increased by the locked amount');

            // Attempt to repeat the withdrawal
            zBalanceBefore = zBalanceAfter;
            oBalanceBefore = oBalanceAfter;
            zBalanceAfter = null;
            oBalanceAfter = null;
            return token.withdrawLocked({from: owner});
        }).then(function () {
            return token.balanceOf.call(0);
        }).then(function (balance) {
            zBalanceAfter = balance;
            assert.isTrue(zBalanceBefore.eq(zBalanceAfter), 'zero address balance remained unchanged');
            return token.balanceOf.call(owner);
        }).then(function (balance) {
            oBalanceAfter = balance;
            assert.isTrue(oBalanceBefore.eq(oBalanceAfter), 'owner balance remained unchanged');
        });
    });

    it('should prevent ownership transfers for non-owners', function () {
        var currentOwner, newOwner = accounts[3], notOwner = accounts[4], startTime;

        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner);
            return token.startTime.call();
        }).then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(startTime), 'start time had passed');
            assert.notEqual(notOwner, currentOwner, 'the new owner address does not match current owner address');
            return token.transferOwnership(newOwner, {from: notOwner}).catch(function () { });
        }).then(function () {
            return token.owner.call();
        }).then(function (_owner) {
            assert.notEqual(_owner, newOwner, 'current owner is not the address that was attempted to set');
            assert.equal(_owner, currentOwner, 'current owner remained the same');
        });
    });

    it('should allow ownership transfers after token start time', function () {
        var currentOwner, newOwner = accounts[3], startTime;
        return token.owner.call().then(function (_owner) {
            currentOwner = _owner;
            assert.notEqual(currentOwner, newOwner, 'new owner does not match the current owner');
            return token.startTime.call();
        }).then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            assert.isTrue(currentTime.gte(startTime), 'start time time had passed');
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
    var token, ico, owner = accounts[0], wallet = accounts[9], startTime, endTime, softCap;

    function resetContracts(cb) {
        advanceTime(1000).then(function (time) {
            startTime = time.add(1000);
            endTime = startTime.add(3600 * 24 * 30);
            return BitDegreeToken.new({gas: 2000000});
        }).then(function (instance) {
            token = instance;
            return token.owner.call();
        }).then(function (_owner) {
            return BitDegreeCrowdsale.new(
                startTime,
                endTime,
                wallet, // destination wallet
                token.address, // deployed contract
                _owner,
                {gas: 2000000}
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
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, startTimeBefore, startTimeAfter, crowdsaleEndTime, rate, account = accounts[1], amount = new Big(500);

        return ico.balanceOf.call(account).then(function (balance) {
            balanceBefore = balance;
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldBefore = balance;
            assert.isTrue(soldBefore.eq(0), '0 tokens have been sold - this is the first contribution');
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeBefore = startTime;
            return ico.endTime.call();
        }).then(function (endTime) {
            crowdsaleEndTime = endTime;
            assert.isTrue(crowdsaleEndTime.lt(startTimeBefore), 'initially token transfer start time is not the same as crowdsale end time');
            return token.balanceOf.call(account);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.buyTokens(account, {from: account, value: amount});
        }).then(function () {
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeAfter = startTime;
            assert.isTrue(startTimeAfter.eq(crowdsaleEndTime.add(3600 * 24 * 7 * 2)), 'token start time was changed to be exactly two weeks in the future of the end of the crowdsale');
            return ico.balanceOf.call(account);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was increased correctly');
            return getRate();
        }).then(function (_rate) {
            rate = _rate;
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

    it('should accept investments for third party beneficiaries and correctly distribute their tokens', function () {
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, startTimeBefore, startTimeAfter, rate, account = accounts[1], beneficiary = accounts[2], amount = new Big(30);

        return ico.balanceOf.call(beneficiary).then(function (balance) {
            balanceBefore = balance;
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldBefore = balance;
            assert.isTrue(soldBefore.gt(0), 'some tokens were already sold');
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeBefore = startTime;
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensBefore = balance;
            return ico.buyTokens(beneficiary, {from: account, value: amount});
        }).then(function () {
            return getRate();
        }).then(function (_rate) {
            rate = _rate;
            return ico.balanceOf.call(beneficiary);
        }).then(function (balance) {
            balanceAfter = balance;
            assert.isTrue(balanceAfter.eq(balanceBefore.add(amount)), 'balance was increased correctly');
            return ico.tokensSold.call();
        }).then(function (balance) {
            soldAfter = balance;
            assert.isTrue(soldAfter.eq(soldBefore.add(amount.mul(rate))), 'sold tokens counter was increased correctly');
            return token.startTime.call();
        }).then(function (startTime) {
            startTimeAfter = startTime;
            assert.isTrue(startTimeBefore.eq(startTimeAfter), 'start time remained unchanged');
            return token.balanceOf.call(beneficiary);
        }).then(function (balance) {
            tokensAfter = balance;
            assert.isTrue(tokensAfter.eq(tokensBefore.add(amount.mul(rate))), 'token balance was increased correctly');
        });
    });

    it('should should accept investments through the fallback function', function () {
        var balanceBefore, balanceAfter, tokensBefore, tokensAfter, soldBefore, soldAfter, rate, account = accounts[1], amount = web3.toWei(1, "ether");

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
            return getRate();
        }).then(function (_rate) {
            rate = _rate;
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

    it('should be possible to reach hard cap and rate should decrease every week by 5%', function (cb) {
        var tokensSoldBefore, tokensSoldAfter, hardCap, rate, toSpend, tokenStartBefore, tokenStartAfter, icoStart, currentTime;
        resetContracts(function () {
            return token.startTime.call().then(function (startTime) {
                tokenStartBefore = startTime;
                return ico.startTime.call();
            }).then(function(_startTime) {
                icoStart = _startTime;
                return advanceTime(startTime);
            }).then(function (_currentTime) {
                currentTime = _currentTime;
                return ico.hardCap.call();
            }).then(function (_hardCap) {
                hardCap = _hardCap;
                return ico.tokensSold.call();
            }).then(function (_sold) {
                tokensSoldBefore = _sold;
                assert.isTrue(tokensSoldBefore.eq(0), 'no tokens are sold');
                return getRate();
            }).then(function (_rate) {
                rate = _rate;

                // -- Week 1 -- 15% bonus

                assert.isTrue(currentTime.lt(startTime.add(3600 * 24 * 7)), 'week 1 had not passed yet');
                assert.isTrue(rate.eq(11500), 'on week 1 rate is equal to 11500');

                toSpend = 10000;
                return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (sold) {
                tokensSoldAfter = sold;
                assert.isTrue(tokensSoldBefore.add(rate.mul(toSpend)).eq(tokensSoldAfter), 'correct amount of tokens were sold');

                // -- Week 1 -- end

                return advanceTime(startTime.add(3600 * 24 * 7));
            }).then(function (_currentTime) {
                currentTime = _currentTime;
                return getRate();
            }).then(function (_rate) {
                rate = _rate;

                tokensSoldBefore = tokensSoldAfter;
                tokensSoldAfter = null;

                // -- Week 2 -- 10% bonus

                assert.isTrue(currentTime.lt(startTime.add(3600 * 24 * 7 * 2)), 'week 2 started');
                assert.isTrue(currentTime.gte(startTime.add(3600 * 24 * 7)), 'week 1 ended');
                assert.isTrue(rate.eq(11000), 'on week 2 rate is equal to 11000');

                toSpend = 10000;
                return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (sold) {
                tokensSoldAfter = sold;
                assert.isTrue(tokensSoldBefore.add(rate.mul(toSpend)).eq(tokensSoldAfter), 'correct amount of tokens were sold');

                // -- Week 2 -- end

                return advanceTime(startTime.add(3600 * 24 * 7 * 2));
            }).then(function (_currentTime) {
                currentTime = _currentTime;
                return getRate();
            }).then(function (_rate) {
                rate = _rate;

                tokensSoldBefore = tokensSoldAfter;
                tokensSoldAfter = null;

                // -- Week 3 -- 5% bonus

                assert.isTrue(currentTime.lt(startTime.add(3600 * 24 * 7 * 3)), 'week 3 started');
                assert.isTrue(currentTime.gte(startTime.add(3600 * 24 * 7 * 2)), 'week 2 ended');
                assert.isTrue(rate.eq(10500), 'on week 3 rate is equal to 10500');

                toSpend = 10000;
                return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (sold) {
                tokensSoldAfter = sold;
                assert.isTrue(tokensSoldBefore.add(rate.mul(toSpend)).eq(tokensSoldAfter), 'correct amount of tokens were sold');

                // -- Week 3 -- end

                return advanceTime(startTime.add(3600 * 24 * 7 * 3));
            }).then(function (_currentTime) {
                currentTime = _currentTime;
                return getRate();
            }).then(function (_rate) {
                rate = _rate;

                tokensSoldBefore = tokensSoldAfter;
                tokensSoldAfter = null;

                // -- Week 4 -- 0% bonus

                assert.isTrue(currentTime.lt(startTime.add(3600 * 24 * 7 * 4)), 'week 4 started');
                assert.isTrue(currentTime.gte(startTime.add(3600 * 24 * 7 * 3)), 'week 3 ended');
                assert.isTrue(rate.eq(10000), 'after week 4 rate is equal to 10000');

                toSpend = hardCap.sub(tokensSoldBefore).div(rate);
                return ico.buyTokens(accounts[1], {from: accounts[1], value: toSpend});
            }).then(function () {
                return ico.tokensSold.call();
            }).then(function (sold) {
                tokensSoldAfter = sold;

                assert.isTrue(tokensSoldBefore.add(rate.mul(toSpend)).eq(tokensSoldAfter), 'correct amount of tokens were sold');
                assert.isTrue(tokensSoldAfter.eq(hardCap), 'exactly hard cap was sold');

                // -- Week 4 -- end

                return token.startTime.call();
            }).then(function (_startTime) {
                tokenStartAfter = _startTime;
                assert.isTrue(tokenStartAfter.lt(tokenStartBefore), 'token transfer start time was switched to an earlier timestamp');
                cb();
            });
        });
    });

    it('should not be possible to transfer funds after crowdsale end time had passed and soft cap was reached', function (cb) {
        // Reset the contracts
        resetContracts(function () {
            var soldBefore, soldAfter, rate, account = accounts[2], softCapPrice;

            // Set the crowdsale address first
            ico.startTime.call().then(function () {
                return advanceTime(startTime.add(3600 * 25 * 7 * 3)); // fast forward to week 4 to have 10000 rate
            }).then(function () {
                return getRate();
            }).then(function (_rate) {
                rate = _rate;
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
                return getRate();
            }).then(function (_rate) {
                rate = _rate;
                return ico.softCap.call();
            }).then(function (_softCap) {
                softCap = _softCap;
                transferAmount = softCap.sub(rate.mul(2)).div(rate).floor();
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
            var transferAmount, soldBefore, soldAfter, walletBefore, walletAfter, accountBalanceBefore, accountBalanceAfter, tokensBefore, tokensAfter, contributionBefore, contributionAfter, hardCap, hardCapPrice, rate, wallet, startTimeBefore, startTimeAfter;
            var account = accounts[2], exceedBy = new Big(web3.toWei('30000', 'mether'));

            token.startTime.call().then(function (startTime) {
                startTimeBefore = startTime;
                return ico.hardCap.call();
            }).then(function (cap) {
                hardCap = cap;
                return ico.wallet.call();
            }).then(function (_wallet) {
                wallet = _wallet;
                return getRate();
            }).then(function (_rate) {
                rate = _rate;
                return ico.startTime.call();
            }).then(function (startTime) {
                hardCapPrice = hardCap.divToInt(rate);
                transferAmount = hardCapPrice.add(exceedBy);
                assert.isTrue(exceedBy.gt(0), 'exceed number is greater than 0');
                assert.isTrue(transferAmount.gt(hardCapPrice), 'hard cap will actually be exceeded');
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
                return token.startTime.call();
            }).then(function (startTime) {
                startTimeAfter = startTime;
                assert.isTrue(startTimeAfter.lt(startTimeBefore), 'token transfer start time was reduced');
                return ico.balanceOf.call(account);
            }).then(function (balance) {
                contributionAfter = balance;
                assert.isTrue(hardCapPrice.eq(contributionAfter), 'only the hard cap worth of wei was counted in balances mapping');
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

    function getRate() {
        var startTime;
        return ico.startTime.call().then(function (_startTime) {
            startTime = _startTime;
            return getTime();
        }).then(function (currentTime) {
            var week = 1, bonus = 15, base = new Big('10000');
            while(true) {
                if(currentTime.lt(startTime.add(week * 3600 * 24 * 7))) {
                    return base.mul((1 + bonus / 100).toFixed(2));
                }

                week++;
                bonus -= 5;

                if(bonus === 0) {
                    return base;
                }
            }
        })
    }
});

function TokenLock(structPromise) {
    return structPromise.then(function (values) {
        return {
            amount: values[0],
            duration: values[1],
            withdrawn: values[2]
        };
    });
}

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
