/**
 * 股指期货升贴水 — 主页面逻辑 (小程序版)
 * 图表使用原生 Canvas 2D 绑制，零外部依赖
 */

var contractUtil = require('../../utils/contract.js');
var calculator = require('../../utils/calculator.js');
var spline = require('../../utils/spline.js');
var optionsApi = require('../../utils/optionsApi.js');
var api = require('../../utils/api.js');

// 定时器引用
var autoRefreshTimer = null;

Page({
  data: {
    currentTab: 'index',
    products: [],
    chartLegend: [],
    commodityList: [],
    commodityIndex: 0,
    selectedCommodity: 'AU',
    updateTimeText: '正在加载...',
    updateDotClass: '',
    loadingVisible: true,
    autoRefresh: true,
    chartReady: false,  // 图表是否就绪
    toastVisible: false,
    toastMessage: '',
    toastType: ''
  },

  activeProducts: {},
  chartColors: {},
  productsData: {},
  isRefreshing: false,

  // ==================== 生命周期 ====================

  onLoad: function () {
    // 记录屏幕分档
    var app = getApp();
    this.screenWidth = app.globalData.screenWidth;
    this.layout = app.globalData.layout;

    // 初始化数据并启动（此时 canvas 尚未就绪，先拿数据）
    this._init();
  },

  onReady: function () {
    // Canvas 就绪后才初始化 ECharts
    this._initChart();
  },

  onShow: function () {
    // 页面显示时恢复自动刷新（类似 visibilitychange）
    if (this.data.autoRefresh && !autoRefreshTimer) {
      this._startAutoRefresh();
      // 立即刷新一次数据
      if (Object.keys(this.productsData).length > 0) {
        this._refreshData();
      }
    }
  },

  onHide: function () {
    // 页面隐藏时停止自动刷新
    this._stopAutoRefresh();
  },

  onUnload: function () {
    this._stopAutoRefresh();
  },

  // ==================== 初始化 ====================

  _init: function () {
    this._buildCommodityList();
    this._setupActiveConfig();
    this._buildProductsArray();
    this._buildChartLegend();
    this._refreshData();
  },

  _buildCommodityList: function () {
    var list = contractUtil.getCommodityPickerList();
    this.setData({ commodityList: list });
  },

  _setupActiveConfig: function () {
    if (this.data.currentTab === 'commodity') {
      var product = this.data.selectedCommodity || 'AU';
      var info = contractUtil.COMMODITY_PRODUCTS[product];
      this.activeProducts = {};
      this.activeProducts[product] = info;
      this.chartColors = {};
      this.chartColors[product] = contractUtil.COMMODITY_COLORS[product];
      this.productsData = contractUtil.getCommodityAllContracts(product);
    } else {
      this.activeProducts = contractUtil.PRODUCTS;
      this.chartColors = { IM: '#f04770', IC: '#fbbf24', IF: '#4a9eff', IH: '#34d399' };
      this.productsData = contractUtil.getAllContracts();
    }
  },

  _buildChartLegend: function () {
    var legend = [];
    var keys = Object.keys(this.activeProducts);
    for (var i = 0; i < keys.length; i++) {
      var code = keys[i];
      var info = this.activeProducts[code];
      legend.push({
        code: code,
        color: this.chartColors[code],
        label: code + ' ' + info.name
      });
    }
    this.setData({ chartLegend: legend });
  },

  /**
   * 构建 products 数组 — 将 productsData 转为适合 setData 的数组格式
   */
  _buildProductsArray: function () {
    var products = [];
    var keys = Object.keys(this.activeProducts);
    for (var i = 0; i < keys.length; i++) {
      var code = keys[i];
      var info = this.productsData[code];
      var contracts = [];
      for (var j = 0; j < info.contracts.length; j++) {
        var ct = info.contracts[j];
        contracts.push({
          displayCode: ct.displayCode,
          apiCode: ct.apiCode,
          monthLabel: ct.monthLabel,
          daysToExpiry: ct.daysToExpiry,
          isFront: j === 0,
          futPrice: '--',
          futBasis: '--',
          futBasisClass: '',
          futAnn: '--',
          futAnnClass: ''
        });
      }
      products.push({
        code: code,
        name: info.name,
        display: info.display,
        spotLabel: info.spotLabel || '现货',
        spotPrice: '--',
        contracts: contracts,
        ref91: '--', ref91Class: '',
        prev91: '--', prev91Class: '',
        chg91: '--', chg91Class: '',
        ref182: '--', ref182Class: '',
        prev182: '--', prev182Class: '',
        chg182: '--', chg182Class: '',
        hasError: false
      });
    }
    this.setData({ products: products });
  },

  // ==================== 数据刷新 ====================

  _refreshData: function () {
    var that = this;
    if (this.isRefreshing) return Promise.resolve();
    this.isRefreshing = true;

    // 重新计算合约代码（可能有滚动）
    this._setupActiveConfig();
    this._buildProductsArray();
    this._buildChartLegend();

    var futuresCodes = [];
    var spotCodes = [];
    var isCommodity = this.data.currentTab === 'commodity';
    var keys = Object.keys(this.activeProducts);
    for (var i = 0; i < keys.length; i++) {
      var product = keys[i];
      var info = this.productsData[product];
      // 商品期货用首合约作为"近月"现货代理
      var spotCode = isCommodity && info.contracts.length > 0
        ? info.contracts[0].apiCode
        : info.spotCode;
      info._spotCode = spotCode;
      spotCodes.push(spotCode);
      for (var j = 0; j < info.contracts.length; j++) {
        futuresCodes.push(info.contracts[j].apiCode);
      }
    }

    // 根据当前标签选择 API
    var fetchFn = isCommodity
      ? api.fetchAllCommodityData
      : api.fetchAllData;

    return fetchFn(futuresCodes, spotCodes).then(function (data) {
      that._updateTimestamp(data.timestamp, data.marketOpen);
      that.setData({ updateDotClass: '' });

      // 获取当前 products 数组并更新
      var products = that.data.products;
      for (var i = 0; i < keys.length; i++) {
        var product = keys[i];
        var info = that.productsData[product];
        var spotData = data.spot[info._spotCode];

        if (!spotData || spotData.latest == null) {
          products[i].hasError = true;
          continue;
        }
        products[i].hasError = false;
        products[i].spotPrice = calculator.formatPrice(spotData.latest, 2);

        // 更新四个合约的期货行
        for (var j = 0; j < info.contracts.length; j++) {
          var ct = info.contracts[j];
          var fData = data.futures[ct.apiCode];
          that._updateFuturesRowInArray(products[i].contracts[j], fData, spotData, ct);
        }
      }

      that.setData({ products: products });

      // 更新前一交易日插值
      that._updatePrevRef(data);
      // 更新图表
      that._updateChart();
      // 隐藏 loading
      that.setData({ loadingVisible: false });
    }).catch(function (err) {
      console.error('数据刷新失败:', err);
      that.setData({ updateDotClass: 'error' });
      that._showToast(err.message || '数据加载失败', 'error');
      // 所有品种标为错误
      var products = that.data.products;
      for (var i = 0; i < products.length; i++) {
        products[i].hasError = true;
      }
      that.setData({ products: products });
    }).then(function () {
      // 替代 .finally()，兼容微信小程序（iOS JavaScriptCore 不支持 finally）
      that.isRefreshing = false;
    });
  },

  /**
   * 更新期货合约行数据（直接修改 products 数组中的合约对象）
   */
  _updateFuturesRowInArray: function (ctItem, fData, spotData, ct) {
    if (!fData || fData.latest == null) {
      ctItem.futPrice = '--';
      ctItem.futBasis = '--';
      ctItem.futBasisClass = '';
      ctItem.futAnn = '--';
      ctItem.futAnnClass = '';
      return;
    }

    var basis = calculator.calcBasisInfo(fData, spotData, ct.daysToExpiry);
    var dir = calculator.getBasisDirection(basis.basisPoints);

    ctItem.futPrice = calculator.formatPrice(basis.futuresPrice, 1);
    ctItem.futBasis = calculator.formatPoints(basis.basisPoints);
    ctItem.futBasisClass = dir;
    ctItem.futAnn = calculator.formatPercent(basis.annualizedBasis);
    ctItem.futAnnClass = dir;

    // 缓存年化值供图表和插值使用
    ct._annualizedBasis = basis.annualizedBasis;
  },

  // ==================== 时间戳 & Toast ====================

  _updateTimestamp: function (date, marketOpen) {
    if (!date) date = new Date();
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    var seconds = date.getSeconds().toString().padStart(2, '0');
    var timeStr = hours + ':' + minutes + ':' + seconds;
    var label = marketOpen ? '盘中' : '盘后';
    this.setData({
      updateTimeText: '更新于 ' + timeStr + ' · ' + label,
      updateDotClass: marketOpen ? '' : '' // 盘后无绿点动画
    });
  },

  _showToast: function (message, type) {
    var that = this;
    this.setData({
      toastVisible: true,
      toastMessage: message,
      toastType: type || ''
    });
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(function () {
      that.setData({ toastVisible: false });
    }, 2500);
  },

  // ==================== 前一交易日插值 ====================

  _updatePrevRef: function (data) {
    var products = this.data.products;
    var keys = Object.keys(this.activeProducts);

    for (var i = 0; i < keys.length; i++) {
      var product = keys[i];
      var info = this.productsData[product];
      var spotData = data.spot[info._spotCode];
      if (!spotData || spotData.latest == null) continue;

      var prevSpot = spotData.latest - (spotData.change || 0);
      var prevPoints = [];

      for (var j = 0; j < info.contracts.length; j++) {
        var ct = info.contracts[j];
        var fData = data.futures[ct.apiCode];
        var prevFut = fData ? fData.preSettlement : null;
        if (prevFut == null || prevSpot <= 0) continue;
        var basisPct = ((prevFut - prevSpot) / prevSpot) * 100;
        var ann = ct.daysToExpiry > 0 ? (basisPct / ct.daysToExpiry) * 365 : null;
        if (ann != null) {
          prevPoints.push({ days: ct.daysToExpiry, annualizedBasis: ann });
        }
      }

      if (prevPoints.length >= 2) {
        var result = spline.buildTermStructure(prevPoints);
        var d91 = spline.interpolateAt(result.curve, 91);
        var d182 = spline.interpolateAt(result.curve, 182);

        products[i].prev91 = calculator.formatPercent(d91);
        products[i].prev91Class = calculator.getBasisDirection(d91);
        products[i].prev182 = calculator.formatPercent(d182);
        products[i].prev182Class = calculator.getBasisDirection(d182);

        // 保存昨值
        info._prev91 = d91;
        info._prev182 = d182;
      }
    }
    this.setData({ products: products });
  },

  // ==================== 图表（原生 Canvas 2D） ====================

  /**
   * onReady 中初始化 Canvas 2D
   */
  _initChart: function () {
    var that = this;
    var query = wx.createSelectorQuery();
    query.select('#termChart')
      .fields({ node: true, size: true })
      .exec(function (res) {
        if (!res || !res[0] || !res[0].node) {
          console.error('[index] Canvas 节点未找到');
          return;
        }
        that.canvas = res[0].node;
        that.ctx = that.canvas.getContext('2d');
        that.canvasWidth = res[0].width;
        that.canvasHeight = res[0].height;
        var dpr = wx.getSystemInfoSync().pixelRatio;
        that.canvas.width = that.canvasWidth * dpr;
        that.canvas.height = that.canvasHeight * dpr;
        that.ctx.scale(dpr, dpr);
        that.setData({ chartReady: true });

        // 如果已有数据，立即绑制
        that._updateChart();
      });
  },

  /**
   * 用原生 Canvas 2D 绑制期限结构曲线
   */
  _updateChart: function () {
    var ctx = this.ctx;
    if (!ctx) return;

    var W = this.canvasWidth;
    var H = this.canvasHeight;
    var pad = { top: 24, right: 20, bottom: 40, left: 50 };
    var pw = W - pad.left - pad.right;   // 绑图区宽
    var ph = H - pad.top - pad.bottom;   // 绑图区高

    // 1. 清空画布
    ctx.clearRect(0, 0, W, H);

    // 2. 背景网格
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (var gy = 0; gy <= 4; gy++) {
      var yy = pad.top + (ph / 4) * gy;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(W - pad.right, yy);
      ctx.stroke();
    }
    for (var gx = 0; gx <= 6; gx++) {
      var xx = pad.left + (pw / 6) * gx;
      ctx.beginPath();
      ctx.moveTo(xx, pad.top);
      ctx.lineTo(xx, pad.top + ph);
      ctx.stroke();
    }

    // 3. 收集所有品种数据，计算 y 范围
    var allData = {};
    var yMin = Infinity, yMax = -Infinity;
    var keys = Object.keys(this.activeProducts);

    for (var i = 0; i < keys.length; i++) {
      var product = keys[i];
      var info = this.productsData[product];
      var pts = [];
      for (var j = 0; j < info.contracts.length; j++) {
        var ct = info.contracts[j];
        if (ct._annualizedBasis != null) {
          pts.push({ days: ct.daysToExpiry, annualizedBasis: ct._annualizedBasis });
        }
      }
      if (pts.length >= 2) {
        var result = spline.buildTermStructure(pts, 0, 182);
        allData[product] = result;
        for (var k = 0; k < result.curve.length; k++) {
          var v = result.curve[k].y;
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }

    // 扩展 y 范围
    if (yMin === Infinity) { yMin = -20; yMax = 20; }
    var yPad = Math.max(Math.abs(yMax - yMin) * 0.15, 1);
    yMin -= yPad;
    yMax += yPad;

    // 坐标转换函数
    function xToPixel(days) { return pad.left + (days / 182) * pw; }
    function yToPixel(val) { return pad.top + ph - ((val - yMin) / (yMax - yMin)) * ph; }

    // 4. 坐标轴标签
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    // x 轴
    for (var tx = 0; tx <= 180; tx += 30) {
      ctx.fillText(tx + '天', xToPixel(tx), pad.top + ph + 16);
    }
    // x 轴名称
    ctx.fillText('距到期天数', pad.left + pw / 2, H - 4);

    ctx.textAlign = 'right';
    // y 轴（4 档）
    for (var ty = 0; ty <= 4; ty++) {
      var yVal = yMin + (yMax - yMin) * (ty / 4);
      ctx.fillText(yVal.toFixed(1) + '%', pad.left - 6, yToPixel(yVal) + 3);
    }
    // y 轴名称
    ctx.save();
    ctx.translate(12, pad.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('年化升贴水率', 0, 0);
    ctx.restore();

    // 5. 绑制曲线和散点
    for (var p = 0; p < keys.length; p++) {
      var prod = keys[p];
      var d = allData[prod];
      if (!d) continue;

      var color = this.chartColors[prod];

      // 曲线
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      var first = true;
      for (var c = 0; c < d.curve.length; c++) {
        var cx = xToPixel(d.curve[c].x);
        var cy = yToPixel(d.curve[c].y);
        if (first) { ctx.moveTo(cx, cy); first = false; }
        else { ctx.lineTo(cx, cy); }
      }
      ctx.stroke();

      // 散点
      ctx.fillStyle = color;
      for (var s = 0; s < d.spots.length; s++) {
        var sx = xToPixel(d.spots[s].x);
        var sy = yToPixel(d.spots[s].y);
        ctx.beginPath();
        ctx.arc(sx, sy, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // 6. 更新 ref91/ref182 插值
    var refData = {};
    for (var q = 0; q < keys.length; q++) {
      var prd = keys[q];
      var dd = allData[prd];
      if (dd) {
        refData[prd] = {
          d91: spline.interpolateAt(dd.curve, 91),
          d182: spline.interpolateAt(dd.curve, 182)
        };
      }
    }

    var products = this.data.products;
    for (var r = 0; r < keys.length; r++) {
      var pr = keys[r];
      var rd = refData[pr];
      if (rd) {
        products[r].ref91 = calculator.formatPercent(rd.d91);
        products[r].ref91Class = calculator.getBasisDirection(rd.d91);
        products[r].ref182 = calculator.formatPercent(rd.d182);
        products[r].ref182Class = calculator.getBasisDirection(rd.d182);
        this.productsData[pr]._cur91 = rd.d91;
        this.productsData[pr]._cur182 = rd.d182;
      }
    }
    this.setData({ products: products });
    this._updateDeltas();
  },

  /**
   * 计算 Δ91 / Δ182（当前 - 昨）
   */
  _updateDeltas: function () {
    var products = this.data.products;
    var keys = Object.keys(this.activeProducts);
    var changed = false;

    for (var i = 0; i < keys.length; i++) {
      var info = this.productsData[keys[i]];
      var d91 = this._calcDelta(info._cur91, info._prev91);
      var d182 = this._calcDelta(info._cur182, info._prev182);

      if (products[i].chg91 !== calculator.formatPercent(d91)) {
        products[i].chg91 = calculator.formatPercent(d91);
        products[i].chg91Class = calculator.getBasisDirection(d91);
        changed = true;
      }
      if (products[i].chg182 !== calculator.formatPercent(d182)) {
        products[i].chg182 = calculator.formatPercent(d182);
        products[i].chg182Class = calculator.getBasisDirection(d182);
        changed = true;
      }
    }

    if (changed) {
      this.setData({ products: products });
    }
  },

  _calcDelta: function (cur, prev) {
    if (cur == null || prev == null) return null;
    return +(cur - prev).toFixed(4);
  },

  // ==================== 自动刷新 ====================

  _startAutoRefresh: function () {
    this._stopAutoRefresh();
    var that = this;
    autoRefreshTimer = setInterval(function () {
      that._refreshData();
    }, 3000);
  },

  _stopAutoRefresh: function () {
    if (autoRefreshTimer) {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
    }
  },

  // ==================== 用户交互 ====================

  onManualRefresh: function () {
    this._showToast('正在刷新...', '');
    var that = this;
    this._refreshData().then(function () {
      that._showToast('已刷新 ✓', '');
    }).catch(function () {
      // 错误已在 _refreshData 中处理
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

  // ==================== 标签切换 ====================

  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (tab === this.data.currentTab) return;

    this._stopAutoRefresh();
    this.setData({ currentTab: tab, loadingVisible: true, chartReady: false });
    this._init();

    if (this.data.autoRefresh) {
      this._startAutoRefresh();
    }

    if (this.canvas) {
      this._updateChart();
    }
  },

  onCommodityChange: function (e) {
    var index = e.detail.value;
    var product = contractUtil.getCommodityCodeByIndex(index);
    if (product === this.data.selectedCommodity) return;

    this._stopAutoRefresh();
    this.setData({
      commodityIndex: index,
      selectedCommodity: product,
      loadingVisible: true,
      chartReady: false
    });
    this._init();

    if (this.data.autoRefresh) {
      this._startAutoRefresh();
    }

    if (this.canvas) {
      this._updateChart();
    }
  }
});
