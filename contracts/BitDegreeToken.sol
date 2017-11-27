pragma solidity^0.4.18;

import "zeppelin-solidity/contracts/token/PausableToken.sol";

contract BitDegreeToken is PausableToken {
    string public constant name = "BitDegree Token";
    string public constant symbol = "BDG";
    uint8 public constant decimals = 18;

    uint256 private constant TOKEN_UNIT = 10 ** uint256(decimals);

    uint256 public constant totalSupply = 660000000 * TOKEN_UNIT;
    uint256 public constant publicAmount = 336600000 * TOKEN_UNIT; // Tokens for public

    uint public startTime;
    address public crowdsaleAddress;

    struct TokenLock { uint256 amount; uint duration; bool withdrawn; }

    TokenLock public foundationLock = TokenLock({
        amount: 66000000 * TOKEN_UNIT,
        duration: 360 days,
        withdrawn: false
    });

    TokenLock public teamLock = TokenLock({
        amount: 66000000 * TOKEN_UNIT,
        duration: 720 days,
        withdrawn: false
    });

    TokenLock public advisorLock = TokenLock({
        amount: 13200000 * TOKEN_UNIT,
        duration: 160 days,
        withdrawn: false
    });

    function BitDegreeToken() public {
        startTime = now + 70 days;

        balances[owner] = totalSupply;
        Transfer(address(0), owner, balances[owner]);

        lockTokens(foundationLock);
        lockTokens(teamLock);
        lockTokens(advisorLock);
    }

    function setCrowdsaleAddress(address _crowdsaleAddress) external onlyOwner {
        crowdsaleAddress = _crowdsaleAddress;
        assert(approve(crowdsaleAddress, publicAmount));
    }

    function withdrawLocked() external onlyOwner {
        if(unlockTokens(foundationLock)) foundationLock.withdrawn = true;
        if(unlockTokens(teamLock)) teamLock.withdrawn = true;
        if(unlockTokens(advisorLock)) advisorLock.withdrawn = true;
    }

    function lockTokens(TokenLock lock) internal {
        balances[owner] = balances[owner].sub(lock.amount);
        balances[address(0)] = balances[address(0)].add(lock.amount);
        Transfer(owner, address(0), lock.amount);
    }

    function unlockTokens(TokenLock lock) internal returns (bool) {
        uint lockReleaseTime = startTime + lock.duration;

        if(lockReleaseTime < now && lock.withdrawn == false) {
            balances[owner] = balances[owner].add(lock.amount);
            balances[address(0)] = balances[address(0)].sub(lock.amount);
            Transfer(address(0), owner, lock.amount);
            return true;
        }

        return false;
    }

    function setStartTime(uint _startTime) external {
        require(msg.sender == crowdsaleAddress);
        if(_startTime < startTime) {
            startTime = _startTime;
        }
    }

    function transfer(address _to, uint _value) public returns (bool) {
        // Only possible after ICO ends
        require(now >= startTime);

        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        // Only owner's tokens can be transferred before ICO ends
        if (now < startTime)
            require(_from == owner);

        return super.transferFrom(_from, _to, _value);
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(now >= startTime);
        super.transferOwnership(newOwner);
    }
}
