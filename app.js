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

    wx.getNetworkType({
      success: function (res) {
        this.globalData.networkType = res.networkType;
      }.bind(this)
    });
  },

  globalData: {
    BASE_URL: 'http://jasonhelper.cn',
    systemInfo: null,
    screenWidth: 375,
    layout: 'normal',
    networkType: 'unknown'
  }
});
