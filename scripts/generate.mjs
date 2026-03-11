import { OpenAI } from "openai";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: '.env.local' });

// 只需要一个 OpenRouter 客户端，完美解决所有问题
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAll() {
  const industries = ["贵金属", "人工智能", "电力"];
  const today = new Date().toISOString().split('T')[0];
  
  for (const industry of industries) {
    console.log(`\n🚀 开始处理【${industry}】行业... 日期锚点：${today}`);

    try {
      // ---------------------------------------------------------
      // 1. 情报压缩层：使用 Perplexity Sonar 联网搜索并提取高密度情报
      // ---------------------------------------------------------
      console.log(`📡 正在使用 Perplexity 联网检索并蒸馏【${industry}】最新情报...`);
      const searchResponse = await openai.chat.completions.create({
        // 使用 OpenRouter 上的 Perplexity 联网模型
        model: "perplexity/llama-3.1-sonar-large-128k-online", 
        messages: [{
          role: "user",
          content: `今天是 ${today}。请利用你的联网搜索能力，检索【${industry}】行业过去24小时内的最新突发新闻、Twitter/社交媒体热议动态，以及本周权威分析机构的最新趋势研判。
          
请帮我把搜索到的所有信息浓缩成一份高密度的情报备忘录，包含：
1. 具体的突发事件（带数据或具体来源名称）
2. 社交媒体上的主流情绪或争议点
3. 最新的行业变量/趋势
只输出事实，不要废话。`
        }]
      });

      const distilledInfo = searchResponse.choices[0]?.message?.content;
      
      if (!distilledInfo) {
        console.error(`❌ Perplexity 未返回情报摘要`);
        continue;
      }
      
      console.log(`✅ 情报蒸馏完成，获取高密度信息 ${distilledInfo.length} 字符。`);
      await sleep(2000); // 避开并发限制

      // ---------------------------------------------------------
      // 2. 深度分析层：使用 Claude 3.5 Sonnet 规范化排版与深度推演
      // ---------------------------------------------------------
      console.log(`🧠 正在交由 Claude 3.5 Sonnet 进行深度推演与 Markdown 排版...`);
      const response = await openai.chat.completions.create({
        model: "anthropic/claude-3.5-sonnet", 
        messages: [{
          role: "system",
          content: `你是一位冷酷、专业的行业分析师。请基于我提供的【情报备忘录】，输出一份 Markdown 行业情报。

【时间锚点】：今天是 ${today}。

⚠️ **输出准则（核心约束）**：
1. **寻找增量**：不要重复常识，只提取最新的“增量变量”。
2. **禁止寒暄**：禁止输出任何引导语或结束语。
3. **内容纯净**：首行必须直接以 "## 一、 ⚡ 24H 最新动态（核心重点）" 开始。
4. **严格使用以下结构**：

## 一、 ⚡ 24H 最新动态（核心重点）
基于数据提炼 3-5 条最新突发。每条总结后紧跟一句 **本质影响** 分析。

## 二、 📈 行业趋势与关键变量
提炼宏观逻辑。必须包含表格：| 变量/趋势名称 | 当前状态 | 长期影响 |。

## 三、 🎯 明日推演
给出客观的趋势预测和风险提示。`
        }, {
          role: "user",
          content: `这是经过验证的【${industry}】最新情报备忘录：\n\n${distilledInfo}`
        }]
      });

      if (!response.choices || response.choices.length === 0) {
        console.error(`❌ Claude 未返回内容`);
        continue;
      }

      // ---------------------------------------------------------
      // 3. 后处理与文件保存
      // ---------------------------------------------------------
      let content = response.choices[0].message.content.trim();
      const firstHeadingIndex = content.indexOf('## 一、');
      if (firstHeadingIndex !== -1) {
        content = content.substring(firstHeadingIndex);
      }
      content = content.replace(/^(#+)\s*(一、|二、|三、|四、)/gm, '## $2');
      content = content.replace(/^```markdown\s*/i, '').replace(/```\s*$/i, '').trim();

      const dir = `./content/${industry}`;
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      
      const filePath = `${dir}/${today}.md`;
      fs.writeFileSync(filePath, content);
      console.log(`✅ ${industry} 报告保存成功！`);

      // 清理旧文件
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
