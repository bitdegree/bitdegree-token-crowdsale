pragma solidity ^0.4.15;

/**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {
    function mul(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a * b;
        assert(a == 0 || c / a == b);
        return c;
    }

    function div(uint256 a, uint256 b) internal constant returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return c;
    }

    function sub(uint256 a, uint256 b) internal constant returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    function add(uint256 a, uint256 b) internal constant returns (uint256) {
        uint256 c = a + b;
        assert(c >= a);
        return c;
    }
}

contract token {
    function transferFrom(address from, address to, uint256 value) returns (bool);
}

/**
 * @title BitDegree Crowdsale
 */
contract BitDegreeCrowdsale {
    using SafeMath for uint256;

    // Investor contributions
    mapping(address => uint256) balances;

    // The token being sold
    token public reward;

    // Owner of the token
    address public owner;

    // Start and end timestamps
    uint public startTime;
    uint public endTime;

    // Address where funds are collected
    address public wallet;

    // How many token units a buyer gets per wei
    uint256 public rate;

    // Amount of raised money in wei
    uint256 public weiRaised;

    // Soft cap in wei
    uint256 constant public softCap = 6500 * 1 ether;

    // Hard cap in wei
    uint256 constant public hardCap = 76500 * 1 ether;

    // Will be switched to true once crowdsale ends
    bool public isFinalized = false;

    /**
     * @dev Event for token purchase logging
     * @param purchaser Address that paid for the tokens
     * @param beneficiary Address that got the tokens
     * @param value The amount that was paid (in wei)
     * @param amount The amount of tokens that were bought
     */
    event TokenPurchase(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);

    /**
     * @dev Event for refund logging
     * @param receiver The address that received the refund
     * @param amount The amount that is being refunded (in wei)
     */
    event Refund(address indexed receiver, uint256 amount);

    /**
     * @dev Event that is emitted when crowdsale gets finalized
     */
    event Finalized();

    /**
     * @param _startTime Unix timestamp for the start of the token sale
     * @param _endTime Unix timestamp for the end of the token sale
     * @param _rate Rate that is used after pre-sale
     * @param _wallet Ethereum address to which the invested funds are forwarded
     * @param _token Address of the token that will be rewarded for the investors
     * @param _owner Address of the owner of the smart contract who can execute restricted functions
     */
    function BitDegreeCrowdsale(uint256 _startTime, uint256 _endTime, uint256 _rate, address _wallet, address _token, address _owner) {
        require(_startTime >= now);
        require(_endTime >= _startTime);
        require(_rate > 0);
        require(_wallet != address(0));
        require(_token != address(0));
        require(_owner != address(0));

        startTime = _startTime;
        endTime = _endTime;
        rate = _rate;
        wallet = _wallet;
        owner = _owner;
        reward = token(_token);
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Fallback function that can be used to buy tokens. Or in case of the owner, return ether to allow refunds.
     */
    function () external payable {
        if(msg.sender != wallet)
            buyTokens(msg.sender);
    }

    /**
     * @dev Function for buying tokens
     * @param beneficiary The address that should receive bought tokens
     */
    function buyTokens(address beneficiary) public payable {
        require(beneficiary != address(0));
        require(validPurchase());

        uint256 weiAmount = msg.value;

        // calculate token amount to be transferred
        uint256 tokens = weiAmount.mul(rate);

        // update state
        weiRaised = weiRaised.add(weiAmount);

        // update balance
        balances[beneficiary] = balances[beneficiary].add(weiAmount);

        assert(reward.transferFrom(owner, beneficiary, tokens));
        TokenPurchase(msg.sender, beneficiary, weiAmount, tokens);

        // Forward funds
        wallet.transfer(msg.value);
    }

    /**
     * @dev The function that allows the owner to change the token price
     * @param _newRate The new rate that should be used
     */
    function setRate(uint256 _newRate) external onlyOwner {
        require(_newRate >= 10000 && _newRate <= 100000);
        rate = _newRate;
    }

    /**
     * @dev Internal function that is used to check if the incoming purchase should be accepted.
     * @return True if the transaction can buy tokens
     */
    function validPurchase() internal constant returns (bool) {
        bool withinPeriod = now >= startTime && now <= endTime;
        bool nonZeroPurchase = msg.value != 0;
        bool hardCapNotExceeded = weiRaised.add(msg.value) <= hardCap;
        return withinPeriod && nonZeroPurchase && hardCapNotExceeded && !isFinalized;
    }

    /**
     * @return True if crowdsale event has ended
     */
    function hasEnded() public constant returns (bool) {
        return now > endTime || weiRaised >= hardCap;
    }

    /**
     * @dev The function that should be called by the owner after the crowdsale ends.
     */
    function finalize() external onlyOwner {
        require(!isFinalized);
        require(hasEnded() || weiRaised >= hardCap);

        isFinalized = true;
        Finalized();
    }

    /**
     * @dev Returns ether to token holders in case soft cap is not reached.
     */
    function claimRefund() external {
        require(isFinalized);
        require(weiRaised < softCap);

        uint256 amount = balances[msg.sender];

        if(address(this).balance >= amount) {
            balances[msg.sender] = 0;
            if (amount > 0) {
                msg.sender.transfer(amount);
                Refund(msg.sender, amount);
            }
        }
    }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) external constant returns (uint256 balance) {
        return balances[_owner];
    }

}
