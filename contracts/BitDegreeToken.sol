pragma solidity^0.4.15;

import "zeppelin-solidity/contracts/token/PausableToken.sol";

contract BitDegreeToken is PausableToken {
    string public constant name = "BitDegree Token";
    string public constant symbol = "BDG";
    uint8 public constant decimals = 18;

    uint256 public constant totalSupply = 660000000 * (10 ** uint256(decimals));

    uint256 public constant publicAmount = 336600000 * (10 ** uint256(decimals)); // Tokens for public

    uint256 public constant foundationLockAmount = 66000000 * (10 ** uint256(decimals)); // BitDegree foundation locked for 1 year
    uint public constant foundationLockDuration = 360 days;
    bool public foundationLockWithdrawn = false;

    uint256 public constant teamLockAmount = 66000000 * (10 ** uint256(decimals)); // BitDegree Team reserve, locked for 2 years
    uint public constant teamLockDuration = 720 days;
    bool public teamLockWithdrawn = false;

    uint public startTime;

    address public crowdsaleAddress;

    function BitDegreeToken(){
        startTime = now + 70 days;

        balances[owner] = totalSupply.sub(foundationLockAmount).sub(teamLockAmount);
        balances[address(0)] = foundationLockAmount.add(teamLockAmount);

        Transfer(address(0), owner, balances[owner]);
    }

    function setCrowdsaleAddress(address _crowdsaleAddress) external onlyOwner {
        crowdsaleAddress = _crowdsaleAddress;
        assert(approve(crowdsaleAddress, publicAmount));
    }

    function withdrawLocked() external onlyOwner {
        uint foundationLockReleaseTime = startTime + foundationLockDuration;

        if(foundationLockReleaseTime < now && foundationLockWithdrawn == false) {
            foundationLockWithdrawn = true;
            balances[owner] = balances[owner].add(foundationLockAmount);
            balances[address(0)] = balances[address(0)].sub(foundationLockAmount);
            Transfer(address(0), owner, foundationLockAmount);
        }

        uint teamLockReleaseTime = startTime + teamLockDuration;

        if(teamLockReleaseTime < now && teamLockWithdrawn == false) {
            teamLockWithdrawn = true;
            balances[owner] = balances[owner].add(teamLockAmount);
            balances[address(0)] = balances[address(0)].sub(teamLockAmount);
            Transfer(address(0), owner, teamLockAmount);
        }
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
