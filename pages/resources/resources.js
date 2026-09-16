var app = getApp();

// 券池可编辑人员名单（其余人员仅可查看）
var LEND_POOL_EDITORS = ['Jason', '李林霜', '王晓光', '吴征宇', '李昕'];

var _rowSeq = 0;

Page({
  data: {
    loginUser: '',
    isEditor: false,
    rows: [],
    saving: false,
    lastUpdate: ''
  },

  onShow: function () {
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    var user = app.globalData.loginUser || '';
    this.setData({
      loginUser: user,
      isEditor: LEND_POOL_EDITORS.indexOf(user) >= 0
    });
    this._loadPool();
  },

  _loadPool: function () {
    var that = this;
    wx.request({
      url: app.globalData.BASE_URL + '/api/lendpool',
      method: 'GET',
      dataType: 'json',
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data) {
          that.setData({
            rows: res.data.items || [],
            lastUpdate: res.data.updatedAt ? that._fmtTime(res.data.updatedAt) : ''
          });
        } else {
          that.setData({ rows: [], lastUpdate: '' });
        }
      },
      fail: function () {
        that.setData({ rows: [], lastUpdate: '' });
      }
    });
  },

  // 单元格输入绑定
  onInput: function (e) {
    var index = e.currentTarget.dataset.index;
    var field = e.currentTarget.dataset.field;
    var patch = {};
    patch['rows[' + index + '].' + field] = e.detail.value;
    this.setData(patch);
  },

  addRow: function () {
    var rows = this.data.rows.slice();
    rows.push({ id: 'r' + Date.now() + '_' + (_rowSeq++), code: '', name: '', quantity: '' });
    this.setData({ rows: rows });
  },

  removeRow: function (e) {
    var index = e.currentTarget.dataset.index;
    var rows = this.data.rows.slice();
    rows.splice(index, 1);
    this.setData({ rows: rows });
  },

  savePool: function () {
    var that = this;
    var items = this.data.rows.filter(function (it) {
      return (it.code || '').trim() !== '';
    });
    this.setData({ saving: true });
    wx.request({
      url: app.globalData.BASE_URL + '/api/lendpool',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { items: items, user: this.data.loginUser },
      timeout: 8000,
      success: function (res) {
        that.setData({ saving: false });
        if (res.statusCode === 200 && res.data && res.data.ok) {
          wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
          that.setData({
            rows: res.data.items || items,
            lastUpdate: res.data.updatedAt ? that._fmtTime(res.data.updatedAt) : that.data.lastUpdate
          });
        } else if (res.statusCode === 403) {
          wx.showToast({ title: '无权限修改', icon: 'none', duration: 1500 });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none', duration: 1500 });
        }
      },
      fail: function () {
        that.setData({ saving: false });
        wx.showToast({ title: '网络错误', icon: 'none', duration: 1500 });
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
    } else if (e.detail.tab === 'quotes') {
      wx.redirectTo({ url: '/pages/quotes/quotes' });
    }
  },

  onAdminPwd: function () {
    wx.navigateTo({ url: '/pages/admin-password/admin-password' });
  }
});
