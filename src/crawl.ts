import Crawler from "simplecrawler";
import * as cheerio from "cheerio";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import minimist from "minimist";

type MetaRecord = {
  url: string;
  title?: string;
  description?: string;
  keywords?: string;
  robots?: string;
  canonical?: string;
  ogType?: string;
  ogUrl?: string;
  image?: string;
  twitterCard?: string;
};

const args = minimist(process.argv.slice(2), {
  string: ["startUrl", "domain", "maxDepth", "concurrency", "interval"],
  default: { maxDepth: "0", concurrency: "2", interval: "500" },
});

if (!args.startUrl) {
  console.error("Usage:");
  console.error("  node --import 'data:text/javascript,import { register } from \"node:module\"; import { pathToFileURL } from \"node:url\"; register(\"ts-node/esm\", pathToFileURL(\"./\"));' src/crawl.ts --startUrl=https://example.com [--domain=example.com] [--maxDepth=2]");
  console.error("");
  console.error("NPM Scripts:");
  console.error("  npm run crawl -- --startUrl=https://example.com");
  console.error("  npm run crawl:safe:depth1 -- --startUrl=https://example.com");
  console.error("  npm run crawl:safe:depth2 -- --startUrl=https://example.com");
  console.error("  npm run crawl:fast -- --startUrl=https://example.com");
  process.exit(1);
}

const startUrl = args.startUrl as string;
// domainWhitelist は startUrl のホスト名を既定に
const domain = (args.domain as string) || new URL(startUrl).hostname;

const outDir = resolve(process.cwd(), "out");
if (!existsSync(outDir)) mkdirSync(outDir);

const results: MetaRecord[] = [];
const skipped: { url: string; reason: string }[] = [];
const errors: { url: string; code: string | number; status?: number }[] = [];

// UTM などノイズクエリの除外判定
const shouldSkipByQuery = (urlStr: string) => {
  try {
    const u = new URL(urlStr);
    const noisy = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "yclid", "mc_cid", "mc_eid"];
    return Array.from(u.searchParams.keys()).some((k) => noisy.includes(k));
  } catch {
    return false;
  }
};

// 非HTMLファイルの除外判定（拡張子ベース + Next.js画像最適化）
const shouldSkipByExtension = (urlStr: string) => {
  try {
    const u = new URL(urlStr);
    const pathname = u.pathname.toLowerCase();
    
    // Next.js の画像最適化パス
    if (pathname.startsWith('/_next/image')) {
      return true;
    }
    
    // 静的ファイルパス
    if (pathname.startsWith('/_next/static')) {
      return true;
    }
    
    // 拡張子による判定
    const nonHtmlExtensions = [
      '.css', '.js', '.json', '.xml', '.txt', '.pdf',
      '.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp', '.ico',
      '.mp4', '.mp3', '.wav', '.avi', '.mov',
      '.zip', '.rar', '.tar', '.gz',
      '.woff', '.woff2', '.ttf', '.eot',
      '.map', '.min.js', '.min.css'
    ];
    
    if (nonHtmlExtensions.some(ext => pathname.endsWith(ext))) {
      return true;
    }
    
    // URLクエリパラメータ内の画像ファイル判定
    const fullUrl = u.href.toLowerCase();
    if (fullUrl.includes('.jpg') || fullUrl.includes('.jpeg') || 
        fullUrl.includes('.png') || fullUrl.includes('.gif') || 
        fullUrl.includes('.webp') || fullUrl.includes('.svg')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
};

console.log(`🚀 Starting crawler for: ${startUrl}`);
console.log(`📊 Settings: maxDepth=${args.maxDepth}, concurrency=${args.concurrency}, interval=${args.interval}ms`);
console.log(`🌐 Domain: ${domain}`);

const crawler = new Crawler(startUrl);
crawler.maxDepth = parseInt(args.maxDepth, 10); // 0=無制限、1=リンク1階層…
crawler.maxConcurrency = parseInt(args.concurrency, 10);
crawler.interval = parseInt(args.interval, 10);
crawler.userAgent = "MetaSitemapCrawler/1.0 (+https://example.local)";
crawler.respectRobotsTxt = true;
crawler.timeout = 20000; // 20s
crawler.decodeResponses = true;
crawler.acceptCookies = false;
crawler.downloadUnsupported = false;
crawler.supportedMimeTypes = [/^text\/html/i, /^application\/xhtml\+xml/i];
crawler.domainWhitelist = [domain];

// フェッチ条件：ドメイン内、HTML、ノイズクエリ除外、非HTMLファイル除外
crawler.addFetchCondition((queueItem: any) => {
  let url = queueItem.url;
  
  // HTMLエンティティのデコード（&quot; -> " など）
  url = url.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  
  // 不正なURL（HTMLエンティティが残っている場合など）の除外
  if (url.includes('&quot;') || url.includes('"')) {
    return false;
  }
  
  // ノイズクエリの除外
  if (shouldSkipByQuery(url)) {
    return false;
  }
  
  // 非HTMLファイルの除外
  if (shouldSkipByExtension(url)) {
    return false;
  }
  
  // ドメインチェック
  try {
    const u = new URL(url);
    if (u.hostname !== domain) {
      return false;
    }
  } catch {
    return false;
  }
  
  return true;
});

// 進捗表示
let processedCount = 0;

// 取得完了時にパース
crawler.on("fetchcomplete", (queueItem: any, responseBuffer: any, response: any) => {
  processedCount++;
  console.log(`✅ [${processedCount}] ${queueItem.url}`);
  
  const ct = response?.headers?.["content-type"] as string | undefined;
  const contentType = ct?.split(";")[0]?.trim();

  // HTML 以外はスキップ
  if (!(contentType && (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")))) {
    skipped.push({ url: queueItem.url, reason: `non-html: ${contentType || "unknown"}` });
    return;
  }

  const html = responseBuffer.toString();
  const $ = cheerio.load(html);

  const text = (s?: string) => (s ? s.trim().replace(/\s+/g, " ") : "");

  // フォールバック機能付きでメタデータを取得
  const getTitle = () => {
    return text($("title").first().text()) ||
           text($('meta[property="og:title"]').attr("content")) ||
           text($('meta[name="twitter:title"]').attr("content"));
  };

  const getDescription = () => {
    return text($('meta[name="description"]').attr("content")) ||
           text($('meta[property="og:description"]').attr("content")) ||
           text($('meta[name="twitter:description"]').attr("content"));
  };

  const getImage = () => {
    return text($('meta[property="og:image"]').attr("content")) ||
           text($('meta[name="twitter:image"], meta[name="twitter:image:src"]').attr("content"));
  };

  const rec: MetaRecord = {
    url: queueItem.url,
    title: getTitle(),
    description: getDescription(),
    ogType: text($('meta[property="og:type"]').attr("content")),
    canonical: text($('link[rel="canonical"]').attr("href")),
    ogUrl: text($('meta[property="og:url"]').attr("content")),
    image: getImage(),
    twitterCard: text($('meta[name="twitter:card"]').attr("content")),
    keywords: text($('meta[name="keywords"]').attr("content")),
    robots: text($('meta[name="robots"]').attr("content")),
  };

  results.push(rec);
});

// エラーログ
crawler.on("fetcherror", (queueItem: any, response: any) => {
  console.log(`❌ Fetch error: ${queueItem.url} (${response?.statusCode || 'unknown'})`);
  errors.push({ url: queueItem.url, code: "fetcherror", ...(response?.statusCode && { status: response.statusCode }) });
});
crawler.on("fetchclienterror", (queueItem: any, errorData: any) => {
  console.log(`❌ Client error: ${queueItem.url} (${(errorData as any)?.code || "unknown"})`);
  errors.push({ url: queueItem.url, code: `client:${(errorData as any)?.code || "unknown"}` });
});
crawler.on("fetch404", (queueItem: any) => {
  console.log(`❌ 404: ${queueItem.url}`);
  errors.push({ url: queueItem.url, code: 404, status: 404 });
});
crawler.on("fetchtimeout", (queueItem: any) => {
  console.log(`⏱️  Timeout: ${queueItem.url}`);
  errors.push({ url: queueItem.url, code: "timeout" });
});

// クロール開始・終了のログ
crawler.on("crawlstart", () => {
  console.log(`🔄 Crawl started`);
});

crawler.on("complete", () => {
  console.log(`🔄 Crawl completed`);
});

// 完了時にファイル出力
crawler.on("complete", () => {
  // JSON
  writeFileSync(join(outDir, "results.json"), JSON.stringify(results, null, 2), "utf8");

  // CSV（安全に二重引用＆改行対応）
  const headers = [
    "url","title","description","ogType","canonical","ogUrl","image","twitterCard","keywords","robots"
  ] as const;

  const csvEscape = (val?: string | number): string => {
    const s = (val ?? "").toString();
    // 先頭の =, +, -, @ はシートでの「式扱い」防止のためプレフィックス（'）を付ける
    const protectedS = /^[=\-+@]/.test(s) ? "'" + s : s;
    return `"${protectedS.replace(/"/g, '""')}"`;
  };

  const csv = [
    headers.join(","),
    ...results.map(r => headers.map(h => csvEscape((r as any)[h])).join(","))
  ].join("\n");

  writeFileSync(join(outDir, "results.csv"), csv, "utf8");

  // スキップ＆エラー
  const toCsv = (rows: Record<string, any>[], cols: string[]): string =>
    [cols.join(","), ...rows.map(row => cols.map(c => csvEscape(row[c])).join(","))].join("\n");

  writeFileSync(join(outDir, "skipped.csv"), toCsv(skipped, ["url","reason"]), "utf8");
  writeFileSync(join(outDir, "errors.csv"), toCsv(errors, ["url","code","status"]), "utf8");

  console.log("✅ Done");
  console.log(`- out/results.csv (${results.length} rows)`);
  console.log(`- out/results.json`);
  console.log(`- out/skipped.csv`);
  console.log(`- out/errors.csv`);
});

crawler.start();
