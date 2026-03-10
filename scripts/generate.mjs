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
  
  for (const industry of industries) {
    console.log(`\n🚀 开始处理【${industry}】行业...`);

    try {
      // ---------------------------------------------------------
      // 1. 双引擎搜索：强制区分 24H 内外与信息源类型
      // ---------------------------------------------------------
      
      console.log(`⏳ 正在抓取 [24H最新动态] (侧重社媒与快讯)...`);
      const search24h = await tvly.search(`${industry} 过去24小时 最新突发新闻 社交媒体热议 Twitter 核心动态`, {
        searchDepth: "advanced",
        includeRawContent: true,
        maxResults: 3
      });
      await sleep(1000); // 稍微停顿，防止 Tavily 频率限制

      console.log(`⏳ 正在抓取 [行业趋势报告] (侧重深度分析)...`);
      const searchTrends = await tvly.search(`${industry} 近期权威行业深度报告 趋势分析 咨询公司`, {
        searchDepth: "advanced",
        includeRawContent: true,
        maxResults: 2 // 篇幅不需要太大，抓 2 篇高质量的即可
      });

      // ---------------------------------------------------------
      // 2. 数据防崩溃截断处理
      // ---------------------------------------------------------
      let data24h = JSON.stringify(search24h.results);
      let dataTrends = JSON.stringify(searchTrends.results);
      
      const MAX_LEN_24H = 12000;  // 给最新动态分配更多字符额度
      const MAX_LEN_TRENDS = 8000; // 趋势分析分配较少额度

      if (data24h.length > MAX_LEN_24H) data24h = data24h.substring(0, MAX_LEN_24H) + '...[截断]';
      if (dataTrends.length > MAX_LEN_TRENDS) dataTrends = dataTrends.substring(0, MAX_LEN_TRENDS) + '...[截断]';

      // ---------------------------------------------------------
      // 3. AI 深度分析 (全新优化的 System Prompt)
      // ---------------------------------------------------------
      console.log(`🧠 正在进行 AI 深度交叉分析...`);
      const response = await openai.chat.completions.create({
        model: "anthropic/claude-3.5-sonnet", // 换成官方满血版 Claude
        messages: [{
          role: "system",
          content: `你是一位顶级的行业分析师。你的任务是基于我提供的两组不同时间维度的数据（【24小时内最新动态】和【近期行业趋势】），输出一份极具“新鲜度”和“深度”的 Markdown 行业情报。

必须严格按照以下结构输出：

## 一、 ⚡ 24H 最新动态（核心重点）
基于【24小时内最新动态】数据，提炼出 3-5 条最新突发事件、社媒爆料或市场异动。
要求：极具时效性，用一句话总结现象，并紧跟一句加粗的“本质影响”分析。

## 二、 📈 行业趋势与关键变量
基于【近期行业趋势】数据，提炼该行业近期的宏观演变逻辑或关键数据变量。
要求：篇幅精简，切中要害。必须包含一个 Markdown 表格（| 变量/趋势名称 | 当前状态 | 长期影响 |）。

## 三、 🎯 明日推演
结合以上短期和长期信息，给出客观的短期趋势推演和风险提示。

## 四、 🔗 信息来源
提取分析中引用到的关键出处（包含24小时内和趋势报告的URL）。
必须严格使用提供的 JSON 数据中的 url 字段，以 Markdown 列表和超链接的形式输出，如：
* [文章/报告标题](具体的URL)

语言要求：客观、锐利、有数据支撑。
注意：直接输出内容，绝不要在最外层包裹 \`\`\`markdown 代码块标志！`
        }, {
          role: "user",
          content: `这是关于 ${industry} 的两组原始信息：\n\n【24小时内最新动态】：${data24h}\n\n【近期行业趋势】：${dataTrends}`
        }]
      });

      if (!response.choices || response.choices.length === 0) {
        console.error(`❌ API 未返回正常内容：`, JSON.stringify(response));
        continue;
      }

      let content = response.choices[0].message.content;
      content = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '');

      // ---------------------------------------------------------
      // 4. 保存文件与自动清理
      // ---------------------------------------------------------
      const dir = `./content/${industry}`;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const date = new Date().toISOString().split('T')[0];
      const filePath = `${dir}/${date}.md`;
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${industry} 报告已保存至：${filePath}`);

      const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
      if (files.length > 7) {
        for (let i = 7; i < files.length; i++) {
          fs.unlinkSync(path.join(dir, files[i]));
        }
      }

    } catch (error) {
      console.error(`❌ ${industry} 处理失败：`, error.message);
    }

    console.log("⏳ 休息 3 秒，准备处理下一个行业...");
    await sleep(3000);
  }
  console.log("\n🎉 所有行业更新完毕！");
}

runAll();