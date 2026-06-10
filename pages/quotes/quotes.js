var app = getApp();

Page({
  data: {
    loginUser: '',
    isAdmin: false,
    reportContent: '',
    lastUpdate: '',
    saving: false
  },

  onShow: function () {
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    var user = app.globalData.loginUser || '';
    this.setData({
      loginUser: user,
      isAdmin: user === 'Jason'
    });
    this._loadReport();
  },

  onContentInput: function (e) {
    this.setData({ reportContent: e.detail.value });
  },

  _loadReport: function () {
    var that = this;
    wx.request({
      url: app.globalData.BASE_URL + '/api/morningreport',
      method: 'GET',
      dataType: 'json',
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          that.setData({
            reportContent: res.data.content || '',
            lastUpdate: res.data.updatedAt ? that._fmtTime(res.data.updatedAt) : ''
          });
        }
      },
      fail: function () {
        that.setData({ reportContent: '', lastUpdate: '' });
      }
    });
  },

  onSave: function () {
    var that = this;
    this.setData({ saving: true });
    wx.request({
      url: app.globalData.BASE_URL + '/api/morningreport',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        content: this.data.reportContent,
        updatedBy: this.data.loginUser
      },
      timeout: 8000,
      success: function (res) {
        that.setData({ saving: false });
        if (res.statusCode === 200 && res.data && res.data.ok) {
          wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 });
          that._loadReport();
        } else {
          wx.showToast({ title: '发布失败', icon: 'error', duration: 1500 });
        }
      },
      fail: function () {
        that.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'error', duration: 1500 });
      }
    });
  },

  _fmtTime: function (isoStr) {
    try {
      var d = new Date(isoStr);
      var pad = function (n) { return n < 10 ? '0' + n : n; };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' '
        + pad(d.getHours()) + ':' + pad(d.getMinutes());
    } catch (e) {
      return isoStr || '';
    }
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
      wx.redirectTo({ url: '/pages/index/index' });
    }
  },

  onAdminPwd: function () {
    wx.navigateTo({ url: '/pages/admin-password/admin-password' });
  }
});
