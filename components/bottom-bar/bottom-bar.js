// 完整四个 tab（资源 / 升贴水 / 矩阵 / 晨报）
var ALL_TABS = [
  { tab: 'resource', icon: '📁' },
  { tab: 'basis', icon: '📈' },
  { tab: 'forex', icon: '💱' },
  { tab: 'quotes', icon: '📰' }
];

// test 账号仅可见「资源 / 晨报」两个 tab
var TEST_TABS = [
  { tab: 'resource', icon: '📁' },
  { tab: 'quotes', icon: '📰' }
];

Component({
  properties: {
    active: {
      type: String,
      value: 'basis'
    }
  },

  data: {
    showBubble: false,
    bubbleLeft: 0,
    tabs: []
  },

  lifetimes: {
    attached: function () {
      this._initTabs();
      this._initBubble();
      this._checkReport();
    }
  },

  pageLifetimes: {
    show: function () {
      this._initTabs();
      this._initBubble();
      this._checkReport();
    }
  },

  methods: {
    _initTabs: function () {
      var app = getApp();
      var user = (app && app.globalData && app.globalData.loginUser) || '';
      this.setData({ tabs: user === 'test' ? TEST_TABS : ALL_TABS });
    },

    onTap: function (e) {
      var tab = e.currentTarget.dataset.tab;
      // 点击晨报：立即标记已读，隐藏气泡
      if (tab === 'quotes') {
        this._markSeen();
      }
      if (tab === this.data.active) return;
      this.triggerEvent('change', { tab: tab });
    },

    /**
     * 计算气泡水平位置：定位到「晨报」Tab 的中心（随可见 Tab 数量自适应）
     */
    _initBubble: function () {
      var app = getApp();
      var w = (app && app.globalData && app.globalData.screenWidth) || 375;
      var tabs = this.data.tabs;
      var quotesIndex = -1;
      for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].tab === 'quotes') { quotesIndex = i; break; }
      }
      var count = tabs.length || 1;
      var center = w * ((2 * quotesIndex + 1) / (2 * count));
      var left = center - (220 / 750) * w / 2;
      this.setData({ bubbleLeft: Math.round(left) });
    },

    /**
     * 拉取晨报更新时间，判断今日是否有「未读」更新
     * 逻辑：updatedAt 是今天 && 与本地已读标记不同 → 显示气泡
     */
    _checkReport: function () {
      var app = getApp();
      if (!app || !app.globalData || !app.globalData.BASE_URL) return;
      var that = this;
      wx.request({
        url: app.globalData.BASE_URL + '/api/morningreport',
        method: 'GET',
        dataType: 'json',
        timeout: 8000,
        success: function (res) {
          if (res.statusCode === 200 && res.data && res.data.updatedAt) {
            var updatedAt = res.data.updatedAt;
            that._lastUpdatedAt = updatedAt;
            var seen = wx.getStorageSync('morningReportSeenAt') || '';
            var unseen = that._isToday(updatedAt) && updatedAt !== seen;
            if (that.data.active === 'quotes') {
              // 已在晨报页，视为已读
              if (unseen) that._markSeen(updatedAt);
              that.setData({ showBubble: false });
            } else {
              that.setData({ showBubble: unseen });
            }
          } else {
            that.setData({ showBubble: false });
          }
        },
        fail: function () {
          that.setData({ showBubble: false });
        }
      });
    },

    _markSeen: function (updatedAt) {
      var key = updatedAt || this._lastUpdatedAt;
      if (key) {
        wx.setStorageSync('morningReportSeenAt', key);
      }
      this.setData({ showBubble: false });
    },

    _isToday: function (isoStr) {
      try {
        var d = new Date(isoStr);
        var now = new Date();
        return d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate();
      } catch (e) {
        return false;
      }
    }
  }
});
