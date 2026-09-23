# Execute JS

Execute JS は、組み込みの関数では足りないときにキーにバインドする Script 関数です。JavaScript スニペットを貼り付けると、そのキーが押されたときに KeyPilot が実行します。

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">AI チャット用プロンプト — これを貼り付けたあと、最初の文をスクリプトでやりたい内容で完成させてください。</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">Chrome 拡張機能 KeyPilot 用の JavaScript コードが欲しく、次のことをしたいです: …

以下が KeyPilot の仕組みと概要です。

KeyPilot はキーボード駆動のブラウジング向け Chrome 拡張機能です。マウスで指し示し、キーでアクションを実行します。関数（再利用可能な操作）はキーボードレイアウトエディター（Alt+C）でキーにバインドします。Execute JS は、アクションインスタンスに貼り付けたスクリプトを保持する関数です。キーが押されると、KeyPilot がそのスクリプトを実行します。

Execute JS の「Script」フィールドに貼り付けられる完全なスクリプトを書いてください。関数宣言で包まないでください — スニペットはすでに async 関数の本体です。

ランタイムのルール:
- 隔離ワールド（コンテンツスクリプト）: DOM API は使えます（document、querySelector、Element）。ページ側の JavaScript グローバル（React、jQuery、アプリの `window` プロパティ）は見えません。
- chrome.* API、KeyPilot インスタンス、ストレージ API は使えません。
- await は使えます。ハードタイムアウトは 8 秒です。
- マクロのステップになる場合は値を返してください（次のステップはそれを kpPriorResult として見ます）。

常に注入されるバインディング（null / undefined の場合あり）:
- kpHoveredClickable — KeyPilot が現在ホバー中のクリック可能要素（リンク / ボタン）として扱う Element、または null
- kpHoverLeaf — カーソル下の最も深い Element、または null
- kpFocusedTextField — フォーカス中のテキストフィールド / contenteditable、または null
- kpMode — 文字列モード: "none" | "inspector" | "text_focus" | "highlight" | "scroll_line" | "popover" | "omnibox"
- kpPageUrl — 現在のページ URL 文字列
- kpSelection — window.getSelection()（Selection API）、または null
- kpPriorResult — 前のマクロステップの結果（このスクリプトがマクロステップとして実行されるときのみ）

コールバックは、アクションインスタンスで対応するチェックボックスが有効な場合にのみ存在します。それ以外は undefined です。`if (typeof showPopover === "function")` でガードしてください。
- await showPopover(content, title?) — 結果ポップオーバー。content は文字列化されます（オブジェクト → JSON）
- await copyToClipboard(content) — 文字列化したテキストをコピー。boolean を返します
- notify(message) — 短いフラッシュ通知

スクリプト本体だけを出力してください。</pre>
<p class="muted">プロンプトをコピーし、AI チャットに貼り付けたあと、最初の文を完成させてください。</p>
</div>

## 使い方

1. **キーボードレイアウトエディター**（<kbd>Alt</kbd>+<kbd>C</kbd>）を開きます。
2. アクションライブラリで新しい **Execute JS** アクションインスタンスを作成します。
3. スクリプトを **Script** に貼り付けます。
4. 呼び出す **Callbacks**（`showPopover`、`copyToClipboard`、`notify`）を有効にします。
5. インスタンスをキーに配置します。
6. ページでそのキーを押して実行します。

スクリプトは **コンテンツスクリプトの隔離ワールド** で実行されます。**8 秒** のタイムアウトがあります。

## 常に提供されるバインディング

毎回の実行で、スニペットを包む async 関数のパラメータとして次の名前が注入されます。自分で宣言するグローバルではありません。

| Binding | Type | Meaning |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | KeyPilot がカーソル下でハイライトしているクリック可能要素（Click Element が起動するのと同じ対象）。クリック可能なものがホバーされていなければ `null`。 |
| `kpHoverLeaf` | `Element \| null` | カーソル下の最も深い DOM ノード（テキスト、画像、入れ子要素）。KeyPilot のクリック可能でなくても対象になります。 |
| `kpFocusedTextField` | `Element \| null` | KeyPilot がテキスト入力中とみなすときの、フォーカス中のテキスト入力、textarea、または `contenteditable`。フォーカス中のフィールドがなければ `null`。 |
| `kpMode` | `string \| null` | 現在の KeyPilot モード。典型値: `none`（通常のブラウズ）、`inspector`（Delete Mode / Cols Toggle の選択）、`text_focus`、`highlight`（文字選択）、`scroll_line`、`popover`、`omnibox`。 |
| `kpPageUrl` | `string` | コンテンツスクリプトが載っているページの `location.href`。 |
| `kpSelection` | `Selection \| null` | ブラウザの `window.getSelection()` オブジェクト（anchor/focus、`toString()`、ranges）。KeyPilot 独自の単位選択ハイライトではありません。 |
| `kpPriorResult` | `any` | このスクリプトが **マクロ内** で使われるときの、前のマクロステップの戻り値。単体のアクションとしてキーを押した場合は `undefined`。 |

「指しているリンク / ボタン」には `kpHoveredClickable` を、「カーソル下のピクセル」には `kpHoverLeaf` を使います。アクティブなフィールドの読み書きには `kpFocusedTextField` を使います。

## コールバック（有効な場合のみ）

これらの名前は、そのアクションインスタンスで **対応するチェックボックスがオンのときだけ関数** です。オフのときはバインディングは `undefined` で、呼び出すと例外になります。

| Callback | Signature | Role |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | KeyPilot の結果ポップオーバーを開きます。`content` はテキストに変換されます（文字列はそのまま、オブジェクトは `JSON.stringify`）。デフォルトのタイトルは `Execute JS` です。 |
| `copyToClipboard` | `async (content) => boolean` | 文字列化した値をクリップボードにコピーします。テキストが空なら `false` を返します。 |
| `notify` | `(message) => void` | 短いフラッシュ通知を表示します。文字列以外は文字列化されます。 |

例:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## 戻り値

- スニペットは **`async` 関数の本体** です。任意の値を `return` でき、`await` も使えます。
- **キー押下** としては、ハンドラがプロミスを待つ以外に戻り値は使われません。
- **マクロステップ** としては、戻り値が次のステップの `kpPriorResult` になります。投げられたエラーやタイムアウトで、マクロはこのステップで止まります。

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## 例

ホバー中のクリック可能要素の表示テキストをコピーする:

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

フォーカス中のフィールドを読む:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## 安全に関する注意

- 隔離ワールド ≠ ページワールド: サイト定義の `window` API は共有されません。
- 信頼できないスクリプトを貼り付けないでください。スニペットは現在のページの DOM を読めます。
- 失敗またはタイムアウトしたスクリプトはそのステップで止まります。Gate は空の結果を検出できます。
- 呼び出すコールバックだけを有効にし、未使用の名前は `undefined` のままにしてください。
