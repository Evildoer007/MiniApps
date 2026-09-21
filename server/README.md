# 期货升贴水 — 后端服务

「期货升贴水」微信小程序的唯一后端。原 H5 网页版已废弃，后端从 `移动端Web/` 抽出独立成此项目。

## 目录结构

```
server/
├── server.js            # 唯一后端：新浪行情代理 + 晨报 + 券池 + 集群投研报告
├── package.json         # npm start 启动入口
├── .gitignore
└── README.md
```

运行时自动生成的**有状态数据文件**（已被 `.gitignore` 排除，勿提交）：

| 文件 | 说明 |
|------|------|
| `morning_report.json` | 晨报内容 |
| `lend_pool.json` | 可出借证券券池 |
| `cluster_reports.json` | 集群投研报告清单 |
| `cluster_reports/` | 集群投研报告上传文件（html / pdf） |

## 快速开始

```bash
cd server
npm start        # 或 node server.js
```

默认监听 `0.0.0.0:8080`。启动时自动创建 `cluster_reports/` 目录，无需手动建。

## 接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sina?list=…` | 新浪行情代理（GBK→UTF-8 解码） |
| GET | `/api/historical-basis?contract=…` | 历史基差（日线 + 分红率） |
| GET / POST | `/api/morningreport` | 晨报读取 / 保存（POST 仅管理员） |
| GET / POST | `/api/lendpool` | 券池读取 / 保存（POST 仅编辑白名单） |
| GET | `/api/cluster-reports` | 集群投研报告清单 |
| POST | `/api/cluster-reports/upload?user=…` | 上传报告（仅管理员，multipart） |
| POST | `/api/cluster-reports/delete` | 删除报告（仅管理员） |
| GET | `/cluster_reports/<id>.<ext>` | 查看已上传报告文件 |

权限名单（`server.js` 顶部常量）：
- `LEND_POOL_EDITORS` — 券池编辑白名单
- `CLUSTER_REPORT_ADMINS` — 集群报告上传/删除管理员（当前仅 `Jason`）

## 部署到生产（jasonhelper.cn）

生产域名为 `https://jasonhelper.cn`（腾讯云 `115.159.206.42`），小程序 `app.js` 的 `BASE_URL` 指向它。

### 关键点：只更新代码，别覆盖数据

`morning_report.json`、`lend_pool.json`、`cluster_reports.json`、`cluster_reports/` 是线上实时数据，**部署时只上传 `server.js`（及首次需要时建目录），不要覆盖线上已有数据文件**。

### 步骤

1. 上传新代码到服务器（二选一）：
   ```bash
   # 方案A：只传 server.js（推荐，不碰数据）
   scp server/server.js root@115.159.206.42:/path/to/server/server.js
   ```
   或在服务器上 `git pull`（若已配置仓库）。

2. 重启 node 进程（按你服务器的运行方式二选一）：
   ```bash
   pm2 restart qihuo-server     # 若用 pm2
   # 或
   kill <旧进程PID> && nohup node server.js > server.log 2>&1 &
   ```

3. 验证接口已生效：
   ```bash
   curl -s https://jasonhelper.cn/api/cluster-reports
   # 应返回 {"ok":true,"items":[...]} 而非 404 Not Found
   ```

4. 在微信开发者工具模拟器重新上传测试。

### 小程序域名白名单

后端域名需在小程序后台 **开发 → 开发管理 → 服务器域名** 中配置：
- `request合法域名`：`https://jasonhelper.cn`
- `uploadFile合法域名`：`https://jasonhelper.cn`（集群报告上传用）
- `downloadFile合法域名`：`https://jasonhelper.cn`（pdf 报告下载用）
- `业务域名`：`https://jasonhelper.cn`（web-view 查看 html 报告用）

> 开发阶段可在微信开发者工具勾选「不校验合法域名」跳过校验。
