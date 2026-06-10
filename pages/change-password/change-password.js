Page({
  data: {
    targetUser: '',
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    saving: false,
    errorMsg: ''
  },

  onLoad: function (options) {
    this.setData({ targetUser: decodeURIComponent(options.targetUser || '') });
  },

  onOldInput: function (e) {
    this.setData({ oldPassword: e.detail.value, errorMsg: '' });
  },

  onNewInput: function (e) {
    this.setData({ newPassword: e.detail.value, errorMsg: '' });
  },

  onConfirmInput: function (e) {
    this.setData({ confirmPassword: e.detail.value, errorMsg: '' });
  },

  onSave: function () {
    var app = getApp();
    var username = this.data.targetUser;
    var oldPassword = this.data.oldPassword;
    var newPassword = this.data.newPassword.trim();
    var confirmPassword = this.data.confirmPassword.trim();

    if (!oldPassword) {
      this.setData({ errorMsg: '请输入旧密码' });
      return;
    }
    if (!newPassword) {
      this.setData({ errorMsg: '请输入新密码' });
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setData({ errorMsg: '两次输入的新密码不一致' });
      return;
    }

    var currentPwd = app.globalData.getUserPassword(username);
    if (oldPassword !== currentPwd) {
      this.setData({ errorMsg: '旧密码错误' });
      return;
    }

    this.setData({ saving: true, errorMsg: '' });

    var that = this;
    setTimeout(function () {
      app.globalData.setUserPassword(username, newPassword);
      wx.showToast({ title: '密码修改成功', icon: 'success', duration: 1500 });
      setTimeout(function () { wx.navigateBack(); }, 1500);
    }, 300);
  }
});
