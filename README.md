# 股指期货升贴水 — 微信小程序

## 目录结构

```
miniapp/
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── app.wxss            # 全局样式
├── pages/
│   └── index/
│       ├── index.wxml  # 主页面模板
│       ├── index.wxss  # 主页面样式
│       ├── index.js    # 主页面逻辑
│       └── index.json  # 页面配置（注册 ec-canvas 组件）
├── components/
│   └── ec-canvas/      # ECharts 自定义组件
├── utils/
│   ├── api.js          # 网络请求（wx.request）
│   ├── calculator.js   # 升贴水计算
│   ├── contract.js     # 合约代码生成
│   ├── spline.js       # Catmull-Rom 样条插值
│   └── optionsApi.js   # 期权模拟数据
└── README.md
```

## 快速开始

### 1. 注册小程序

前往 [mp.weixin.qq.com](https://mp.weixin.qq.com) 注册小程序账号，获取 AppID。

> 开发阶段也可以使用微信开发者工具的「测试号」功能。

### 2. 安装 ECharts

在 `miniapp/` 目录下执行：

```bash
cd miniapp
npm init -y
npm install echarts
```

然后在微信开发者工具中：
- 点击菜单 **工具 → 构建 npm**，等待构建完成
- 此时 `miniprogram_npm/echarts/` 目录会生成

### 3. 配置 ECharts 引入

在 `pages/index/index.js` 文件顶部添加：

```js
// 引入 echarts（构建 npm 后可用）
var echarts = require('echarts');
// 挂到全局，供 ec-canvas 组件使用
getApp().globalData.echarts = echarts;
```

### 4. 启动代理服务器

打开终端，在 `mobileProject/` 目录下：

```bash
cd ../mobileProject
node server.js
```

#### 方案A：本地开发（serveo 隧道）

```bash
# 将本地 8080 暴露到公网
ssh -R 80:localhost:8080 serveo.net
```

会输出一个公网地址如 `https://xxx.serveo.net`，将其填入 `app.js` 的 `BASE_URL`。

#### 方案B：部署到云服务器

将 `server.js` 上传到云服务器（腾讯云/阿里云），运行后把公网 IP/域名填入 `app.js`。

### 5. 配置服务器地址

编辑 `app.js`，将 `BASE_URL` 改为你的服务器地址：

```js
globalData: {
  BASE_URL: 'https://your-server.com',  // 改为你的地址
  // ...
}
```

### 6. 配置域名白名单

在微信小程序后台 **开发 → 开发管理 → 服务器域名** 中，将你的服务器域名添加到 `request合法域名`。

> 开发阶段可在微信开发者工具中勾选「不校验合法域名…」跳过此步骤。

### 7. 导入项目

用微信开发者工具打开 `miniapp/` 目录，填入 AppID，即可预览。

## 功能说明

| 功能 | 说明 |
|------|------|
| 四大品种 | IF(沪深300) / IC(中证500) / IM(中证1000) / IH(上证50) |
| 期货期限结构 | 4个存续合约的升贴水点数、百分比、年化率 |
| 91天/182天插值 | Catmull-Rom 样条插值 + 前日对比 Δ |
| 期限结构曲线 | ECharts 平滑曲线 + 散点标记 |
| 自动刷新 | 每3秒轮询，页面切后台自动暂停 |
| 交易时段识别 | 盘中/盘后状态标识 |

## 后续优化

- [ ] 接入真实期权数据替换模拟数据
- [ ] 添加下拉刷新
- [ ] 分享到微信群
- [ ] 添加到桌面快捷方式
- [ ] 自定义品种配置
