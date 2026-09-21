var app = getApp();

// 券池可编辑人员名单（其余人员仅可查看）
var LEND_POOL_EDITORS = ['Jason', '李林霜', '王晓光', '吴征宇', '李昕'];

var _rowSeq = 0;

Page({
  data: {
    loginUser: '',
    department: '',
    isEditor: false,
    rows: [],
    saving: false,
    lastUpdate: '',
    isAdmin: false,
    reports: [],
    uploading: false
  },

  onShow: function () {
    if (!app.globalData.isLoggedIn) {
      wx.redirectTo({ url: '/pages/login/login' });
      return;
    }
    var user = app.globalData.loginUser || '';
    this.setData({
      loginUser: user,
      department: app.globalData.getUserDepartment(user),
      isEditor: LEND_POOL_EDITORS.indexOf(user) >= 0,
      isAdmin: user === 'Jason'
    });
    this._loadPool();
    this._loadReports();
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

  // ==================== 集群投研报告 ====================

  _loadReports: function () {
    var that = this;
    wx.request({
      url: app.globalData.BASE_URL + '/api/cluster-reports',
      method: 'GET',
      timeout: 8000,
      success: function (res) {
        if (res.statusCode === 200 && res.data && res.data.ok) {
          var items = (res.data.items || []).map(function (it) {
            return {
              id: it.id,
              name: it.name,
              ext: it.ext,
              size: it.size,
              uploadedBy: it.uploadedBy,
              uploadedAtText: that._fmtTime(it.uploadedAt)
            };
          });
          that.setData({ reports: items });
        } else {
          that.setData({ reports: [] });
        }
      },
      fail: function () {
        that.setData({ reports: [] });
      }
    });
  },

  onUploadReport: function () {
    var that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['html', 'pdf'],
      success: function (res) {
        var file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        var name = file.name || '';
        var ext = (name.split('.').pop() || '').toLowerCase();
        if (ext !== 'html' && ext !== 'pdf') {
          wx.showToast({ title: '仅支持 html / pdf', icon: 'none', duration: 2000 });
          return;
        }
        that.setData({ uploading: true });
        wx.showLoading({ title: '上传中...', mask: true });
        wx.uploadFile({
          url: app.globalData.BASE_URL + '/api/cluster-reports/upload?user=' + encodeURIComponent(that.data.loginUser),
          filePath: file.path,
          name: 'file',
          timeout: 120000,
          success: function (upRes) {
            wx.hideLoading();
            that.setData({ uploading: false });
            var data = {};
            try { data = JSON.parse(upRes.data); } catch (e) {}
            if (upRes.statusCode === 200 && data.ok) {
              wx.showToast({ title: '上传成功', icon: 'success', duration: 1500 });
              that._loadReports();
            } else {
              wx.showToast({ title: data.error || '上传失败', icon: 'none', duration: 2000 });
            }
          },
          fail: function () {
            wx.hideLoading();
            that.setData({ uploading: false });
            wx.showToast({ title: '网络错误', icon: 'none', duration: 2000 });
          }
        });
      }
    });
  },

  onOpenReport: function (e) {
    var item = this.data.reports[e.currentTarget.dataset.index];
    if (!item) return;
    var url = app.globalData.BASE_URL + '/cluster_reports/' + item.id + '.' + item.ext;
    if (item.ext === 'pdf') {
      wx.showLoading({ title: '打开中...', mask: true });
      wx.downloadFile({
        url: url,
        timeout: 120000,
        success: function (res) {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.openDocument({
              filePath: res.tempFilePath,
              fileType: 'pdf',
              showMenu: true,
              fail: function () {
                wx.showToast({ title: '打开失败', icon: 'none', duration: 2000 });
              }
            });
          } else {
            wx.showToast({ title: '打开失败', icon: 'none', duration: 2000 });
          }
        },
        fail: function () {
          wx.hideLoading();
          wx.showToast({ title: '下载失败', icon: 'none', duration: 2000 });
        }
      });
    } else if (item.ext === 'html') {
      wx.navigateTo({ url: '/pages/report-viewer/report-viewer?url=' + encodeURIComponent(url) });
    }
  },

  onDeleteReport: function (e) {
    var that = this;
    var item = this.data.reports[e.currentTarget.dataset.index];
    if (!item) return;
    wx.showModal({
      title: '删除报告',
      content: '确定删除「' + item.name + '」吗？',
      success: function (res) {
        if (!res.confirm) return;
        wx.request({
          url: app.globalData.BASE_URL + '/api/cluster-reports/delete',
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: { user: that.data.loginUser, id: item.id },
          timeout: 8000,
          success: function (r) {
            if (r.statusCode === 200 && r.data && r.data.ok) {
              wx.showToast({ title: '已删除', icon: 'success', duration: 1500 });
              that._loadReports();
            } else {
              wx.showToast({ title: (r.data && r.data.error) || '删除失败', icon: 'none', duration: 2000 });
            }
          },
          fail: function () {
            wx.showToast({ title: '网络错误', icon: 'none', duration: 2000 });
          }
        });
      }
    });
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
