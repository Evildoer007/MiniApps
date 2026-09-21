/**
 * 静态文件服务器 + 新浪行情代理
 * 用法: node server.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const PORT = 8080;
const ROOT = __dirname;
const REPORT_FILE = path.join(__dirname, 'morning_report.json');
const LEND_POOL_FILE = path.join(__dirname, 'lend_pool.json');
const LEND_POOL_EDITORS = ['Jason', '李林霜', '王晓光', '吴征宇', '李昕'];

// 集群投研报告：上传文件存储与清单
const CLUSTER_REPORTS_DIR = path.join(__dirname, 'cluster_reports');
const CLUSTER_REPORTS_FILE = path.join(__dirname, 'cluster_reports.json');
const CLUSTER_REPORT_ADMINS = ['Jason'];
const CLUSTER_REPORT_EXT = ['.html', '.pdf'];
fs.mkdirSync(CLUSTER_REPORTS_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
};

// ================== 新浪行情代理 ==================
function fetchSinaData(listParam) {
  return new Promise((resolve, reject) => {
    const url = `https://hq.sinajs.cn/list=${listParam}`;
    let req = https.get(url, {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        // GBK → UTF-8 解码
        const text = new TextDecoder('gbk').decode(buffer);
        resolve(text);
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ================== 新浪日K线 API ==================
// type: 'futures' or 'index'
function fetchSinaDailyKLine(type, symbol) {
  return new Promise((resolve, reject) => {
    let url;
    if (type === 'futures') {
      url = `https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20data=/InnerFuturesNewService.getDailyKLine?symbol=${symbol}`;
    } else {
      url = `https://money.finance.sina.com.cn/quotes_service/api/jsonp.php/var%20K=/CN_MarketData.getKLineData?symbol=sh${symbol}&scale=240&ma=no&datalen=2000`;
    }

    let req = https.get(url, {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'Accept': '*/*',
        'User-Agent': 'Mozilla/5.0'
      },
      timeout: 10000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = new TextDecoder('gbk').decode(buffer);
        // Parse JSONP: var data=([...]); or var K=([...]);
        const jsonMatch = text.match(/\((\[[\s\S]*\])\s*\)/);
        if (!jsonMatch) {
          reject(new Error('Failed to parse JSONP: ' + text.slice(0, 100)));
          return;
        }
        try {
          const data = JSON.parse(jsonMatch[1]);
          resolve(data);
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// ================== 中证指数股息率 API ==================
const XLSX = require('xlsx');

function fetchDividendYield(symbol) {
  return new Promise((resolve, reject) => {
    const url = `https://oss-ch.csindex.com.cn/static/html/csindex/public/uploads/file/autofile/indicator/${symbol}indicator.xls`;
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 8000
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const buffer = Buffer.concat(chunks);
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet);
          if (data.length === 0) { reject(new Error('Empty XLS')); return; }
          // Last row's 股息率2 (column index 9, 0-based)
          const lastRow = data[data.length - 1];
          // Column keys include English suffixes e.g. "股息率2（计算用股本）D/P2"
          const keys = Object.keys(lastRow);
          let dy2 = null;
          for (const k of keys) {
            if (k.includes('股息率2')) { dy2 = parseFloat(lastRow[k]); break; }
          }
          if (dy2 == null || isNaN(dy2)) { reject(new Error('Failed to parse dividend yield')); return; }
          resolve(dy2);
        } catch (e) {
          reject(new Error('XLS parse error: ' + e.message));
        }
      });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('Timeout')); });
  });
}

// ================== 集群投研报告辅助 ==================
function readClusterReports() {
  return new Promise((resolve) => {
    fs.readFile(CLUSTER_REPORTS_FILE, 'utf8', (err, data) => {
      if (err) return resolve([]);
      try {
        const m = JSON.parse(data);
        resolve(Array.isArray(m.items) ? m.items : []);
      } catch (e) { resolve([]); }
    });
  });
}

function writeClusterReports(items) {
  return new Promise((resolve, reject) => {
    fs.writeFile(CLUSTER_REPORTS_FILE, JSON.stringify({ items: items }, null, 2), 'utf8', (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

// 解析单文件 multipart/form-data（wx.uploadFile 单文件格式）
function parseMultipartFile(buffer, boundary) {
  const delim = '--' + boundary;
  const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'));
  if (headerEnd === -1) return null;
  const headers = buffer.slice(0, headerEnd).toString('utf8');
  const filenameMatch = headers.match(/filename="([^"]*)"/);
  const filename = filenameMatch ? filenameMatch[1] : 'report';
  const contentStart = headerEnd + 4;
  // 尾部形如 \r\n--boundary--\r\n
  const endMarker = Buffer.from('\r\n' + delim + '--');
  const contentEnd = buffer.lastIndexOf(endMarker);
  const content = contentEnd === -1 ? buffer.slice(contentStart) : buffer.slice(contentStart, contentEnd);
  return { filename: filename, content: content };
}

// ================== HTTP Server ==================
http.createServer((req, res) => {
  // API 代理路由
  if (req.url.startsWith('/api/sina')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const listParam = urlObj.searchParams.get('list');
    if (!listParam) {
      res.writeHead(400);
      res.end('Missing list parameter');
      return;
    }

    fetchSinaData(listParam)
      .then(data => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({ ok: true, data }));
      })
      .catch(err => {
        res.writeHead(502);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      });
    return;
  }

  // 历史基差 API — 获取某合约从挂牌至今的每日年化基差
  if (req.url.startsWith('/api/historical-basis')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const contract = urlObj.searchParams.get('contract');
    if (!contract) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: 'Missing contract parameter' }));
      return;
    }

    // 品种 → 现货指数代码映射
    const SPOT_MAP = {
      IM: '000852', IC: '000905', IF: '000300', IH: '000016'
    };
    const prefix = contract.replace(/\d/g, '');
    const spotCode = SPOT_MAP[prefix];
    if (!spotCode) {
      res.writeHead(400);
      res.end(JSON.stringify({ ok: false, error: 'Unknown contract prefix: ' + prefix }));
      return;
    }

    // 计算合约交割日（第三个周五）
    const year = 2000 + parseInt(contract.slice(-4, -2), 10);
    const month = parseInt(contract.slice(-2), 10);
    const first = new Date(year, month - 1, 1);
    const thirdFriday = new Date(year, month - 1, 1 + (5 - first.getDay() + 7) % 7 + 14);

    Promise.all([
      fetchSinaDailyKLine('futures', contract),
      fetchSinaDailyKLine('index', spotCode),
      fetchDividendYield(spotCode)
    ]).then(([futData, idxData, divYield]) => {
      // 构建日期索引
      const idxMap = {};
      for (const d of idxData) {
        idxMap[d.day] = parseFloat(d.close);
      }

      // 合并计算
      const result = [];
      for (const f of futData) {
        const spotClose = idxMap[f.d];
        if (spotClose == null || spotClose === 0) continue;
        const futClose = parseFloat(f.c);
        const tradeDate = new Date(f.d);
        const daysToExpiry = Math.max(1, Math.ceil((thirdFriday - tradeDate) / 86400000));
        const basisPct = (futClose - spotClose) / spotClose * 100;
        const annualized = basisPct / daysToExpiry * 365;

        result.push({
          date: f.d,
          fut_close: +futClose.toFixed(1),
          spot_close: +spotClose.toFixed(2),
          basis_points: +(futClose - spotClose).toFixed(2),
          basis_pct: +basisPct.toFixed(4),
          annualized_basis: +annualized.toFixed(4),
          annualized_basis_adj: +(annualized + divYield).toFixed(4),
          days_to_expiry: daysToExpiry
        });
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        ok: true,
        contract,
        spot_code: 'sh' + spotCode,
        expiry: thirdFriday.getFullYear() + '-' + String(thirdFriday.getMonth() + 1).padStart(2, '0') + '-' + String(thirdFriday.getDate()).padStart(2, '0'),
        dividend_yield: divYield,
        count: result.length,
        data: result
      }));
    }).catch(err => {
      res.writeHead(502);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    });
    return;
  }

  // 晨报 API — GET 获取
  if (req.url === '/api/morningreport' && req.method === 'GET') {
    fs.readFile(REPORT_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, content: '', updatedAt: null }));
        return;
      }
      try {
        var report = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, content: report.content || '', updatedAt: report.updatedAt || null }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, content: '', updatedAt: null }));
      }
    });
    return;
  }

  // 晨报 API — POST 保存（仅管理员）
  if (req.url === '/api/morningreport' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (payload.content === undefined || payload.content === null) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: 'Missing content' }));
          return;
        }
        const record = JSON.stringify({
          content: payload.content,
          updatedAt: new Date().toISOString(),
          updatedBy: payload.updatedBy || 'unknown'
        }, null, 2);
        fs.writeFile(REPORT_FILE, record, 'utf8', (err) => {
          if (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false, error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 券池（可出借证券）API — GET 获取
  if (req.url === '/api/lendpool' && req.method === 'GET') {
    fs.readFile(LEND_POOL_FILE, 'utf8', (err, data) => {
      if (err) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, items: [], updatedAt: null, updatedBy: null }));
        return;
      }
      try {
        const pool = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, items: pool.items || [], updatedAt: pool.updatedAt || null, updatedBy: pool.updatedBy || null }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true, items: [], updatedAt: null, updatedBy: null }));
      }
    });
    return;
  }

  // 券池（可出借证券）API — POST 保存（仅授权编辑人员）
  if (req.url === '/api/lendpool' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.user || LEND_POOL_EDITORS.indexOf(payload.user) === -1) {
          res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: '无权限：仅授权编辑人员可修改券池' }));
          return;
        }
        if (!Array.isArray(payload.items)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: false, error: 'Missing items array' }));
          return;
        }
        const items = payload.items
          .filter(it => it && (it.code || '').trim())
          .map(it => ({
            id: it.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)),
            code: (it.code || '').trim(),
            name: (it.name || '').trim(),
            quantity: (it.quantity || '').trim()
          }));
        const updatedAt = new Date().toISOString();
        const record = JSON.stringify({ items: items, updatedAt: updatedAt, updatedBy: payload.user }, null, 2);
        fs.writeFile(LEND_POOL_FILE, record, 'utf8', (err) => {
          if (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ ok: false, error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, items: items, updatedAt: updatedAt, updatedBy: payload.user }));
        });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // 集群投研报告 API — GET 获取清单
  if (req.url === '/api/cluster-reports' && req.method === 'GET') {
    readClusterReports().then(items => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: true, items: items }));
    }).catch(err => {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: err.message }));
    });
    return;
  }

  // 集群投研报告 API — POST 上传（仅管理员，multipart 单文件）
  if (req.url.startsWith('/api/cluster-reports/upload') && req.method === 'POST') {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const user = urlObj.searchParams.get('user') || '';
    const origName = (urlObj.searchParams.get('name') || '').trim();
    if (CLUSTER_REPORT_ADMINS.indexOf(user) === -1) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: '无权限：仅管理员可上传' }));
      return;
    }
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundaryMatch) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ ok: false, error: '缺少 multipart boundary' }));
      return;
    }
    const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim();
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const parsed = parseMultipartFile(Buffer.concat(chunks), boundary);
      if (!parsed || !parsed.content || parsed.content.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: '未收到文件内容' }));
        return;
      }
      const displayName = origName || parsed.filename;
      const ext = path.extname(displayName).toLowerCase();
      if (CLUSTER_REPORT_EXT.indexOf(ext) === -1) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: '仅支持 html / pdf 文件' }));
        return;
      }
      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      const storedName = id + ext;
      fs.writeFile(path.join(CLUSTER_REPORTS_DIR, storedName), parsed.content, (err) => {
        if (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err.message }));
          return;
        }
        readClusterReports().then(items => {
          const item = {
            id: id,
            name: displayName,
            ext: ext.slice(1),
            size: parsed.content.length,
            uploadedAt: new Date().toISOString(),
            uploadedBy: user
          };
          items.unshift(item);
          return writeClusterReports(items).then(() => item);
        }).then(item => {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true, item: item }));
        }).catch(err2 => {
          res.writeHead(500);
          res.end(JSON.stringify({ ok: false, error: err2.message }));
        });
      });
    });
    return;
  }

  // 集群投研报告 API — POST 删除（仅管理员）
  if (req.url === '/api/cluster-reports/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try { payload = JSON.parse(body); } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
        return;
      }
      if (!payload.user || CLUSTER_REPORT_ADMINS.indexOf(payload.user) === -1) {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: '无权限：仅管理员可删除' }));
        return;
      }
      const id = (payload.id || '').trim();
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: false, error: '缺少 id' }));
        return;
      }
      readClusterReports().then(items => {
        const item = items.find(it => it.id === id);
        if (item) {
          fs.unlink(path.join(CLUSTER_REPORTS_DIR, id + '.' + item.ext), () => {});
        }
        return writeClusterReports(items.filter(it => it.id !== id));
      }).then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ ok: true }));
      }).catch(err => {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      });
    });
    return;
  }

  // 静态文件
  let filePath = path.join(ROOT, req.url === '/' ? '/index.html' : req.url.split('?')[0]);
  const ext = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  console.log(`\n  ✅  服务器已启动: http://localhost:${PORT}\n`);
  Object.values(ifaces).forEach(iface => {
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  📱  手机访问: http://${addr.address}:${PORT}`);
      }
    });
  });
  console.log('');
});
