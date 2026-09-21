#!/usr/bin/env bash
# 部署 server.js 到线上 jasonhelper.cn（腾讯云 115.159.206.42）
# 安全设计：只上传 server.js（代码），绝不覆盖线上数据文件；
#          上传前自动备份线上旧 server.js。
#
# 用法：填好下面 4 个变量后，在 server/ 目录执行  bash deploy.sh
set -euo pipefail

# ================= 部署参数（按你服务器实际情况填写） =================
SSH_HOST="root@115.159.206.42"     # 服务器登录：用户@IP（也可能是 ubuntu@IP，或带端口 -p 22）
REMOTE_DIR="/opt/qihuo-server"      # 服务器上 server.js 所在目录（运行 node 的目录）
USE_PM2="false"                    # 用 pm2 管理则改成 "true"
PM2_NAME="qihuo-server"            # pm2 进程名（USE_PM2=true 时才用）
# =====================================================================

LOCAL_FILE="$(cd "$(dirname "$0")" && pwd)/server.js"

echo "▶ 1/4 备份线上旧 server.js"
ssh "$SSH_HOST" "cp -n '$REMOTE_DIR/server.js' '$REMOTE_DIR/server.js.bak.'\$(date +%Y%m%d%H%M%S) 2>/dev/null || echo '(线上无旧文件或目录不存在，跳过备份)'"

echo "▶ 2/4 上传 server.js（只传代码，不碰 morning_report.json / lend_pool.json 等数据）"
scp "$LOCAL_FILE" "$SSH_HOST:$REMOTE_DIR/server.js"

echo "▶ 3/4 重启后端"
if [ "$USE_PM2" = "true" ]; then
  ssh "$SSH_HOST" "pm2 restart '$PM2_NAME' 2>&1 || (cd '$REMOTE_DIR' && pm2 start server.js --name '$PM2_NAME' 2>&1)"
else
  # 无 pm2 时：先停旧进程，再 nohup 拉起。用 setsid 彻底脱离 ssh 会话，避免 ssh 断开后进程被带走
  ssh "$SSH_HOST" "cd '$REMOTE_DIR' && pkill -f 'node server.js' || true; sleep 1; setsid nohup node server.js > server.log 2>&1 < /dev/null & sleep 1; echo '已用 nohup 重启'"
fi

echo "▶ 4/4 验证接口（应返回 {\"ok\":true,\"items\":[...]} 而非 404）"
sleep 2
curl -s -w '\n[HTTP %{http_code}]\n' "https://jasonhelper.cn/api/cluster-reports"
