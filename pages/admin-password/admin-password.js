var app = getApp();

Page({
  data: {
    verified: false,
    adminPassword: '',
    userList: [],
    userIndex: 0,
    newPassword: '',
    confirmPassword: '',
    saving: false,
    errorMsg: ''
  },

  onLoad: function () {
    // 构建用户列表（排除 Jason）
    var users = app.globalData.VALID_USERS;
    var userList = [];
    for (var name in users) {
      if (name !== 'Jason') {
        userList.push(name);
      }
    }
    this.setData({ userList: userList });
  },

  onAdminInput: function (e) {
    this.setData({ adminPassword: e.detail.value, errorMsg: '' });
  },

  // Step 1: 验证管理员密码
  onVerify: function () {
    var pwd = this.data.adminPassword;
    if (!pwd) {
      this.setData({ errorMsg: '请输入管理员密码' });
      return;
    }
    var adminPwd = app.globalData.getUserPassword('Jason');
    if (pwd === adminPwd) {
      this.setData({ verified: true, errorMsg: '' });
    } else {
      this.setData({ errorMsg: '管理员密码错误' });
    }
  },

  // Step 2
  onUserChange: function (e) {
    this.setData({ userIndex: e.detail.value, errorMsg: '' });
  },

  onNewInput: function (e) {
    this.setData({ newPassword: e.detail.value, errorMsg: '' });
  },

  onConfirmInput: function (e) {
    this.setData({ confirmPassword: e.detail.value, errorMsg: '' });
  },

  onSave: function () {
    var username = this.data.userList[this.data.userIndex];
    var newPassword = this.data.newPassword.trim();
    var confirmPassword = this.data.confirmPassword.trim();

    if (!newPassword) {
      this.setData({ errorMsg: '请输入新密码' });
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setData({ errorMsg: '两次输入的新密码不一致' });
      return;
    }

    this.setData({ saving: true, errorMsg: '' });

    var that = this;
    setTimeout(function () {
      app.globalData.setUserPassword(username, newPassword);
      wx.showToast({ title: username + ' 密码已修改', icon: 'success', duration: 1500 });
      setTimeout(function () {
        wx.navigateBack();
      }, 1500);
    }, 300);
  }
});
