# 执行 JS

当内置函数不足时，可将执行 JS 这一脚本函数绑定到按键。粘贴 JavaScript 片段，KeyPilot 会在按键被按下时运行它。

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">AI 聊天提示词——粘贴此内容，然后在第一句末尾补充脚本要完成的工作。</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">我想为 Chrome 扩展 KeyPilot 编写 JavaScript 代码，并希望它……

以下是 KeyPilot 的工作方式和功能说明。

KeyPilot 是一个用于键盘驱动浏览的 Chrome 扩展：您用鼠标指向对象，再用按键触发操作。函数（可重用操作）在键盘布局编辑器（Alt+C）中绑定到按键。执行 JS 是一个函数，其操作实例保存了粘贴的脚本。按下按键时，KeyPilot 会运行该脚本。

请编写一段可直接粘贴到执行 JS“脚本”字段中的完整脚本。不要用函数声明包裹它——该片段已经是异步函数的函数体。

运行时规则：
- 隔离世界（内容脚本）：DOM API 可用（document、querySelector、Element）。页面自己的 JavaScript 全局变量（React、jQuery、应用 `window` 属性）不可见。
- 不可使用 chrome.* API、KeyPilot 实例或存储 API。
- 可以使用 await。硬超时为 8 秒。
- 如果它将作为宏步骤，请返回一个值（下一步会将其视为 kpPriorResult）。

始终注入的绑定（可能为 null / undefined）：
- kpHoveredClickable — KeyPilot 当前视为悬停可点击对象（链接/按钮）的 Element，或 null
- kpHoverLeaf — 光标下最深的 Element，或 null
- kpFocusedTextField — 已聚焦的文本字段 / contenteditable，或 null
- kpMode — 字符串模式："none" | "inspector" | "text_focus" | "highlight" | "scroll_line" | "popover" | "omnibox"
- kpPageUrl — 当前页面 URL 字符串
- kpSelection — window.getSelection()（Selection API），或 null
- kpPriorResult — 前一宏步骤的结果（仅当此脚本作为宏步骤运行时）

仅当操作实例启用了匹配复选框时，回调才存在；否则它们为 undefined。请使用 `if (typeof showPopover === "function")` 进行保护。
- await showPopover(content, title?) — 结果弹出窗口；内容会被字符串化（对象 → JSON）
- await copyToClipboard(content) — 复制字符串化文本；返回布尔值
- notify(message) — 简短的闪现通知

请只输出脚本函数体。</pre>
<p class="muted">复制提示词后，请在 AI 聊天中粘贴并补完第一句。</p>
</div>

## 使用

1. 打开**键盘布局编辑器**（<kbd>Alt</kbd>+<kbd>C</kbd>）。
2. 在操作库中创建新的**执行 JS**操作实例。
3. 将脚本粘贴到**脚本**中。
4. 启用将要调用的**回调**（`showPopover`、`copyToClipboard`、`notify`）。
5. 将实例放到按键上，在页面中按该键运行。

脚本在**内容脚本隔离世界**中运行，并有 **8 秒**超时。

## 始终提供的绑定

每次运行都会将这些名称作为包装您片段的异步函数参数注入；它们**不是**需要声明的全局变量。

| 绑定 | 类型 | 含义 |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | KeyPilot 在光标下高亮的可点击对象（与“点击元素”激活的目标相同）；未悬停可点击对象时为 `null`。 |
| `kpHoverLeaf` | `Element \| null` | 光标下最深的 DOM 节点（文本、图片或嵌套元素），即使不是 KeyPilot 可点击对象。 |
| `kpFocusedTextField` | `Element \| null` | KeyPilot 认为处于文本输入时的焦点输入框、textarea 或 `contenteditable`；没有焦点字段时为 `null`。 |
| `kpMode` | `string \| null` | 当前 KeyPilot 模式。典型值：`none`、`inspector`、`text_focus`、`highlight`、`scroll_line`、`popover`、`omnibox`。 |
| `kpPageUrl` | `string` | 内容脚本所在页面的 `location.href`。 |
| `kpSelection` | `Selection \| null` | 浏览器 `window.getSelection()` 对象（anchor/focus、`toString()`、ranges）；不是 KeyPilot 自定义单元选择高亮。 |
| `kpPriorResult` | `any` | 该脚本作为**宏内部**步骤时前一宏步骤的返回值；作为独立操作按键时为 `undefined`。 |

使用 `kpHoveredClickable` 表示“我指向的链接/按钮”；使用 `kpHoverLeaf` 表示“光标像素下的任意对象”；使用 `kpFocusedTextField` 读取或写入活动字段。

## 回调（仅在启用时）

仅当该操作实例的匹配复选框开启时，这些名称才是**函数**；否则绑定为 `undefined`，调用会抛出错误。

| 回调 | 签名 | 作用 |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | 打开 KeyPilot 结果弹出窗口。`content` 会转换为文本（字符串保持不变；对象通过 `JSON.stringify`）。默认标题是 `Execute JS`。 |
| `copyToClipboard` | `async (content) => boolean` | 将字符串化的值复制到剪贴板。文本为空时返回 `false`。 |
| `notify` | `(message) => void` | 显示简短闪现通知。非字符串会被字符串化。 |

示例：

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## 返回值

- 片段是一个 `async` 函数的**函数体**。您可以 `return` 任意值并使用 `await`。
- 作为**按键操作**时，返回值未使用，但处理程序仍会等待 Promise。
- 作为**宏步骤**时，返回值会成为下一步的 `kpPriorResult`；抛出错误或超时会在此步骤停止宏。

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## 示例

复制悬停可点击对象的可见文本：

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

读取焦点字段：

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## 安全说明

- 隔离世界 ≠ 页面世界：网站定义的 `window` API 不会共享。
- 不要粘贴不受信任的脚本。片段可读取当前页面的 DOM。
- 失败或超时的脚本会停止该步骤；门控可以检测空结果。
- 请仅启用会调用的回调，以便未使用名称保持 `undefined`。
