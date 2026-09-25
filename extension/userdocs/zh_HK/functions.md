# 功能與動作
功能是綁定至按鍵的建構區塊。**動作執行個體**是功能加上儲存的參數值。
## 使用方式
1. 開啟**鍵盤配置編輯器**（<kbd>Alt</kbd>+<kbd>C</kbd>）。
2. 瀏覽或搜尋**動作程式庫**（卡片或表格檢視）。
3. 選取功能。若它有參數，請建立或編輯**動作執行個體**（請清楚命名）。
4. 點選鍵盤參考鍵帽以放置該執行個體。
5. 在一般頁面按下按鍵來執行。
稍後要變更行為時，請在 Config 編輯執行個體的參數 — 使用該執行個體的每個按鍵都會取得變更。
## 參考
### 概念
| 詞彙 | 意義 |
| --- | --- |
| **功能** | 可重複使用的操作定義 |
| **動作執行個體** | 功能 + 儲存的參數 |
| **按鍵動作** | 佔用插槽的內容 — 功能/執行個體或巨集 |
| **結果目的地** | 剪貼板、浮動視窗、頁面變更、媒體庫等 |
### 程式庫類別（概覽）
Navigation · Tab Control · Begin URL · Get Page Data · Maps · Scroll · Select · Clipboard · Type · Keystrokes · Data · Lookup · Translate · Script · Media Library · AI · KeyPilot · Tools · System
### 值得注意的功能
<h3 id="type-characters">Type Characters</h3>
將儲存文字插入已聚焦欄位。請以修飾鍵組合綁定，使其可在輸入時執行。每個文字片段建立一個動作執行個體。
<h3 id="open-urls">開啟網址</h3>
在背景分頁開啟已儲存的一組網站。每組網站建立一個動作執行個體，並在鍵盤佈局編輯器的檢查器中編輯網址清單。參見[分頁與記錄](kp://docs/browsing-tabs#open-urls)。

<h3 id="open-bookmarks">開啟書籤</h3>

開啟書籤資料夾中前 30 個網站書籤（包含子資料夾）。在動作執行個體上選擇資料夾。參見[分頁與記錄](kp://docs/browsing-tabs#open-bookmarks)。
<h3 id="font-info">Font Info</h3>
顯示游標下已套用樣式文字的字型家族、大小、檔案類型、下載 URL 的浮動視窗，以及該文字範圍的外框。
<h3 id="lookup-word">Lookup Word</h3>
透過 Free Dictionary API 取得游標下單字的定義。當路徑可用時，動作執行個體可選用 Ask AI 來源。
<h3 id="translate">Translate</h3>
翻譯醒目提示內容，或游標下的字詞/句子/段落。目的地可以取代頁面文字或開啟浮動視窗。
<h3 id="send-text-to-ai">Send selection to AI</h3>
以可設定指示傳送選取文字。將結果傳送至剪貼板、浮動視窗或兩者。
<h3 id="execute-js">Execute JS</h3>
自訂指令碼功能。完整繫結、回呼和 AI 提示：[執行 JS](kp://docs/execute-js)。
### 內建與使用者
內建配置為唯讀來源；編輯會建立您擁有的使用者副本。
