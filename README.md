# Sitemap Crawler

Webサイトのメタ情報を収集するクローラーツールです。指定したURLから始まり、サイト内のリンクを辿ってページのメタデータ（title、description、OGタグなど）を取得し、CSV・JSON形式で出力します。

## 特徴

- ✅ **メタ情報の包括的収集**: title、description、keywords、OGタグ、Twitterカードなど
- ✅ **サーバー負荷軽減**: 適切な間隔とコンカレンシー制限
- ✅ **robots.txt準拠**: robots.txtを尊重した礼儀正しいクローリング
- ✅ **柔軟な出力形式**: CSV（Excel対応）とJSON形式で出力
- ✅ **エラー・スキップログ**: 取得できなかったページの詳細記録
- ✅ **UTMパラメータ除外**: ノイズクエリの自動スキップ

## インストール

```bash
npm install
```

## 基本的な使い方

### NPMスクリプト経由（推奨）

```bash
# 基本実行（デフォルト設定）
npm run crawl -- --startUrl=https://example.com

# 2階層まで巡回（推奨）
npm run crawl:depth2 -- --startUrl=https://example.com

# 1階層のみ
npm run crawl:depth1 -- --startUrl=https://example.com

# より安全な設定（サーバー負荷最小）
npm run crawl:safe -- --startUrl=https://example.com

# 高速実行（注意: サーバー負荷が高くなります）
npm run crawl:fast -- --startUrl=https://example.com
```

### 直接実行

```bash
node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("ts-node/esm", pathToFileURL("./"));' src/crawl.ts --startUrl=https://example.com --maxDepth=2
```

## オプション

| オプション | 説明 | デフォルト値 | 推奨値 |
|-----------|------|-------------|--------|
| `--startUrl` | 開始URL（必須） | - | - |
| `--domain` | クロール対象ドメイン | startUrlのホスト名 | 明示的に指定推奨 |
| `--maxDepth` | クロール階層の深さ | 0（無制限） | 1-3 |
| `--concurrency` | 同時リクエスト数 | 2 | 1-3 |
| `--interval` | リクエスト間隔（ミリ秒） | 500 | 500-1000 |

### 各オプションの詳細

#### `--startUrl`（必須）
クロールを開始するURL。このページから始まり、同一ドメイン内のリンクを辿ります。

```bash
--startUrl=https://example.com
--startUrl=https://example.com/products/
```

#### `--domain`
クロール対象のドメインを明示的に指定。省略した場合はstartURLのホスト名を使用。

```bash
--domain=example.com
--domain=blog.example.com
```

#### `--maxDepth`
リンクを辿る階層の深さ。0は無制限（注意が必要）。

- `0`: 無制限（大規模サイトでは危険）
- `1`: 開始ページから直接リンクされたページのみ
- `2`: 2階層まで（中規模サイト向け）
- `3`: 3階層まで（大規模サイト向け）

#### `--concurrency`
同時に処理するリクエストの数。サーバー負荷に直結します。

- `1`: 最も安全（1つずつ順次処理）
- `2`: バランス型（推奨）
- `3`: やや高速（注意が必要）
- `5+`: 高負荷（本番サイトでは非推奨）

#### `--interval`
リクエスト間の待機時間（ミリ秒）。サーバー負荷軽減の重要な設定。

- `1000`: 非常に安全（1秒間隔）
- `500`: 安全（0.5秒間隔、推奨）
- `250`: 標準的
- `100`: やや高負荷（注意が必要）

## プリセット設定

### `crawl:depth1`
```bash
npm run crawl:depth1 -- --startUrl=https://example.com
```
- **用途**: トップページとその直下ページのみ
- **設定**: maxDepth=1, concurrency=2, interval=500ms
- **推奨シーン**: 小規模サイト、初回テスト

### `crawl:depth2`
```bash
npm run crawl:depth2 -- --startUrl=https://example.com
```
- **用途**: 中規模サイトの包括的調査
- **設定**: maxDepth=2, concurrency=2, interval=500ms
- **推奨シーン**: 一般的な企業サイト、ブログ

### `crawl:depth3`
```bash
npm run crawl:depth3 -- --startUrl=https://example.com
```
- **用途**: 大規模サイトの深い調査
- **設定**: maxDepth=3, concurrency=1, interval=750ms
- **推奨シーン**: 大規模ECサイト、メディアサイト

### `crawl:safe`
```bash
npm run crawl:safe -- --startUrl=https://example.com
```
- **用途**: サーバー負荷を最小限に抑制
- **設定**: maxDepth=2, concurrency=1, interval=1000ms
- **推奨シーン**: 本番環境、高負荷時の調査

### `crawl:safe:depth1`
```bash
npm run crawl:safe:depth1 -- --startUrl=https://example.com
```
- **用途**: 最も安全な1階層のみクロール
- **設定**: maxDepth=1, concurrency=1, interval=1000ms
- **推奨シーン**: 初回テスト、非常に慎重な調査

### `crawl:safe:depth2`
```bash
npm run crawl:safe:depth2 -- --startUrl=https://example.com
```
- **用途**: 安全な2階層クロール（crawl:safeと同じ）
- **設定**: maxDepth=2, concurrency=1, interval=1000ms
- **推奨シーン**: 標準的な安全調査

### `crawl:safe:depth3`
```bash
npm run crawl:safe:depth3 -- --startUrl=https://example.com
```
- **用途**: 安全な3階層深いクロール
- **設定**: maxDepth=3, concurrency=1, interval=1500ms
- **推奨シーン**: 大規模サイトの包括的な安全調査

### `crawl:fast`
```bash
npm run crawl:fast -- --startUrl=https://example.com
```
- **用途**: 高速データ収集（注意が必要）
- **設定**: maxDepth=2, concurrency=3, interval=250ms
- **推奨シーン**: テスト環境、開発時の検証

## 出力ファイル

実行完了後、`out/`ディレクトリに以下のファイルが生成されます：

### `results.csv`
メタ情報の一覧（Excel対応）
- URL、ステータスコード、title、description等
- 数式インジェクション対策済み

### `results.json`
同じデータのJSON形式

### `skipped.csv`
スキップされたURLと理由
- HTMLでないファイル
- UTMパラメータ付きURL等

### `errors.csv`
エラーが発生したURLと詳細
- 404エラー
- タイムアウト
- ネットワークエラー等

## クローリングマナーとベストプラクティス

### 🚨 重要な注意事項

1. **robots.txt の確認**
   - 本ツールは自動的にrobots.txtを尊重しますが、事前確認を推奨
   - `https://example.com/robots.txt` を確認

2. **適切な間隔の設定**
   - `interval` は最低500ms以上を推奨
   - 本番サイトでは1000ms以上が安全

3. **同時接続数の制限**
   - `concurrency` は2以下を推奨
   - 大規模サイトでは1を推奨

4. **実行時間の考慮**
   - 大規模サイトでは数時間かかる場合があります
   - 途中で停止する場合は Ctrl+C

### 📋 推奨実行パターン

```bash
# 1. 最初のテスト（最も安全）
npm run crawl:safe:depth1 -- --startUrl=https://example.com

# 2. 結果確認後、範囲拡大
npm run crawl:safe:depth2 -- --startUrl=https://example.com

# 3. 本格調査（大規模サイト用）
npm run crawl:safe:depth3 -- --startUrl=https://example.com
```

### ⚠️ 避けるべき設定

```bash
# 危険: 同時接続数が多すぎる
npm run crawl -- --startUrl=https://example.com --concurrency=10

# 危険: 間隔が短すぎる
npm run crawl -- --startUrl=https://example.com --interval=50

# 危険: 無制限クロール
npm run crawl -- --startUrl=https://example.com --maxDepth=0
```

## User-Agent

本ツールは以下のUser-Agentを使用します：
```
MetaSitemapCrawler/1.0 (+https://example.local)
```

## ライセンス

ISC

## トラブルシューティング

### メモリ不足エラー
大規模サイトでメモリ不足が発生する場合：
- `maxDepth` を小さくする
- `concurrency` を1に設定
- 複数回に分けて実行

### タイムアウトエラーが多発
- `interval` を増やす（1000ms以上）
- `concurrency` を1に設定
- ネットワーク環境を確認

### robots.txt エラー
- robots.txtが適切に設置されているか確認
- 該当サイトでクローリングが許可されているか確認
