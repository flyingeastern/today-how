import fs from "fs";
import path from "path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 获取所有行业的报告
function getAllReports() {
  const industries = ["贵金属", "人工智能", "电力"];
  const allData: Record<string, any[]> = {};

  industries.forEach((industry) => {
    const contentDir = path.join(process.cwd(), "content", industry);
    let reports: any[] = [];
    
    if (fs.existsSync(contentDir)) {
      const files = fs.readdirSync(contentDir);
      reports = files
        .filter((file) => file.endsWith(".md"))
        .sort((a, b) => b.localeCompare(a)) // 日期倒序，最新的排在最前面
        .map((file) => ({
          date: file.replace(".md", ""),
          content: fs.readFileSync(path.join(contentDir, file), "utf-8"),
        }));
    }
    allData[industry] = reports;
  });

  return allData;
}

export default function Home() {
  const allReports = getAllReports();

  return (
    <main className="min-h-screen bg-[#e5e5e5] py-12 px-4 sm:px-6 lg:px-8">
      {/* 整体加宽一点以适应三列布局 */}
      <div className="max-w-[90rem] mx-auto">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">今日如何 (Today How)</h1>
          <p className="mt-4 text-lg text-gray-600">全网情报自动追踪 | 每日更新</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {Object.entries(allReports).map(([industry, reports]) => {
            // 分离出最新的一天，和历史记录
            const latestReport = reports[0];
            const historyReports = reports.slice(1, 4); // slice(1, 4) 代表取历史记录的前3天

            return (
              <div key={industry} className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 border-b-2 border-blue-600 pb-2 inline-block">
                  {industry} 动态
                </h2>
                
                {!latestReport ? (
                  <p className="text-gray-500 text-sm">暂无数据</p>
                ) : (
                  <>
                    {/* 1. 当日最新报告（完全展开） */}
                    <article className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                      <div className="mb-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700">
                          🔥 最新：{latestReport.date}
                        </span>
                      </div>
                      <div className="prose prose-sm prose-blue max-w-none prose-headings:font-semibold prose-a:text-blue-600 prose-table:w-full prose-th:text-left text-gray-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {latestReport.content}
                        </ReactMarkdown>
                      </div>
                    </article>

                    {/* 2. 历史报告折叠面板（过往3天） */}
                    {historyReports.length > 0 && (
                      <div className="mt-8 space-y-3">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
                          往期回顾
                        </h3>
                        {historyReports.map((report) => (
                          <details 
                            key={report.date} 
                            className="group bg-white rounded-lg shadow-sm border border-gray-200 [&_summary::-webkit-details-marker]:hidden"
                          >
                            <summary className="flex cursor-pointer items-center justify-between p-4 font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-lg">
                              <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400">📅</span>
                                {report.date} 报告
                              </span>
                              <span className="transition group-open:rotate-180 text-gray-400">
                                <svg fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24" width="20"><path d="M6 9l6 6 6-6"></path></svg>
                              </span>
                            </summary>
                            {/* 折叠展开的内容区 */}
                            <div className="p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-lg">
                              <div className="prose prose-sm prose-gray max-w-none prose-table:w-full prose-th:text-left text-gray-600">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {report.content}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </details>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}