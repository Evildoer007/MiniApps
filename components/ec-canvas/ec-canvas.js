/**
 * ec-canvas 组件 — echarts-for-weixin 封装
 *
 * 用法:
 *   1. 下载 echarts 微信小程序版放到组件目录或 utils 中
 *   2. 在页面 json 中注册本组件
 *   3. 在 wxml 中使用 <ec-canvas ec="{{ec}}" />
 *   4. 页面 js 中设置 ec = { onInit: callback }
 *
 * 简化版实现，无需完整 touch 事件转发，适合展示用图表。
 */

Component({
  properties: {
    canvasId: {
      type: String,
      value: 'ec-canvas'
    },
    ec: {
      type: Object,
      value: null,
      observer: 'onEcChanged'
    },
    disableTouch: {
      type: Boolean,
      value: false
    }
  },

  data: {
    chart: null,
    canvasNode: null
  },

  lifetimes: {
    attached() {
      // 延迟初始化，等待 dom 就绪
    },
    ready() {
      this._initCanvas();
    },
    detached() {
      if (this.data.chart) {
        this.data.chart.dispose();
        this.data.chart = null;
      }
    }
  },

  methods: {
    /**
     * 初始化 Canvas
     */
    _initCanvas() {
      var that = this;
      var query = this.createSelectorQuery();
      query.select('#ec-canvas')
        .fields({ node: true, size: true })
        .exec(function (res) {
          if (!res || !res[0] || !res[0].node) {
            // 兼容旧版 API
            that._initOldCanvas();
            return;
          }
          var canvasNode = res[0].node;
          var width = res[0].width;
          var height = res[0].height;

          that.setData({ canvasNode: canvasNode });

          // 如果 ec 对象已有 onInit，触发初始化
          if (that.data.ec && that.data.ec.onInit) {
            that._initChart(canvasNode, width, height);
          }
        });
    },

    /**
     * 兼容旧版 Canvas API
     */
    _initOldCanvas() {
      var that = this;
      if (that.data.ec && that.data.ec.onInit) {
        that.data.ec.onInit(null, that.data.canvasId);
      }
    },

    /**
     * 初始化 ECharts
     */
    _initChart(canvasNode, width, height) {
      var that = this;

      // echarts 需要从全局获取（由页面在 onLoad 时 require 并挂到 app.globalData）
      var echarts = getApp().globalData.echarts;
      if (!echarts) {
        console.error('[ec-canvas] 未找到 echarts，请在 app.js 或页面中引入');
        return;
      }

      if (!canvasNode) {
        console.error('[ec-canvas] canvasNode 未就绪');
        return;
      }

      canvasNode.width = width;
      canvasNode.height = height;

      // 创建图表实例
      var chart = echarts.init(canvasNode, null, {
        width: width,
        height: height,
        devicePixelRatio: wx.getSystemInfoSync().pixelRatio
      });

      that.setData({ chart: chart });

      // 回调页面初始化逻辑
      if (that.data.ec && typeof that.data.ec.onInit === 'function') {
        that.data.ec.onInit(chart, width, height);
      }
    },

    /**
     * 当 ec 属性变化时
     */
    onEcChanged(newVal, oldVal) {
      if (!newVal || !newVal.onInit) return;
      if (this.data.canvasNode) {
        var query = this.createSelectorQuery();
        var that = this;
        query.select('#ec-canvas')
          .fields({ size: true })
          .exec(function (res) {
            if (res && res[0]) {
              that._initChart(that.data.canvasNode, res[0].width, res[0].height);
            }
          });
      }
    },

    /**
     * 获取 ECharts 实例
     */
    getChart() {
      return this.data.chart;
    },

    /**
     * Touch 事件转发
     */
    touchStart(e) {
      if (this.data.chart && this.data.chart.getZr) {
        this.data.chart.getZr().handler.dispatch('mousedown', {
          zrX: e.touches[0].x,
          zrY: e.touches[0].y
        });
      }
    },

    touchMove(e) {
      if (this.data.chart && this.data.chart.getZr) {
        this.data.chart.getZr().handler.dispatch('mousemove', {
          zrX: e.touches[0].x,
          zrY: e.touches[0].y
        });
      }
    },

    touchEnd(e) {
      if (this.data.chart && this.data.chart.getZr) {
        this.data.chart.getZr().handler.dispatch('mouseup', {});
      }
    }
  }
});
