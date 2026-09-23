# 執行 JS
當內建功能不足時，可將 Execute JS 這個指令碼功能綁定到按鍵。貼上 JavaScript 片段；按下該按鍵時 KeyPilot 會執行它。

## 使用方式
1. 開啟**鍵盤配置編輯器**（<kbd>Alt</kbd>+<kbd>C</kbd>）。
2. 在動作程式庫建立新的**Execute JS**動作執行個體。
3. 將指令碼貼到**Script**。
4. 啟用您要呼叫的**Callbacks**（`showPopover`、`copyToClipboard`、`notify`）。
5. 將執行個體放到按鍵上。
6. 在頁面按下按鍵執行。
指令碼在**內容指令碼隔離世界**中執行，逾時時間為**8 秒**。

## 永遠提供的繫結
每次執行都會將這些名稱注入包裝片段的 async 函式參數。它們**不是**您必須宣告的全域變數。
| 繫結 | 類型 | 意義 |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | KeyPilot 在游標下醒目提示的可點擊項目（Click Element 會啟用的相同目標）。未停留於可點擊項目時為 `null`。 |
| `kpHoverLeaf` | `Element \| null` | 游標下最深的 DOM 節點（文字、圖片或巢狀元素），即使它不是 KeyPilot 可點擊項目。 |
| `kpFocusedTextField` | `Element \| null` | KeyPilot 視為正在輸入時已聚焦的文字輸入、textarea 或 `contenteditable`。沒有欄位時為 `null`。 |
| `kpMode` | `string \| null` | 目前 KeyPilot 模式。常見值：`none`、`inspector`、`text_focus`、`highlight`、`scroll_line`、`popover`、`omnibox`。 |
| `kpPageUrl` | `string` | 內容指令碼所在頁面的 `location.href`。 |
| `kpSelection` | `Selection \| null` | 瀏覽器 `window.getSelection()` 物件（anchor/focus、`toString()`、ranges），不是 KeyPilot 自訂的單位選取醒目提示。 |
| `kpPriorResult` | `any` | 此指令碼作為**巨集內部**步驟時，前一巨集步驟的回傳值。獨立按鍵動作時為 `undefined`。 |
使用 `kpHoveredClickable` 表示「我指向的連結/按鈕」，使用 `kpHoverLeaf` 表示「游標下的任何像素」，使用 `kpFocusedTextField` 讀寫使用中的欄位。

## 回呼（僅在啟用時）
只有動作執行個體上勾選相符方塊時，這些名稱才是**函式**。若方塊關閉，繫結是 `undefined`，呼叫會擲出錯誤。
| 回呼 | 簽章 | 角色 |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | 開啟 KeyPilot 結果浮動視窗；`content` 會轉為文字（物件 → JSON）。 |
| `copyToClipboard` | `async (content) => boolean` | 將文字化的值複製到剪貼板；文字空白時回傳 `false`。 |
| `notify` | `(message) => void` | 顯示短暫閃現通知；非字串會轉為字串。 |

## 回傳值與安全注意事項
- 片段是 `async` 函式的**主體**。可 `return` 任意值並使用 `await`。
- 作為**按鍵動作**時，回傳值不使用，但處理常式仍會等待 promise。
- 作為**巨集步驟**時，回傳值會成為下一步的 `kpPriorResult`。擲出錯誤或逾時會在此步停止巨集。
- 隔離世界 ≠ 頁面世界：網站定義的 `window` API 不會共享。
- 請勿貼上不受信任的指令碼；片段可讀取目前頁面的 DOM。
- 失敗或逾時的指令碼會停止該步；Gate 可偵測空白結果。
- 請只啟用會呼叫的回呼，讓未使用名稱維持 `undefined`。

範例：

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

複製停留位置可點擊項目的可見文字：

```js
const el = kpHoveredClickable;
if (!el) {
  if (typeof notify === 'function') notify('Nothing clickable under the cursor');
  return '';
}
const text = (el.innerText || el.textContent || '').trim();
if (typeof copyToClipboard === 'function') await copyToClipboard(text);
return text;
```

讀取已聚焦欄位：

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```
