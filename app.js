/**
 * 期货升贴水 — 微信小程序
 */
App({
  onLaunch() {
    var sysInfo = wx.getSystemInfoSync();
    var w = sysInfo.windowWidth;

    this.globalData.systemInfo = sysInfo;
    this.globalData.screenWidth = w;

    // 按屏幕宽度分档，方便页面适配列数和字号
    if (w >= 768) {
      this.globalData.layout = 'tablet';     // iPad / 折叠屏
    } else if (w >= 520) {
      this.globalData.layout = 'wide';       // 大屏手机横屏 / 小平板
    } else if (w >= 360) {
      this.globalData.layout = 'normal';     // 主流手机
    } else {
      this.globalData.layout = 'compact';    // 小屏 (iPhone SE 1代等)
    }

    // 恢复登录状态
    var isLoggedIn = wx.getStorageSync('isLoggedIn');
    this.globalData.isLoggedIn = !!isLoggedIn;
    this.globalData.loginUser = wx.getStorageSync('loginUser') || '';

    wx.getNetworkType({
      success: function (res) {
        this.globalData.networkType = res.networkType;
      }.bind(this)
    });
  },

  globalData: {
    BASE_URL: 'https://jasonhelper.cn',
    systemInfo: null,
    screenWidth: 375,
    layout: 'normal',
    networkType: 'unknown',
    isLoggedIn: false,
    loginUser: '',

    // 授权用户名单
    VALID_USERS: {
      'Jason': 'Admin0612',
      '蒋琦': 'Jinchuang', '白子叶': 'Jinchuang', '曾俊初': 'Jinchuang',
      '刘畅': 'Jinchuang', '陈佳欣': 'Jinchuang', '陈樑': 'Jinchuang',
      '陈泸玥': 'Jinchuang', '陈思佐': 'Jinchuang', '冯子轩': 'Jinchuang', 'Gavin Yi': 'Jinchuang',
      'George Chang': 'Jinchuang', '葛璇': 'Jinchuang', '龚芸媛': 'Jinchuang',
      '郭敏佳': 'Jinchuang', '韩冰': 'Jinchuang', '郝笑寒': 'Jinchuang',
      '胡文龙': 'Jinchuang', '纪浩然': 'Jinchuang', '靳入凡': 'Jinchuang',
      '季伟': 'Jinchuang', '李丰': 'Jinchuang', '李林霜': 'Jinchuang',
      '李思卓': 'Jinchuang', '李祥琦': 'Jinchuang', '李昕': 'Jinchuang', '李云鹏': 'Jinchuang',
      '刘钦豪': 'Jinchuang', '龙宇航': 'Jinchuang', '毛宁': 'Jinchuang', '马天': 'Jinchuang',
      '潘刚': 'Jinchuang', '盘秋璇': 'Jinchuang', '潘语厦': 'Jinchuang',
      '彭程': 'Jinchuang', '史文斐': 'Jinchuang', '宋天阳': 'Jinchuang',
      '唐瑶': 'Jinchuang', '王金芝': 'Jinchuang', '王晓光': 'Jinchuang',
      '王啸天': 'Jinchuang', '吴征宇': 'Jinchuang', '杨博': 'Jinchuang',
      '晏强': 'Jinchuang', '游加平': 'Jinchuang', '尤洋': 'Jinchuang',
      '袁云珠': 'Jinchuang', '岳钖': 'Jinchuang', '于海洋': 'Jinchuang',
      '张超彦': 'Jinchuang', '张弓': 'Jinchuang', '张炜佳': 'Jinchuang',
      '张鑫': 'Jinchuang', '张亚洲': 'Jinchuang', '张原玮': 'Jinchuang',
      '赵鹤宁': 'Jinchuang', '朱婷婷': 'Jinchuang',
      'test': 'test8888'
    },

    /**
     * 获取用户当前密码（优先自定义密码，其次默认密码）
     */
    getUserPassword: function (username) {
      var custom = wx.getStorageSync('userPasswords') || {};
      return custom[username] || this.VALID_USERS[username] || null;
    },

    /**
     * 修改用户密码
     */
    setUserPassword: function (username, newPassword) {
      var custom = wx.getStorageSync('userPasswords') || {};
      custom[username] = newPassword;
      wx.setStorageSync('userPasswords', custom);
    }
  },

  logout: function () {
    wx.removeStorageSync('isLoggedIn');
    wx.removeStorageSync('loginUser');
    this.globalData.isLoggedIn = false;
    this.globalData.loginUser = '';
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
