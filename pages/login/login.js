/**
 * 登录页面
 */

Page({
  data: {
    username: '',
    password: '',
    loading: false,
    errorMsg: ''
  },

  onLoad: function () {
    var app = getApp();
    if (app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/index/index' });
      return;
    }
    var lastUser = wx.getStorageSync('lastUsername');
    if (lastUser) {
      this.setData({ username: lastUser });
    }
  },

  onUsernameInput: function (e) {
    this.setData({ username: e.detail.value, errorMsg: '' });
  },

  onPasswordInput: function (e) {
    this.setData({ password: e.detail.value, errorMsg: '' });
  },

  onLogin: function () {
    var that = this;
    var username = this.data.username.trim();
    var password = this.data.password;

    if (!username) {
      this.setData({ errorMsg: '请输入用户名' });
      return;
    }
    if (!password) {
      this.setData({ errorMsg: '请输入密码' });
      return;
    }

    this.setData({ loading: true, errorMsg: '' });

    setTimeout(function () {
      var app = getApp();
      var expectedPwd = app.globalData.getUserPassword(username);

      if (!expectedPwd) {
        that.setData({ loading: false, errorMsg: '用户名或密码错误，请重试' });
        return;
      }

      if (password === expectedPwd) {
        wx.setStorageSync('lastUsername', username);
        wx.setStorageSync('isLoggedIn', true);
        wx.setStorageSync('loginUser', username);
        app.globalData.isLoggedIn = true;
        app.globalData.loginUser = username;
        that.setData({ loading: false });
        wx.redirectTo({ url: '/pages/index/index' });
      } else {
        that.setData({
          loading: false,
          errorMsg: '用户名或密码错误，请重试'
        });
      }
    }, 600);
  },

  onChangePassword: function () {
    var targetUser = this.data.username.trim();
    if (!targetUser) {
      this.setData({ errorMsg: '请先在用户名处输入要修改密码的用户' });
      return;
    }
    var app = getApp();

    // Jason 走管理员页面
    if (targetUser === 'Jason') {
      wx.navigateTo({ url: '/pages/admin-password/admin-password' });
      return;
    }

    if (!app.globalData.VALID_USERS[targetUser]) {
      this.setData({ errorMsg: '非授权用户，无法修改' });
      return;
    }
    wx.navigateTo({ url: '/pages/change-password/change-password?targetUser=' + encodeURIComponent(targetUser) });
  }
});
