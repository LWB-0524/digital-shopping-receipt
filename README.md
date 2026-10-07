# 小票记账

拍一下超市购物小票，自动识别出每件商品的名称、品类、数量和金额，按日期和品类整理成消费记录。

这是一个网站，不需要上架应用商店。iPhone 用 Safari 打开、登录就能用，也可以"添加到主屏幕"，用起来和 App 差不多。

## 功能

- **拍照识别**：直接调用手机相机，也可以从相册选图。长小票可以分段拍，最多 4 张。识别由 Claude 多模态模型完成，一次就能输出结构化的商品明细和品类。
- **确认再保存**：识别结果可以逐项修改。页面会自动核对"商品合计 − 优惠 = 实付"，对不上会提醒你。
- **品类自动学习**：你改过的品类会被记住，下次遇到同名商品直接套用。
- **按日期查**：小票按天分组，可选本月、上月、近三个月或自定义日期，也能按商品名或店名搜索。
- **按品类查**：显示各大类、小类的花费和占比，点一下就能筛出对应商品。
- **搜商品、比价格**：首页搜索或选品类时，直接列出匹配的商品，并标明来自哪张小票；搜索时还会显示价格对比（每种商品买过几次、在哪家店哪天最便宜 / 最贵）。
- **通用名**：每件商品有一个通用叫法（如不同牌子的鸡蛋都叫"鸡蛋"），搜索和比价时归在一起。新识别的商品自动生成；以前的商品在"我的 → 整理商品通用名"里补一次。
- **统计**：每月总支出、各大类占比环形图、小类明细、近 12 个月趋势，点柱子切换月份。
- **防重复**：保存时如果发现同一天、金额相同的小票会提醒；"我的 → 检查重复小票"可以找出已有数据里的疑似重复。
- **导出 Excel**："我的 → 导出 Excel"下载全部商品明细和小票，可作备份（不含照片）。
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

## 部署上线（约 10 分钟，全程在网页上点，不需要写代码）

### 1. 获取 Claude API Key
到 <https://console.anthropic.com> 注册，充值后在 **API Keys** 页面创建一个 Key（以 `sk-ant-` 开头）。

### 2. 在 Vercel 导入项目
1. 用 GitHub 账号登录 <https://vercel.com>，点 **Add New → Project**，选择这个仓库，点 **Import**。
2. 展开 **Environment Variables**，添加三项：

   | 变量 | 值 |
   |---|---|
   | `ANTHROPIC_API_KEY` | 第 1 步获得的 Key |
   | `SESSION_SECRET` | 一串随机字符，至少 32 位（随便敲一长串字母数字就行） |
   | `INVITE_CODE` | 你自己定的邀请码 |

3. 点 **Deploy**。这次部署会成功，但网站还不能用，因为还没有数据库。

### 3. 添加数据库（免费）
1. 在 Vercel 项目页面打开 **Storage** 标签，选择 **Turso**，按提示创建数据库并连接到这个项目。连接后，`TURSO_DATABASE_URL` 和 `TURSO_AUTH_TOKEN` 会自动加进环境变量。
2. 打开 **Deployments** 标签，在最新一次部署右侧的 **⋯** 菜单里点 **Redeploy**，让新的环境变量生效。

如果 Storage 里找不到 Turso：可以到 <https://turso.tech> 自己建一个数据库，把它的 URL 和 Token 填到 `DATABASE_URL`、`DATABASE_AUTH_TOKEN` 两个环境变量里，再 Redeploy。

数据表会在第一次访问时自动创建，不需要额外操作。

### 4. 在 iPhone 上使用
1. 用 Safari 打开网址，点"用邀请码注册"，注册账号。
2. 点底部分享按钮 → **添加到主屏幕**，以后从桌面图标打开。

> 在中国大陆，`*.vercel.app` 域名可能访问不稳定。如果打不开，可以在 Vercel 项目的 **Settings → Domains** 绑定一个自己的域名。

## 货币

金额默认显示为新西兰元（NZ$）。要换成别的符号，在 Vercel 的环境变量里加 `NEXT_PUBLIC_CURRENCY_SYMBOL`（如 `¥`、`A$`），然后 Redeploy。

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
    page.tsx               小票列表（按日期）、商品搜索和价格对比
    items/page.tsx         按品类查看
    stats/page.tsx         消费统计（月度支出、品类占比、趋势）
    me/page.tsx            我的（整理通用名、退出登录）
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
- 重复小票检测（店名 + 时间 + 金额相同时提示）
