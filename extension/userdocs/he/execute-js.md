# הרצת JS

הרצת JS היא פונקציית סקריפט שמשייכים למקש כשפונקציה מובנית לא מספיקה. מדביקים קטע JavaScript; KeyPilot מריץ אותו כשלוחצים על המקש הזה.

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">הנחיה לצ'אט בינה מלאכותית — הדביקו את זה, ואז השלימו את המשפט הראשון במה שאתם רוצים שהסקריפט יעשה.</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">אני רוצה קוד JavaScript ל-KeyPilot, תוסף Chrome, ואני רוצה שהוא …

הנה איך KeyPilot עובד, ומהו.

KeyPilot הוא תוסף Chrome לגלישה מונחית מקלדת: מצביעים עם העכבר ומפעילים פעולות במקשים. פונקציות (פעולות לשימוש חוזר) משויכות למקשים בעורך פריסת המקלדת (Alt+C). הרצת JS היא פונקציה שמופע הפעולה שלה מחזיק סקריפט שהודבק. כשלוחצים על המקש, KeyPilot מריץ את הסקריפט הזה.

כתבו סקריפט שלם שאפשר להדביק בשדה „סקריפט” של הרצת JS. אל תעטפו אותו בהצהרת פונקציה — הקטע כבר הגוף של פונקציית async.

כללי זמן ריצה:
- עולם מבודד (סקריפט תוכן): ממשקי DOM עובדים (document, querySelector, Element). המשתנים הגלובליים של JavaScript של הדף עצמו (React, jQuery, מאפייני `window` של האפליקציה) אינם גלויים.
- אין ממשקי chrome.*, אין מופע KeyPilot, אין ממשקי אחסון.
- אפשר להשתמש ב-await. פסק הזמן הקשיח הוא 8 שניות.
- החזירו ערך אם זה יהיה שלב מאקרו (השלב הבא רואה אותו כ-kpPriorResult).

קישורים שמוזרקים תמיד (עשויים להיות null / undefined):
- kpHoveredClickable — הרכיב ש-KeyPilot מתייחס אליו כרגע כלחיץ בריחוף (קישור/כפתור), או null
- kpHoverLeaf — הרכיב העמוק ביותר מתחת לסמן, או null
- kpFocusedTextField — שדה טקסט במיקוד / contenteditable, או null
- kpMode — מצב במחרוזת: "none" | "inspector" | "text_focus" | "highlight" | "scroll_line" | "popover" | "omnibox"
- kpPageUrl — מחרוזת כתובת הדף הנוכחי
- kpSelection — window.getSelection() (ממשק Selection), או null
- kpPriorResult — תוצאת שלב המאקרו הקודם (רק כשהסקריפט הזה רץ כשלב מאקרו)

קריאות חוזרות קיימות רק אם תיבת הסימון התואמת מסומנת במופע הפעולה; אחרת הן undefined. הגנו עם `if (typeof showPopover === "function")`.
- await showPopover(content, title?) — חלון צף של תוצאה; content מומר למחרוזת (אובייקטים → JSON)
- await copyToClipboard(content) — מעתיק טקסט שהומר למחרוזת; מחזיר boolean
- notify(message) — התראה מהבהבת קצרה

נא להוציא רק את גוף הסקריפט.</pre>
<p class="muted">העתיקו את ההנחיה, ואז השלימו את המשפט הראשון בצ'אט הבינה המלאכותית אחרי ההדבקה.</p>
</div>

## שימוש

1. פתחו את **עורך פריסת המקלדת** (<kbd>Alt</kbd>+<kbd>C</kbd>).
2. צרו מופע פעולה חדש של **הרצת JS** בספריית הפעולות.
3. הדביקו את הסקריפט ב-**סקריפט**.
4. הפעילו כל **קריאות חוזרות** שתקראו להן (`showPopover`, `copyToClipboard`, `notify`).
5. הניחו את המופע על מקש.
6. לחצו על המקש בדף כדי להריץ.

הסקריפטים רצים ב-**עולם המבודד של סקריפט התוכן**. יש פסק זמן של **8 שניות**.

## קישורים שתמיד מסופקים

כל הרצה מזריקה את השמות האלה כפרמטרים של פונקציית ה-async שעוטפת את הקטע. אלה **לא** משתנים גלובליים שצריך להצהיר עליהם.

| קישור | סוג | משמעות |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | הלחיץ ש-KeyPilot מדגיש מתחת לסמן (אותו יעד שלחיצה על רכיב הייתה מפעילה). `null` אם אין לחיץ בריחוף. |
| `kpHoverLeaf` | `Element \| null` | צומת ה-DOM העמוק ביותר מתחת לסמן (טקסט, תמונה או רכיב מקונן), גם כשאינו לחיץ של KeyPilot. |
| `kpFocusedTextField` | `Element \| null` | קלט הטקסט, אזור הטקסט או `contenteditable` שבמיקוד, כש-KeyPilot רואה אתכם בהזנת טקסט. `null` אם אין שדה במיקוד. |
| `kpMode` | `string \| null` | מצב KeyPilot הנוכחי. ערכים אופייניים: `none` (גלישה רגילה), `inspector` (בחירה במצב מחיקה / מתג עמודות), `text_focus`, `highlight` (בחירת תווים), `scroll_line`, `popover`, `omnibox`. |
| `kpPageUrl` | `string` | `location.href` של הדף שבו סקריפט התוכן רץ. |
| `kpSelection` | `Selection \| null` | אובייקט `window.getSelection()` של הדפדפן (anchor/focus, `toString()`, טווחים). לא ההדגשות של בחירת היחידות המותאמת של KeyPilot. |
| `kpPriorResult` | `any` | ערך ההחזרה של שלב המאקרו הקודם כשהסקריפט משמש **בתוך מאקרו**. `undefined` כשלוחצים על המקש כפעולה עצמאית. |

השתמשו ב-`kpHoveredClickable` עבור „הקישור או הכפתור שאני מצביע עליו”. השתמשו ב-`kpHoverLeaf` עבור „כל פיקסל שמתחת לסמן”. השתמשו ב-`kpFocusedTextField` כדי לקרוא או לכתוב את השדה הפעיל.

## קריאות חוזרות (רק אם הופעלו)

השמות האלה הם **פונקציות רק כשתיבת הסימון התואמת מסומנת** במופע הפעולה הזה. אם התיבה כבויה, הקישור הוא `undefined` — קריאה אליו זורקת.

| קריאה חוזרת | חתימה | תפקיד |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | פותח את חלון התוצאה של KeyPilot. `content` מומר לטקסט (מחרוזות כפי שהן; אובייקטים דרך `JSON.stringify`). כותרת ברירת המחדל היא `Execute JS`. |
| `copyToClipboard` | `async (content) => boolean` | מעתיק את הערך שהומר למחרוזת ללוח. מחזיר `false` אם הטקסט ריק. |
| `notify` | `(message) => void` | מציג התראה מהבהבת קצרה. מה שאינו מחרוזת מומר למחרוזת. |

דוגמה:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## ערך החזרה

- הקטע הוא **הגוף של פונקציית `async`**. אפשר `return` של כל ערך, ואפשר להשתמש ב-`await`.
- ב**לחיצת מקש**, ערך ההחזרה לא בשימוש, מלבד זאת שהמטפל עדיין ממתין ל-promise.
- כ**שלב מאקרו**, ערך ההחזרה הופך ל-`kpPriorResult` של השלב הבא. שגיאה שנזרקת או פסק זמן עוצרים את המאקרו בשלב הזה.

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## דוגמאות

העתקת הטקסט הגלוי של הלחיץ בריחוף:

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

קריאת השדה שבמיקוד:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## הערות בטיחות

- עולם מבודד ≠ עולם הדף: ממשקי `window` שהאתר מגדיר אינם משותפים.
- אל תדביקו סקריפטים לא מהימנים. הקטע יכול לקרוא את ה-DOM של הדף הנוכחי.
- סקריפטים שנכשלו או שחרגו מזמן עוצרים את השלב הזה; שערים יכולים לזהות תוצאות ריקות.
- העדיפו להפעיל רק את הקריאות החוזרות שאתם קוראים להן, כדי ששמות שלא בשימוש יישארו `undefined`.
