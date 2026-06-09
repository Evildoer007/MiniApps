/**
 * 升贴水计算模块 (小程序版)
 *
 * 核心公式：
 *   升贴水点数 = 期货最新价 - 现货指数价
 *   升贴水率   = (期货最新价 - 现货指数价) / 现货指数价 × 100%
 *   年化升贴水率 = 升贴水率 × (365 / 距到期天数)
 *
 * 升水 (Contango):  期货 > 现货 → 正数，红色
 * 贴水 (Backwardation): 期货 < 现货 → 负数，绿色
 */

/**
 * 计算升贴水点数
 */
function calcBasisPoints(futuresPrice, spotPrice) {
  if (futuresPrice == null || spotPrice == null || spotPrice === 0) return null;
  return +(futuresPrice - spotPrice).toFixed(2);
}

/**
 * 计算升贴水率（百分比）
 */
function calcBasisPercent(futuresPrice, spotPrice) {
  if (futuresPrice == null || spotPrice == null || spotPrice === 0) return null;
  return +(((futuresPrice - spotPrice) / spotPrice) * 100).toFixed(4);
}

/**
 * 计算年化升贴水率
 */
function calcAnnualizedBasis(futuresPrice, spotPrice, daysToExpiry) {
  if (daysToExpiry <= 0) return null;
  const basisPercent = calcBasisPercent(futuresPrice, spotPrice);
  if (basisPercent == null) return null;
  return +((basisPercent / daysToExpiry) * 365).toFixed(4);
}

/**
 * 格式化百分比（带符号）
 */
function formatPercent(value, decimals) {
  if (decimals === undefined) decimals = 2;
  if (value == null || isNaN(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return sign + value.toFixed(decimals) + '%';
}

/**
 * 格式化点数（带符号）
 */
function formatPoints(value) {
  if (value == null || isNaN(value)) return '--';
  const sign = value > 0 ? '+' : '';
  return sign + value.toFixed(2);
}

/**
 * 格式化价格
 */
function formatPrice(value, decimals) {
  if (decimals === undefined) decimals = 2;
  if (value == null || isNaN(value)) return '--';
  return value.toFixed(decimals);
}

/**
 * 计算单个品种的完整升贴水数据
 */
function calcBasisInfo(futuresData, spotData, daysToExpiry) {
  const futuresPrice = futuresData ? futuresData.latest : null;
  const spotPrice = spotData ? spotData.latest : null;

  return {
    futuresPrice: futuresPrice,
    spotPrice: spotPrice,
    basisPoints: calcBasisPoints(futuresPrice, spotPrice),
    basisPercent: calcBasisPercent(futuresPrice, spotPrice),
    annualizedBasis: calcAnnualizedBasis(futuresPrice, spotPrice, daysToExpiry),
    daysToExpiry: daysToExpiry
  };
}

/**
 * 判断升贴水方向
 * @returns {string} 'premium' | 'discount' | 'flat'
 */
function getBasisDirection(basisPoints) {
  if (basisPoints == null) return 'flat';
  if (basisPoints > 0) return 'premium';
  if (basisPoints < 0) return 'discount';
  return 'flat';
}

// ==================== Put-Call Parity 期权隐含期货 ====================

/**
 * 寻找平值期权
 */
function findATM(options, futuresPrice) {
  if (!options || !options.length || futuresPrice == null) return null;
  var best = options[0];
  var bestDist = Math.abs((best.strike || 0) - futuresPrice);
  for (var i = 1; i < options.length; i++) {
    var dist = Math.abs((options[i].strike || 0) - futuresPrice);
    if (dist < bestDist) {
      best = options[i];
      bestDist = dist;
    }
  }
  return best;
}

/**
 * 用 Put-Call Parity 计算期权隐含期货价格
 */
function calcImpliedFutures(call, put, strike, daysToExpiry, rate) {
  if (rate === undefined) rate = 0.025;
  if (call == null || put == null || strike == null || daysToExpiry <= 0) return null;
  var T = daysToExpiry / 365;
  return +(strike + (call - put) * Math.exp(rate * T)).toFixed(2);
}

/**
 * 计算隐含期货与实际期货的偏差
 */
function calcDeviation(impliedF, actualF) {
  if (impliedF == null || actualF == null || actualF === 0) {
    return { deviation: null, deviationPercent: null };
  }
  var deviation = +(impliedF - actualF).toFixed(2);
  var deviationPercent = +((deviation / actualF) * 100).toFixed(4);
  return { deviation: deviation, deviationPercent: deviationPercent };
}

/**
 * 生成整数行权价
 */
function roundStrike(price, step) {
  if (step === undefined) step = 50;
  return Math.round(price / step) * step;
}

module.exports = {
  calcBasisPoints: calcBasisPoints,
  calcBasisPercent: calcBasisPercent,
  calcAnnualizedBasis: calcAnnualizedBasis,
  formatPercent: formatPercent,
  formatPoints: formatPoints,
  formatPrice: formatPrice,
  calcBasisInfo: calcBasisInfo,
  getBasisDirection: getBasisDirection,
  findATM: findATM,
  calcImpliedFutures: calcImpliedFutures,
  calcDeviation: calcDeviation,
  roundStrike: roundStrike
};
