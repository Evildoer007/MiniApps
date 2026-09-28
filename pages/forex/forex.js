var app = getApp();
var api = require('../../utils/api.js');

// 币种定义（key 用于展示，code 用于新浪，name 中文名）
// 币种定义（key 用于展示，code 用于新浪，name 中文名，scale 为行单位倍数，flag 国旗）
var CURRENCIES = [
  { key: 'CHN', code: 'CNY', name: '人民币', scale: 1, flag: '🇨🇳' },
  { key: 'USD', code: 'USD', name: '美元', scale: 1, flag: '🇺🇸' },
  { key: 'EUR', code: 'EUR', name: '欧元', scale: 1, flag: '🇪🇺' },
  { key: 'HKD', code: 'HKD', name: '港元', scale: 1, flag: '🇭🇰' },
  { key: 'GBP', code: 'GBP', name: '英镑', scale: 1, flag: '🇬🇧' },
  { key: 'JPY', code: 'JPY', name: '日元', scale: 100, flag: '🇯🇵' }
];

var autoRefreshTimer = null;

/**
 * 格式化矩阵格子（固定 4 位小数）
 */
function fmtCell(v) {
  if (v == null || !isFinite(v) || v === 0) return '--';
  return v.toFixed(4);
}

/**
 * 格式化报价（固定 4 位小数）
 */
function fmtPrice(v) {
  if (v == null || !isFinite(v)) return '--';
  return v.toFixed(4);
}

/**
 * 格式化涨跌额（带符号，固定 4 位小数）
 */
function fmtChg(v) {
  if (v == null || !isFinite(v)) return '--';
  return (v > 0 ? '+' : '') + v.toFixed(4);
}

Page({
  data: {
    loginUser: '',
    department: '',
    columns: [],
    rows: [],
    updateTimeText: '正在加载...',
    autoRefresh: false,
    loadingVisible: true,
    toastVisible: false,
    toastMessage: '',
    // 浮窗
    popupVisible: false,
    popupPair: '',
    popupCode: '',
    popupDesc: '',
    popupLatest: '--',
    popupChange: '--',
    popupChangePercent: '--',
    popupChangeClass: 'flat',
    popupBid: '--',
    popupAsk: '--',
    popupHigh: '--',
    popupLow: '--'
  },

  onLoad: function () {
    this._refresh();
  },

  onShow: function () {
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    var user = app.globalData.loginUser || '';
    this.setData({
      loginUser: user,
      department: app.globalData.getUserDepartment(user)
    });
  },

  onHide: function () {
    this._stopAutoRefresh();
  },

  onUnload: function () {
    this._stopAutoRefresh();
  },

  // ==================== 数据刷新 ====================

  _refresh: function () {
    var that = this;
    // 取 8 个外币兑人民币的汇率，人民币自身作为基准 1
    var codes = [];
    for (var i = 0; i < CURRENCIES.length; i++) {
      if (CURRENCIES[i].code !== 'CNY') {
        codes.push('fx_s' + CURRENCIES[i].code.toLowerCase() + 'cny');
      }
    }

    return api.fetchForexData(codes).then(function (data) {
      var byCode = {};
      for (var i = 0; i < data.items.length; i++) {
        byCode[data.items[i].code] = data.items[i];
      }

      // rateByCur: { CNY: {...}, USD: {...}, ... } 单位 = 人民币/币种
      var rateByCur = {
        CNY: { latest: 1, prevClose: 1, bid: 1, ask: 1, high: 1, low: 1 }
      };
      for (var j = 0; j < CURRENCIES.length; j++) {
        var cur = CURRENCIES[j];
        if (cur.code === 'CNY') continue;
        var code = 'fx_s' + cur.code.toLowerCase() + 'cny';
        if (byCode[code]) rateByCur[cur.code] = byCode[code];
      }

      that._rateByCur = rateByCur;
      that._buildMatrix();
      that._updateTimestamp();
      that.setData({ loadingVisible: false });
    }).catch(function () {
      that.setData({ updateTimeText: '加载失败', loadingVisible: false, rows: [] });
      that._showToast('数据加载失败');
    });
  },

  /**
   * 构建汇率矩阵：cell(row, col) = 1 单位「行币种」兑换的「列币种」数量
   */
  _buildMatrix: function () {
    var rateByCur = this._rateByCur;
    if (!rateByCur) return;

    var columns = CURRENCIES.map(function (c) {
      return { key: c.key, code: c.code, name: c.name, flag: c.flag };
    });

    var rows = [];
    for (var i = 0; i < CURRENCIES.length; i++) {
      var r = CURRENCIES[i];
      var rr = rateByCur[r.code];
      var scale = r.scale || 1;
      var cells = [];
      for (var j = 0; j < CURRENCIES.length; j++) {
        var c = CURRENCIES[j];
        if (r.code === c.code) {
          cells.push({ key: c.key, isEmpty: true, row: r.code, col: c.code });
        } else {
          var rc = rateByCur[c.code];
          var value = (rr && rc && rc.latest) ? rr.latest * scale / rc.latest : null;
          cells.push({
            key: c.key,
            isEmpty: false,
            row: r.code,
            col: c.code,
            text: fmtCell(value)
          });
        }
      }
      rows.push({
        key: r.key,
        code: r.code,
        name: r.name,
        flag: r.flag,
        rowLabel: scale === 1 ? r.key : (scale + r.key),
        cells: cells
      });
    }

    this.setData({ columns: columns, rows: rows });
  },

  _updateTimestamp: function () {
    var d = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : n; };
    this.setData({
      updateTimeText: '更新于 ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
    });
  },

  // ==================== 自动刷新 ====================

  _startAutoRefresh: function () {
    this._stopAutoRefresh();
    var that = this;
    autoRefreshTimer = setInterval(function () {
      that._refresh();
    }, 5000);
  },

  _stopAutoRefresh: function () {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  },

  // ==================== 交互 ====================

  onManualRefresh: function () {
    var that = this;
    this._refresh().then(function () {
      that._showToast('已刷新 ✓');
    }).catch(function () {
      // 错误已在 _refresh 中处理
    });
  },

  onAutoRefreshChange: function (e) {
    var checked = e.detail.value;
    this.setData({ autoRefresh: checked });
    if (checked) {
      this._startAutoRefresh();
    } else {
      this._stopAutoRefresh();
    }
  },

  _showToast: function (message) {
    var that = this;
    this.setData({ toastVisible: true, toastMessage: message });
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () {
      that.setData({ toastVisible: false });
    }, 2000);
  },

  /**
   * 点击方格弹出浮窗
   */
  onCellTap: function (e) {
    var rowCode = e.currentTarget.dataset.row;
    var colCode = e.currentTarget.dataset.col;
    var r = this._currencyByCode(rowCode);
    var c = this._currencyByCode(colCode);
    if (!r || !c || r.code === c.code) return;

    var rr = this._rateByCur[r.code];
    var rc = this._rateByCur[c.code];
    if (!rr || !rc || !rc.latest) return;

    var scale = r.scale || 1;
    var latest = rr.latest * scale / rc.latest;
    var prev = rr.prevClose * scale / rc.prevClose;
    var change = latest - prev;
    var changePercent = (prev && prev !== 0) ? (change / prev) * 100 : null;
    var changeClass = change > 0 ? 'premium' : (change < 0 ? 'discount' : 'flat');

    this.setData({
      popupVisible: true,
      popupPair: r.name + ' / ' + c.name,
      popupCode: r.code + '/' + c.code,
      popupDesc: (scale === 1 ? '1 ' + r.name : scale + ' ' + r.name) + ' = ' + fmtPrice(latest) + ' ' + c.name,
      popupLatest: fmtPrice(latest),
      popupChange: fmtChg(change),
      popupChangePercent: changePercent == null ? '--'
        : (changePercent > 0 ? '+' : '') + changePercent.toFixed(2) + '%',
      popupChangeClass: changeClass,
      popupBid: fmtPrice(rr.bid * scale / rc.ask),
      popupAsk: fmtPrice(rr.ask * scale / rc.bid),
      popupHigh: fmtPrice(rr.high * scale / rc.low),
      popupLow: fmtPrice(rr.low * scale / rc.high)
    });
  },

  onPopupClose: function () {
    this.setData({ popupVisible: false });
  },

  stopPropagation: function () {
    // 阻止冒泡，点击卡片内部不关闭
  },

  _currencyByCode: function (code) {
    for (var i = 0; i < CURRENCIES.length; i++) {
      if (CURRENCIES[i].code === code) return CURRENCIES[i];
    }
    return null;
  },

  onLogout: function () {
    var that = this;
    wx.showModal({
      title: '退出登录',
      content: '确定要退出登录吗？',
      success: function (res) {
        if (res.confirm) { app.logout(); }
      }
    });
  },

  onBarChange: function (e) {
    if (e.detail.tab === 'basis') {
      this._stopAutoRefresh();
      wx.redirectTo({ url: '/pages/index/index' });
    } else if (e.detail.tab === 'quotes') {
      this._stopAutoRefresh();
      wx.redirectTo({ url: '/pages/quotes/quotes' });
    } else if (e.detail.tab === 'resource') {
      this._stopAutoRefresh();
      wx.redirectTo({ url: '/pages/resources/resources' });
    }
  },

  onAdminPwd: function () {
    wx.navigateTo({ url: '/pages/admin-password/admin-password' });
  }
});
