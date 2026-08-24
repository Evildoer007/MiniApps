Component({
  properties: {
    active: {
      type: String,
      value: 'basis'
    }
  },

  data: {
    showBubble: false,
    bubbleLeft: 0
  },

  lifetimes: {
    attached: function () {
      this._initBubble();
      this._checkReport();
    }
  },

  pageLifetimes: {
    show: function () {
      this._checkReport();
    }
  },

  methods: {
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
     * 计算气泡水平位置：晨报 Tab 位于右半区中心(75%)，气泡宽 220rpx，居中于该点
     */
    _initBubble: function () {
      var app = getApp();
      var w = (app && app.globalData && app.globalData.screenWidth) || 375;
      var left = w * 0.75 - (220 / 750) * w / 2;
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
