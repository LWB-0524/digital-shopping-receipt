# 小票记账

拍一下超市购物小票，自动识别出每件商品的名称、品类、数量和金额，按日期和品类整理成消费记录。

这是一个网站，不需要上架应用商店。iPhone 用 Safari 打开、登录就能用，也可以"添加到主屏幕"，用起来和 App 差不多。

## 功能

- **拍照识别**：直接调用手机相机，也可以从相册选图。长小票可以分段拍，最多 4 张。识别由 Claude 多模态模型完成，一次就能输出结构化的商品明细和品类。
- **确认再保存**：识别结果可以逐项修改。页面会自动核对"商品合计 − 优惠 = 实付"，对不上会提醒你。
- **品类自动学习**：你改过的品类会被记住，下次遇到同名商品直接套用。
- **按日期查**：小票按天分组，可选本月、上月、近三个月或自定义日期，也能按商品名或店名搜索。
- **按品类查**：显示各大类、小类的花费和占比，点一下就能筛出对应商品。
- **多用户**：每个人只能看到自己的记录，凭邀请码注册。

## 技术方案

| 部分 | 选型 |
|---|---|
| 网站 | Next.js 16（React，前后端一体） |
| 识别 | Claude API（`claude-opus-5-5`），用结构化输出直接返回 JSON |
| 数据库 | SQLite：本地是一个文件，线上用 [Turso](https://turso.tech) |
| 登录 | 用户名 + 密码（bcrypt 加密），登录状态保存在 Cookie 中 |
| 部署 | [Vercel](https://vercel.com) |

API Key 只保存在服务器上，浏览器里拿不到。小票照片会先在手机上压缩，再上传识别，并和记录一起存进数据库。

## 部署上线（约 15 分钟，不需要写代码）

### 1. 获取 Claude API Key
到 <https://console.anthropic.com> 注册，充值后在 **API Keys** 页面创建一个 Key（以 `sk-ant-` 开头）。

### 2. 创建 Turso 数据库（免费）
1. 用 GitHub 账号登录 <https://turso.tech>，新建一个 Database。
2. 在数据库页面复制 **URL**（形如 `libsql://xxx.turso.io`），再点 **Create Token** 生成一个 Token。

### 3. 部署到 Vercel（免费）
1. 用 GitHub 账号登录 <https://vercel.com>，点 **Add New → Project**，导入这个仓库。
2. 在 **Environment Variables** 里填写以下变量（说明见 `.env.example`）：

   | 变量 | 值 |
   |---|---|
   | `ANTHROPIC_API_KEY` | 第 1 步获得的 Key |
   | `SESSION_SECRET` | 一串随机字符，至少 32 位 |
   | `INVITE_CODE` | 你自己定的邀请码 |
   | `DATABASE_URL` | Turso 的 URL |
   | `DATABASE_AUTH_TOKEN` | Turso 的 Token |

3. 点 **Deploy**。完成后你会得到一个网址，例如 `https://xxx.vercel.app`。

数据表会在第一次访问时自动创建，不需要额外操作。

### 4. 在 iPhone 上使用
1. 用 Safari 打开网址，点"用邀请码注册"，注册账号。
2. 点底部分享按钮 → **添加到主屏幕**，以后从桌面图标打开。

> 在中国大陆，`*.vercel.app` 域名可能访问不稳定。如果打不开，可以在 Vercel 项目的 **Settings → Domains** 绑定一个自己的域名。

## 费用参考

- Vercel 和 Turso 的免费额度对个人使用足够。
- 识别一张小票大约花费几毛钱人民币，具体取决于小票长度。想更省钱，可以设置环境变量 `ANTHROPIC_MODEL=claude-sonnet-5-5`，换用更便宜的模型。

## 本地开发

```bash
npm install
cp .env.example .env.local   # 填入 ANTHROPIC_API_KEY 和 INVITE_CODE；没有 Key 时可设 RECOGNIZE_MOCK=1 用演示数据
npm run dev                  # 打开 http://localhost:3000
```

手机和电脑在同一个 Wi-Fi 下时，可以用电脑的局域网 IP（例如 `http://192.168.1.5:3000`）在手机上调试。

## 目录结构

```
src/
  app/
    page.tsx               小票列表（按日期）
    items/page.tsx         按品类查看
    scan/page.tsx          拍照识别 + 确认
    receipts/[id]/page.tsx 小票详情、编辑、删除
    login/page.tsx         登录 / 注册
    api/                   后端接口
  components/              页面组件（筛选栏、小票编辑器、底部导航等）
  lib/
    recognize.ts           调用 Claude 识别小票（提示词和输出格式都在这里）
    categories.ts          品类列表，改这里即可调整分类
    receipts.ts            数据库读写
    db.ts                  数据库连接和建表
  proxy.ts                 未登录时跳转到登录页
```

## 后续可以做的

- 每月预算和超支提醒
- 导出 Excel / CSV
- 同一商品在不同超市的价格对比
- 重复小票检测（店名 + 时间 + 金额相同时提示）
