/**
 * 合约代码生成模块 (小程序版)
 * - 计算四个存续合约（当月/下月/下两季月）
 * - 现货指数代码映射
 * - 距到期日天数
 */

// 四大股指期货品种配置
var PRODUCTS = {
  IM: { name: '中证1000', display: 'IM', spotCode: 's_sh000852' },
  IC: { name: '中证500', display: 'IC', spotCode: 's_sh000905' },
  IF: { name: '沪深300', display: 'IF', spotCode: 's_sh000300' },
  IH: { name: '上证50', display: 'IH', spotCode: 's_sh000016' }
};

// 季度月份
var QUARTERLY_MONTHS = [3, 6, 9, 12];

/**
 * 计算某年某月的第三个周五（交割日）
 */
function getThirdFriday(year, month) {
  var first = new Date(year, month - 1, 1);
  var dayOfWeek = first.getDay();
  var firstFriday = 1 + (5 - dayOfWeek + 7) % 7;
  var thirdFriday = firstFriday + 14;
  return new Date(year, month - 1, thirdFriday, 15, 0, 0);
}

/**
 * 生成显示合约代码（如 "IF2606"）
 */
function getDisplayCode(product, year, month) {
  var yy = String(year).slice(-2);
  var mm = String(month).padStart(2, '0');
  return product + yy + mm;
}

/**
 * 生成 API 查询代码（如 "nf_IF2606"）
 */
function getApiCode(product, year, month) {
  return 'nf_' + getDisplayCode(product, year, month);
}

/**
 * 获取当前四个存续合约月份列表
 */
function getAvailableContractMonths() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;

  // 若当月合约交割日已过，则以下月为起始
  var deliveryThisMonth = getThirdFriday(year, month);
  if (now > deliveryThisMonth) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }

  var months = [];
  var seen = {};

  // 当月
  months.push({ year: year, month: month });
  seen[month] = true;

  // 下月
  var nextMonth = month + 1;
  var nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear = year + 1;
  }
  if (!seen[nextMonth]) {
    months.push({ year: nextYear, month: nextMonth });
    seen[nextMonth] = true;
  }

  // 接下来两个季月
  for (var offset = 1; offset <= 15 && months.length < 4; offset++) {
    var m2 = month + offset;
    var y2 = year;
    while (m2 > 12) { m2 -= 12; y2++; }
    if (QUARTERLY_MONTHS.indexOf(m2) !== -1 && !seen[m2]) {
      months.push({ year: y2, month: m2 });
      seen[m2] = true;
    }
  }

  months.sort(function (a, b) {
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });

  return months.slice(0, 4);
}

/**
 * 获取某品种的所有存续合约信息
 */
function getAllContractsForProduct(product) {
  var now = new Date();
  var months = getAvailableContractMonths();

  return months.map(function (item) {
    var year = item.year;
    var month = item.month;
    var deliveryDate = getThirdFriday(year, month);
    var daysToExpiry = Math.max(1, Math.ceil((deliveryDate - now) / (1000 * 60 * 60 * 24)));
    return {
      displayCode: getDisplayCode(product, year, month),
      apiCode: getApiCode(product, year, month),
      monthLabel: month + '月',
      year: year,
      month: month,
      deliveryDate: deliveryDate,
      daysToExpiry: daysToExpiry
    };
  });
}

/**
 * 获取所有品种的全部存续合约信息
 */
function getAllContracts() {
  var result = {};
  var keys = Object.keys(PRODUCTS);
  for (var i = 0; i < keys.length; i++) {
    var product = keys[i];
    var info = PRODUCTS[product];
    result[product] = {
      name: info.name,
      display: info.display,
      spotCode: info.spotCode,
      contracts: getAllContractsForProduct(product)
    };
  }
  return result;
}

// ==================== 商品期货 ====================

// 商品期货品种配置
var COMMODITY_PRODUCTS = {
  AU: { name: '沪金', display: 'AU', validMonths: [2,4,6,8,10,12] },
  AG: { name: '沪银', display: 'AG', validMonths: [2,4,6,8,10,12] },
  CU: { name: '沪铜', display: 'CU', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] },
  AL: { name: '沪铝', display: 'AL', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] },
  ZN: { name: '沪锌', display: 'ZN', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] },
  PB: { name: '沪铅', display: 'PB', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] },
  NI: { name: '沪镍', display: 'NI', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] },
  SN: { name: '沪锡', display: 'SN', validMonths: [1,2,3,4,5,6,7,8,9,10,11,12] }
};

// 商品期货图表配色
var COMMODITY_COLORS = {
  AU: '#f59e0b',
  AG: '#94a3b8',
  CU: '#ef4444',
  AL: '#6b7280',
  ZN: '#8b5cf6',
  PB: '#475569',
  NI: '#10b981',
  SN: '#f97316'
};

/**
 * 上期所最后交易日：交割月第15日（遇节假日顺延，此处简化取15日）
 */
function getFifteenthDay(year, month) {
  return new Date(year, month - 1, 15, 15, 0, 0);
}

/**
 * 获取商品期货存续合约月份（未来12个月内所有有效月份）
 */
function getCommodityContractMonths(validMonths) {
  var now = new Date();
  var currentMonth = now.getMonth() + 1;
  var currentYear = now.getFullYear();

  var months = [];
  var month = currentMonth;
  var year = currentYear;
  var stopMonth = currentMonth;
  var stopYear = currentYear + 1; // 未来12个月

  while (year < stopYear || (year === stopYear && month < stopMonth)) {
    if (validMonths.indexOf(month) !== -1) {
      months.push({ year: year, month: month });
    }
    month++;
    if (month > 12) { month = 1; year++; }
  }

  return months;
}

/**
 * 获取某商品品种的所有存续合约
 */
function getCommodityContractsForProduct(product, validMonths) {
  var now = new Date();
  var months = getCommodityContractMonths(validMonths);

  return months
    .map(function (item) {
      var year = item.year;
      var month = item.month;
      var deliveryDate = getFifteenthDay(year, month);
      var daysToExpiry = Math.ceil((deliveryDate - now) / (1000 * 60 * 60 * 24));
      return {
        displayCode: getDisplayCode(product, year, month),
        apiCode: getApiCode(product, year, month),
        monthLabel: month + '月',
        year: year,
        month: month,
        deliveryDate: deliveryDate,
        daysToExpiry: daysToExpiry
      };
    })
    .filter(function (ct) { return ct.daysToExpiry > 0; })
    .slice(0, 12)
    .map(function (ct) {
      ct.daysToExpiry = Math.max(1, ct.daysToExpiry);
      return ct;
    });
}

/**
 * 获取选中商品品种的全部存续合约
 */
function getCommodityAllContracts(product) {
  var info = COMMODITY_PRODUCTS[product];
  var result = {};
  result[product] = {
    name: info.name,
    display: info.display,
    spotLabel: '近月',
    contracts: getCommodityContractsForProduct(product, info.validMonths)
  };
  return result;
}

/**
 * 获取商品期货 picker 选项列表
 */
function getCommodityPickerList() {
  var keys = Object.keys(COMMODITY_PRODUCTS);
  return keys.map(function (code) {
    return COMMODITY_PRODUCTS[code].display + ' ' + COMMODITY_PRODUCTS[code].name;
  });
}

/**
 * 按 picker 序号取品种代码
 */
function getCommodityCodeByIndex(index) {
  return Object.keys(COMMODITY_PRODUCTS)[index];
}

module.exports = {
  PRODUCTS: PRODUCTS,
  COMMODITY_PRODUCTS: COMMODITY_PRODUCTS,
  COMMODITY_COLORS: COMMODITY_COLORS,
  getAllContracts: getAllContracts,
  getCommodityAllContracts: getCommodityAllContracts,
  getCommodityPickerList: getCommodityPickerList,
  getCommodityCodeByIndex: getCommodityCodeByIndex
};
