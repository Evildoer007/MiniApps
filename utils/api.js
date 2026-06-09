/**
 * 网络请求模块 (小程序版)
 * 使用 wx.request 调用 Node 代理服务器获取新浪行情
 */

var app = getApp();

// 超时时间
var FETCH_TIMEOUT = 8000;

/**
 * 判断是否在交易时段
 */
function isTradingSession() {
  var now = new Date();
  var day = now.getDay();
  if (day === 0 || day === 6) return false;
  var t = now.getHours() * 60 + now.getMinutes();
  return (t >= 570 && t <= 690) || (t >= 780 && t <= 900);
}

/**
 * 通过代理服务器获取行情数据
 * @param {Array<string>} codes - 新浪代码列表
 * @returns {Promise<Object>} { code: "raw,string" }
 */
function fetchSinaRaw(codes) {
  return new Promise(function (resolve, reject) {
    var list = codes.join(',');
    var baseUrl = app.globalData.BASE_URL;
    var url = baseUrl + '/api/sina?list=' + encodeURIComponent(list);

    var timer = setTimeout(function () {
      reject(new Error('请求超时'));
    }, FETCH_TIMEOUT);

    wx.request({
      url: url,
      method: 'GET',
      header: {
        'Accept': 'application/json'
      },
      success: function (res) {
        clearTimeout(timer);
        if (res.statusCode !== 200) {
          reject(new Error('代理返回 ' + res.statusCode));
          return;
        }
        var json = res.data;
        if (!json.ok) {
          reject(new Error(json.error || '代理异常'));
          return;
        }
        // 解析原始文本
        var rawData = json.data;
        if (typeof rawData === 'object' && !(rawData instanceof Array)) {
          // 已经是 { code: "raw,string" } 格式
          resolve(rawData);
        } else if (typeof rawData === 'string') {
          // 需要解析文本
          resolve(parseRawText(rawData, codes));
        } else {
          resolve({});
        }
      },
      fail: function (err) {
        clearTimeout(timer);
        reject(new Error('网络请求失败: ' + (err.errMsg || '未知错误')));
      }
    });
  });
}

/**
 * 解析原始文本
 */
function parseRawText(text, codes) {
  var result = {};
  var lines = text.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var m = lines[i].match(/hq_str_(\S+?)="(.*)"/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

/**
 * 解析期货数据
 * 期货 nf_ 格式：
 *   [0] 买一价, [1] 卖一价, [2] 今开盘, [3] 最新价/收盘价
 *   [4] 成交量, [5] 成交额, [6] 持仓量, [14] 昨结算
 */
function parseFuturesData(raw) {
  if (!raw || typeof raw !== 'string') return null;
  var fields = raw.split(',');
  if (fields.length < 15) return null;
  var latest = parseFloat(fields[3]) || null;
  var preSettlement = parseFloat(fields[14]) || null;
  return {
    name: null,
    latest: latest,
    preSettlement: preSettlement,
    volume: parseInt(fields[4], 10) || 0,
    openInterest: parseInt(fields[6], 10) || 0,
    amount: parseFloat(fields[5]) || 0,
    inSession: isTradingSession()
  };
}

/**
 * 解析现货数据
 * 现货 s_sh 格式：
 *   [0] 名称, [1] 最新价, [2] 涨跌额, [3] 涨跌幅
 */
function parseSpotData(raw) {
  if (!raw || typeof raw !== 'string') return null;
  var fields = raw.split(',');
  if (fields.length < 6) return null;
  return {
    name: fields[0],
    latest: parseFloat(fields[1]) || null,
    change: parseFloat(fields[2]) || 0,
    changePercent: parseFloat(fields[3]) || 0,
    volume: parseInt(fields[4], 10) || 0,
    amount: parseInt(fields[5], 10) || 0
  };
}

/**
 * 解析 SHFE（上期所）商品期货数据
 * SHFE 格式与 CFFEX 不同：
 *   [0] 品种名称, [1] 时间戳
 *   [2] 今开盘, [3] 最高价, [4] 最低价
 *   [5] 涨跌, [6] 最新价（盘中）/ 昨结算（盘后）
 *   [7] 买一价, [8] 卖一价, [9] 昨结算?, [10] 结算价
 *   [13] 成交量, [14] 持仓量
 * 注意：盘中 [5] 可能为 0，最新价优先取 [6]；盘后 [6] 可能为昨结算
 */
function parseShfeFuturesData(raw) {
  if (!raw || typeof raw !== 'string') return null;
  var fields = raw.split(',');
  if (fields.length < 15) return null;
  // 优先用 [6] 作最新价，若为空则回退 [5]
  var latest = parseFloat(fields[6]) || parseFloat(fields[5]) || null;
  var preSettlement = parseFloat(fields[10]) || parseFloat(fields[6]) || null;
  return {
    name: fields[0],
    latest: latest,
    preSettlement: preSettlement,
    open: parseFloat(fields[2]) || null,
    high: parseFloat(fields[3]) || null,
    low: parseFloat(fields[4]) || null,
    bid: parseFloat(fields[7]) || null,
    ask: parseFloat(fields[8]) || null,
    volume: parseInt(fields[13], 10) || 0,
    openInterest: parseInt(fields[14], 10) || 0,
    amount: 0,
    inSession: isTradingSession()
  };
}

/**
 * 统一获取所有数据（股指期货）
 * @param {Array<string>} futuresCodes
 * @param {Array<string>} spotCodes
 * @returns {Promise<Object>} { futures: {}, spot: {}, timestamp, marketOpen }
 */
function fetchAllData(futuresCodes, spotCodes) {
  var allCodes = futuresCodes.concat(spotCodes);
  return fetchSinaRaw(allCodes).then(function (rawData) {
    var futures = {};
    for (var i = 0; i < futuresCodes.length; i++) {
      var code = futuresCodes[i];
      var raw = rawData[code];
      futures[code] = raw ? parseFuturesData(raw) : null;
    }
    var spot = {};
    for (var j = 0; j < spotCodes.length; j++) {
      var code2 = spotCodes[j];
      var raw2 = rawData[code2];
      spot[code2] = raw2 ? parseSpotData(raw2) : null;
    }
    return {
      futures: futures,
      spot: spot,
      timestamp: new Date(),
      marketOpen: isTradingSession()
    };
  });
}

/**
 * 统一获取商品期货数据（SHFE 格式）
 * @param {Array<string>} futuresCodes
 * @param {Array<string>} spotCodes — 商品用连续合约做现货代理
 * @returns {Promise<Object>} { futures: {}, spot: {}, timestamp, marketOpen }
 */
function fetchAllCommodityData(futuresCodes, spotCodes) {
  var allCodes = futuresCodes.concat(spotCodes);
  return fetchSinaRaw(allCodes).then(function (rawData) {
    var futures = {};
    for (var i = 0; i < futuresCodes.length; i++) {
      var code = futuresCodes[i];
      var raw = rawData[code];
      futures[code] = raw ? parseShfeFuturesData(raw) : null;
    }
    var spot = {};
    for (var j = 0; j < spotCodes.length; j++) {
      var code2 = spotCodes[j];
      var raw2 = rawData[code2];
      // 商品现货代理也是期货格式
      spot[code2] = raw2 ? parseShfeFuturesData(raw2) : null;
    }
    return {
      futures: futures,
      spot: spot,
      timestamp: new Date(),
      marketOpen: isTradingSession()
    };
  });
}

module.exports = {
  parseFuturesData: parseFuturesData,
  parseShfeFuturesData: parseShfeFuturesData,
  parseSpotData: parseSpotData,
  fetchAllData: fetchAllData,
  fetchAllCommodityData: fetchAllCommodityData,
  fetchSinaRaw: fetchSinaRaw,
  isTradingSession: isTradingSession
};
