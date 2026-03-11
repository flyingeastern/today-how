import { OpenAI } from "openai";
import { tavily } from "@tavily/core";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: '.env.local' });

const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAll() {
  const industries = ["贵金属", "人工智能", "电力"];
  
  // 1. 获取动态的“今天”日期 (例如: 2026-03-11)
  // 放在循环外面，确保同一次运行生成的所有报告日期完全一致
  const today = new Date().toISOString().split('T')[0];
  
  for (const industry of industries) {
    console.log(`\n🚀 开始处理【${industry}】行业... 日期锚点：${today}`);

    try {
      // ---------------------------------------------------------
      // 1. 双引擎搜索：搜索词强行注入时间戳，逼迫搜索引擎找今天的内容
      // ---------------------------------------------------------
      console.log(`⏳ 正在抓取 [24H最新动态] (侧重社媒与快讯)...`);
      const search24h = await tvly.search(`${industry} ${today} 过去24小时 最新突发新闻 社交媒体热议 Twitter 核心动态`, {
        searchDepth: "advanced",
        includeRawContent: true,
        maxResults: 4 // 抓取量从3提升到4，给 AI 更多过滤旧闻的空间
      });
      await sleep(1500); // 避开频率限制

      console.log(`⏳ 正在抓取 [行业趋势报告] (侧重深度分析)...`);
      const searchTrends = await tvly.search(`${industry} ${today} 本周最新 权威行业深度报告 趋势分析 咨询公司`, {
        searchDepth: "advanced",
        includeRawContent: true,
        maxResults: 2
      });

      // ---------------------------------------------------------
      // 2. 数据处理与截断
      // ---------------------------------------------------------
      let data24h = JSON.stringify(search24h.results);
      let dataTrends = JSON.stringify(searchTrends.results);
      
      const MAX_TOTAL_LEN = 20000; 
      if (data24h.length > 12000) data24h = data24h.substring(0, 12000) + '...[截断]';
      if (dataTrends.length > 8000) dataTrends = dataTrends.substring(0, 8000) + '...[截断]';

      // ---------------------------------------------------------
      // 3. AI 深度分析 (注入时间锚点与防旧闻机制)
      // ---------------------------------------------------------
      console.log(`🧠 正在生成分析报告 (使用 Claude 3.5 Sonnet)...`);
      const response = await openai.chat.completions.create({
        model: "anthropic/claude-3.5-sonnet", 
        messages: [{
          role: "system",
          content: `你是一位冷酷、专业的行业分析师。请输出一份 Markdown 行业情报。

【时间锚点】：今天是 ${today}。你的所有分析必须基于且仅基于这个时间点！

⚠️ **输出准则（核心约束）**：
1. **极度时效性**：在写“24H 最新动态”时，【严禁】将 ${today} 之前的旧闻列入。如果提供的数据里没有今天的突发新闻，请直接指出“过去24小时内该行业无重大突发事件”，绝对不要拿旧闻凑数！
2. **寻找增量**：在写“行业趋势”时，不要重复常识，只提取最新的“增量变量”。
3. **禁止寒暄**：禁止输出任何引导语、开场白（如“基于信息如下...”）或结束语。
4. **标题对齐**：必须严格使用二级标题 "## "，严禁使用 "# " 或 "### "。
5. **内容纯净**：首行必须直接以 "## 一、 ⚡ 24H 最新动态（核心重点）" 开始。
6. **视觉风格**：用 Emoji 增强模块化，逻辑严密。

必须严格遵守以下结构：

## 一、 ⚡ 24H 最新动态（核心重点）
基于数据提炼 3-5 条最新突发。每条总结后紧跟一句 **本质影响** 分析。

## 二、 📈 行业趋势与关键变量
提炼宏观逻辑。必须包含表格：| 变量/趋势名称 | 当前状态 | 长期影响 |。

## 三、 🎯 明日推演
给出客观的趋势预测和风险提示。

## 四、 🔗 信息来源
严格提取 URL：* [标题](URL)。`
        }, {
          role: "user",
          content: `【24小时内最新动态】：${data24h}\n\n【近期行业趋势】：${dataTrends}`
        }]
      });

      if (!response.choices || response.choices.length === 0) {
        console.error(`❌ API 未返回内容`);
        continue;
      }

      // ---------------------------------------------------------
      // 4. 后处理：物理剔除废话与标题校准
      // ---------------------------------------------------------
      let content = response.choices[0].message.content.trim();

      const firstHeadingIndex = content.indexOf('## 一、');
      if (firstHeadingIndex !== -1) {
        content = content.substring(firstHeadingIndex);
      }

      content = content.replace(/^(#+)\s*(一、|二、|三、|四、)/gm, '## $2');
      content = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '').trim();

      // ---------------------------------------------------------
      // 5. 保存文件与清理
      // ---------------------------------------------------------
      const dir = `./content/${industry}`;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const filePath = `${dir}/${today}.md`; // 直接使用上面定义好的 today
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${industry} 报告保存成功`);

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
      if (files.length > 7) {
        for (let i = 7; i < files.length; i++) {
          fs.unlinkSync(path.join(dir, files[i]));
          console.log(`🧹 已清理旧文件: ${files[i]}`);
        }
      }

    } catch (error) {
      console.error(`❌ ${industry} 处理失败：`, error.message);
    }

    console.log("⏳ 等待 3 秒，避免并发限制...");
    await sleep(3000);
  }
  console.log("\n🎉 全部行业情报处理完毕！");
}

runAll();
