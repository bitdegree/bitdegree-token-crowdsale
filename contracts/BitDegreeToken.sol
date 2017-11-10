pragma solidity^0.4.15;

import "zeppelin-solidity/contracts/token/PausableToken.sol";

contract BitDegreeToken is PausableToken {
    string public constant name = "BitDegree Token";
    string public constant symbol = "BDG";
    uint8 public constant decimals = 18;

    uint256 public constant totalSupply = 1500000000 * (10 ** uint256(decimals));

    uint256 public constant publicAmount = 765000000 * (10 ** uint256(decimals)); // Tokens for public
    uint256 public constant lockedAmount = 150000000 * (10 ** uint256(decimals)); // BitDegree foundation, locked for 160 days

    uint public startTime;
    uint public lockReleaseTime;

    address public crowdsaleAddress;

    function BitDegreeToken(uint _startTime){
        startTime = _startTime;
        lockReleaseTime = startTime + 160 days;

        balances[owner] = totalSupply;
        Transfer(address(0), owner, totalSupply);
    }

    function setCrowdsaleAddress(address _crowdsaleAddress) external onlyOwner {
        crowdsaleAddress = _crowdsaleAddress;
        assert(approve(crowdsaleAddress, publicAmount));
    }

    function transfer(address _to, uint _value) public returns (bool) {
        // Only possible after ICO ends
        require(now >= startTime);

        // Owner cannot spend more than lockedAmount until lockReleaseTime had passed
        if (msg.sender == owner && now < lockReleaseTime)
            require(balances[msg.sender].sub(_value) >= lockedAmount);

        return super.transfer(_to, _value);
    }

    function transferFrom(address _from, address _to, uint _value) public returns (bool) {
        // Only owner's tokens can be transferred before ICO ends
        if (now < startTime)
            require(_from == owner);

        // Owner cannot spend more than lockedAmount until lockReleaseTime had passed
        if (_from == owner && now < lockReleaseTime)
            require(balances[_from].sub(_value) >= lockedAmount);

        return super.transferFrom(_from, _to, _value);
    }

}
