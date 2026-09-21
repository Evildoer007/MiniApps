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
      '陈泸玥': 'Jinchuang', '陈思佐': 'Jinchuang', '范逸飞': 'Jinchuang', '冯子轩': 'Jinchuang', '易嘉俊': 'Jinchuang',
      'George Chang': 'Jinchuang', '葛璇': 'Jinchuang', '龚芸媛': 'Jinchuang',
      '郭敏佳': 'Jinchuang', '韩冰': 'Jinchuang', '郝笑寒': 'Jinchuang',
      '胡文龙': 'Jinchuang', '纪浩然': 'Jinchuang', '靳入凡': 'Jinchuang',
      '季伟': 'Jinchuang', '李丰': 'Jinchuang', '李冠霖': 'Jinchuang', '李林霜': 'Jinchuang',
      '李思卓': 'Jinchuang', '李祥琦': 'Jinchuang', '李昕': 'Jinchuang', '李云鹏': 'Jinchuang',
      '林泳': 'Jinchuang',
      '刘钦豪': 'Jinchuang', '刘森林': 'Jinchuang', '龙宇航': 'Jinchuang', '毛宁': 'Jinchuang', '马天': 'Jinchuang',
      '潘刚': 'Jinchuang', '盘秋璇': 'Jinchuang', '潘语厦': 'Jinchuang',
      '彭程': 'Jinchuang', '钱恒恒': 'Jinchuang', '史凯轩': 'Jinchuang', '史文斐': 'Jinchuang', '宋天阳': 'Jinchuang',
      '唐瑶': 'Jinchuang', '王金芝': 'Jinchuang', '王晓光': 'Jinchuang',
      '王啸天': 'Jinchuang', '蔚鹏志': 'Jinchuang', '吴征宇': 'Jinchuang',
      '晏强': 'Jinchuang', '游加平': 'Jinchuang', '尤洋': 'Jinchuang',
      '袁博': 'Jinchuang', '袁云珠': 'Jinchuang', '岳钖': 'Jinchuang', '于海洋': 'Jinchuang',
      '张超彦': 'Jinchuang', '张弓': 'Jinchuang', '张炜佳': 'Jinchuang',
      '张鑫': 'Jinchuang', '张亚洲': 'Jinchuang', '张原玮': 'Jinchuang',
      '赵鹤宁': 'Jinchuang', '朱婷婷': 'Jinchuang',
      'test': 'test8888'
    },

    // 用户所属部门
    USER_DEPARTMENTS: {
      'Jason': '超级管理员',
      'test': '测试账号',
      '蒋琦': '总经理',
      '陈思佐': '副总经理',
      '韩冰': '总经理助理',
      '晏强': '专员',
      '范逸飞': '策略研究团队', '龙宇航': '策略研究团队', '史文斐': '策略研究团队',
      '陈泸玥': '量化交易团队', '纪浩然': '量化交易团队', '林泳': '量化交易团队', '游加平': '量化交易团队',
      '赵鹤宁': '做市团队', '李冠霖': '做市团队', '刘钦豪': '做市团队', '史凯轩': '做市团队', '王啸天': '做市团队', '尤洋': '做市团队', '张超彦': '做市团队',
      '冯子轩': '产品团队', '张弓': '产品团队', '岳钖': '产品团队',
      '李林霜': '场外交易团队', '李昕': '场外交易团队', '彭程': '场外交易团队', '宋天阳': '场外交易团队', '王晓光': '场外交易团队', '吴征宇': '场外交易团队', '曾俊初': '场外交易团队', '张鑫': '场外交易团队',
      '龚芸媛': 'IT支持团队', '李丰': 'IT支持团队', '潘刚': 'IT支持团队', '王金芝': 'IT支持团队', '张亚洲': 'IT支持团队',
      '陈樑': '销售团队', '潘语厦': '销售团队', '盘秋璇': '销售团队', '白子叶': '销售团队', '李思卓': '销售团队', '刘森林': '销售团队', '李云鹏': '销售团队', '唐瑶': '销售团队', '张炜佳': '销售团队', '朱婷婷': '销售团队',
      '胡文龙': '交易运营综合团队', '马天': '交易运营综合团队', '靳入凡': '交易运营综合团队', '陈佳欣': '交易运营综合团队', '葛璇': '交易运营综合团队', '郭敏佳': '交易运营综合团队', '郝笑寒': '交易运营综合团队', '李祥琦': '交易运营综合团队', '毛宁': '交易运营综合团队', '袁云珠': '交易运营综合团队', '于海洋': '交易运营综合团队', '张原玮': '交易运营综合团队',
      '袁博': '光证国际金融创新', '刘畅': '光证国际金融创新', '易嘉俊': '光证国际金融创新', 'George Chang': '光证国际金融创新', '钱恒恒': '光证国际金融创新', '蔚鹏志': '光证国际金融创新', '季伟': '光证国际金融创新'
    },

    /**
     * 获取用户当前密码（优先自定义密码，其次默认密码）
     */
    getUserPassword: function (username) {
      var custom = wx.getStorageSync('userPasswords') || {};
      return custom[username] || this.VALID_USERS[username] || null;
    },

    /**
     * 获取用户所属部门
     */
    getUserDepartment: function (username) {
      return this.USER_DEPARTMENTS[username] || '—';
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
