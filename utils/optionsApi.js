/**
 * 期权数据接口模块 (小程序版)
 * 当前使用模拟数据（基于实际期货价生成一致的期权链，满足 PCP）。
 */

var calc = require('./calculator.js');

// 期权行权价间距
var STRIKE_STEPS = { IF: 50, IC: 50, IM: 100, IH: 50 };

// 隐含波动率参考值
var REF_VOL = { IF: 0.18, IC: 0.22, IM: 0.25, IH: 0.17 };

// 无风险利率
var RISK_FREE_RATE = 0.025;

/**
 * 为某个合约生成模拟期权链
 */
function generateOptionChain(product, futuresPrice, daysToExpiry, bias) {
  if (!futuresPrice || daysToExpiry <= 0) return [];

  var step = STRIKE_STEPS[product] || 50;
  var vol = REF_VOL[product] || 0.20;
  var T = daysToExpiry / 365;
  var r = RISK_FREE_RATE;

  var atmStrike = calc.roundStrike(futuresPrice, step);

  if (bias === undefined) {
    bias = ((futuresPrice * 31 + daysToExpiry * 17) % 100 - 50) / 10000;
  }

  var F_implied = futuresPrice * (1 + bias);
  var df = Math.exp(-r * T);

  var chain = [];
  for (var i = -2; i <= 2; i++) {
    var K = atmStrike + i * step;
    var midPremium = 0.4 * vol * Math.sqrt(Math.max(T, 1 / 252)) * futuresPrice;
    var callMinusPut = (F_implied - K) * df;
    var callVal = +(midPremium + callMinusPut / 2).toFixed(1);
    var putVal = +(midPremium - callMinusPut / 2).toFixed(1);

    chain.push({
      strike: K,
      call: Math.max(0.1, callVal),
      put: Math.max(0.1, putVal)
    });
  }

  return chain;
}

/**
 * 获取某品种指定月份的期权链
 */
function getOptionData(product, futuresPrice, daysToExpiry) {
  var chain = generateOptionChain(product, futuresPrice, daysToExpiry);
  var atm = calc.findATM(chain, futuresPrice);

  var impliedFutures = null;
  if (atm && atm.call != null && atm.put != null) {
    impliedFutures = calc.calcImpliedFutures(atm.call, atm.put, atm.strike, daysToExpiry, RISK_FREE_RATE);
  }

  return { chain: chain, atm: atm, impliedFutures: impliedFutures };
}

module.exports = {
  getOptionData: getOptionData,
  generateOptionChain: generateOptionChain
};
