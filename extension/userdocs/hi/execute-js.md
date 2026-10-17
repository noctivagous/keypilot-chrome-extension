# JS चलाएँ

JS चलाएँ एक स्क्रिप्ट फ़ंक्शन है जिसे आप तब कुंजी से बाँधते हैं जब कोई अंतर्निहित फ़ंक्शन काफी न हो। आप एक JavaScript स्निपेट चिपकाते हैं; वह कुंजी दबने पर KeyPilot उसे चलाता है।

<div class="kp-docs-ai-prompt">
<label for="kp-docs-execute-js-ai-prompt">AI चैट के लिए प्रॉम्प्ट — इसे चिपकाएँ, फिर पहले वाक्य को पूरा करें कि आप स्क्रिप्ट से क्या कराना चाहते हैं।</label>
<pre id="kp-docs-execute-js-ai-prompt" class="kp-docs-copy-prompt">मुझे Chrome एक्सटेंशन KeyPilot के लिए JavaScript कोड चाहिए, और मैं चाहता हूँ कि यह …

KeyPilot कैसे काम करता है, और यह क्या है, यहाँ है।

KeyPilot कीबोर्ड से ब्राउज़ करने वाला Chrome एक्सटेंशन है: माउस से इंगित करते हैं और कुंजियों से क्रियाएँ चलाते हैं। फ़ंक्शन (दोबारा इस्तेमाल होने वाले ऑपरेशन) कीबोर्ड लेआउट संपादक (Alt+C) में कुंजियों से बँधे होते हैं। JS चलाएँ एक ऐसा फ़ंक्शन है जिसके एक्शन इंस्टेंस में चिपकाई स्क्रिप्ट रहती है। कुंजी दबने पर KeyPilot वह स्क्रिप्ट चलाता है।

एक पूरी स्क्रिप्ट लिखें जिसे मैं JS चलाएँ के „स्क्रिप्ट” फ़ील्ड में चिपका सकूँ। इसे फ़ंक्शन घोषणा में न लपेटें — स्निपेट पहले से ही एक async फ़ंक्शन का बॉडी है।

रनटाइम नियम:
- आइसोलेटेड वर्ल्ड (कंटेंट स्क्रिप्ट): DOM API काम करते हैं (document, querySelector, Element)। पेज के अपने JavaScript ग्लोबल (React, jQuery, ऐप के `window` प्रॉपर्टी) दिखाई नहीं देते।
- कोई chrome.* API नहीं, कोई KeyPilot इंस्टेंस नहीं, कोई स्टोरेज API नहीं।
- await उपयोग कर सकते हैं। कठोर टाइमआउट 8 सेकंड है।
- अगर यह मैक्रो चरण होगा तो कोई मान लौटाएँ (अगला चरण उसे kpPriorResult के रूप में देखता है)।

हमेशा इंजेक्ट होने वाली बाइंडिंग (null / undefined हो सकती हैं):
- kpHoveredClickable — वह Element जिसे KeyPilot अभी होवर क्लिक करने योग्य (लिंक/बटन) मानता है, या null
- kpHoverLeaf — कर्सर के नीचे सबसे गहरा Element, या null
- kpFocusedTextField — फ़ोकस किया टेक्स्ट फ़ील्ड / contenteditable, या null
- kpMode — स्ट्रिंग मोड: "none" | "inspector" | "text_focus" | "highlight" | "scroll_line" | "popover" | "omnibox"
- kpPageUrl — वर्तमान पेज URL स्ट्रिंग
- kpSelection — window.getSelection() (Selection API), या null
- kpPriorResult — पिछले मैक्रो चरण का परिणाम (केवल जब यह स्क्रिप्ट मैक्रो चरण के रूप में चले)

कॉलबैक केवल तभी मौजूद होते हैं जब एक्शन इंस्टेंस पर मेल खाता चेकबॉक्स चालू हो; वरना वे undefined होते हैं। `if (typeof showPopover === "function")` से सुरक्षा करें।
- await showPopover(content, title?) — परिणाम पॉपओवर; content स्ट्रिंग बनता है (ऑब्जेक्ट → JSON)
- await copyToClipboard(content) — स्ट्रिंग बना पाठ कॉपी करता है; boolean लौटाता है
- notify(message) — संक्षिप्त फ़्लैश सूचना

कृपया केवल स्क्रिप्ट का बॉडी लिखें।</pre>
<p class="muted">प्रॉम्प्ट कॉपी करें, चिपकाने के बाद AI चैट में पहला वाक्य पूरा करें।</p>
</div>

## उपयोग

1. **कीबोर्ड लेआउट संपादक** खोलें (<kbd>Alt</kbd>+<kbd>C</kbd>)।
2. ऐक्शन लाइब्रेरी में नया **JS चलाएँ** एक्शन इंस्टेंस बनाएँ।
3. अपनी स्क्रिप्ट **स्क्रिप्ट** में चिपकाएँ।
4. जिन **कॉलबैक** को आप कॉल करेंगे उन्हें चालू करें (`showPopover`, `copyToClipboard`, `notify`)।
5. इंस्टेंस को किसी कुंजी पर रखें।
6. चलाने के लिए पेज पर कुंजी दबाएँ।

स्क्रिप्ट **कंटेंट-स्क्रिप्ट आइसोलेटेड वर्ल्ड** में चलती हैं। **8 सेकंड** का टाइमआउट है।

## हमेशा मिलने वाली बाइंडिंग

हर रन इन नामों को उस async फ़ंक्शन के पैरामीटर के रूप में इंजेक्ट करता है जो आपके स्निपेट को लपेटता है। ये ग्लोबल **नहीं** हैं जिन्हें आपको घोषित करना पड़े।

| बाइंडिंग | प्रकार | अर्थ |
| --- | --- | --- |
| `kpHoveredClickable` | `Element \| null` | कर्सर के नीचे वह क्लिक करने योग्य जिसे KeyPilot हाइलाइट कर रहा है (वही लक्ष्य जिसे एलिमेंट क्लिक करें सक्रिय करता)। कुछ क्लिक करने योग्य होवर न हो तो `null`। |
| `kpHoverLeaf` | `Element \| null` | कर्सर के नीचे सबसे गहरा DOM नोड (पाठ, छवि, या नेस्टेड एलिमेंट), तब भी जब वह KeyPilot क्लिक करने योग्य न हो। |
| `kpFocusedTextField` | `Element \| null` | फ़ोकस किया टेक्स्ट इनपुट, textarea, या `contenteditable`, जब KeyPilot आपको पाठ प्रविष्टि में मानता है। कोई फ़ील्ड फ़ोकस न हो तो `null`। |
| `kpMode` | `string \| null` | वर्तमान KeyPilot मोड। आम मान: `none` (सामान्य ब्राउज़), `inspector` (डिलीट मोड / स्तंभ टॉगल चुनना), `text_focus`, `highlight` (वर्ण चयन), `scroll_line`, `popover`, `omnibox`। |
| `kpPageUrl` | `string` | उस पेज का `location.href` जिस पर कंटेंट स्क्रिप्ट है। |
| `kpSelection` | `Selection \| null` | ब्राउज़र का `window.getSelection()` ऑब्जेक्ट (anchor/focus, `toString()`, ranges)। KeyPilot के कस्टम इकाई-चयन हाइलाइट नहीं। |
| `kpPriorResult` | `any` | पिछले मैक्रो चरण का लौटाया मान, जब यह स्क्रिप्ट **मैक्रो के अंदर** चले। जब आप कुंजी को अलग क्रिया के रूप में दबाते हैं तो `undefined`। |

„जिस लिंक/बटन की ओर मैं इशारा कर रहा हूँ” के लिए `kpHoveredClickable` उपयोग करें। „कर्सर के नीचे जो भी पिक्सेल है” के लिए `kpHoverLeaf` उपयोग करें। सक्रिय फ़ील्ड पढ़ने या लिखने के लिए `kpFocusedTextField` उपयोग करें।

## कॉलबैक (केवल चालू होने पर)

ये नाम **केवल तभी फ़ंक्शन होते हैं जब उस एक्शन इंस्टेंस पर मेल खाता चेकबॉक्स चालू हो**। बॉक्स बंद हो तो बाइंडिंग `undefined` है — कॉल करने पर त्रुटि होती है।

| कॉलबैक | सिग्नेचर | भूमिका |
| --- | --- | --- |
| `showPopover` | `async (content, title?) => void` | KeyPilot का परिणाम पॉपओवर खोलता है। `content` पाठ बन जाता है (स्ट्रिंग ज्यों की त्यों; ऑब्जेक्ट `JSON.stringify` से)। डिफ़ॉल्ट शीर्षक `Execute JS` है। |
| `copyToClipboard` | `async (content) => boolean` | स्ट्रिंग बने मान को क्लिपबोर्ड पर कॉपी करता है। पाठ खाली हो तो `false` लौटाता है। |
| `notify` | `(message) => void` | छोटी फ़्लैश सूचना दिखाता है। गैर-स्ट्रिंग स्ट्रिंग बन जाती हैं। |

उदाहरण:

```js
if (typeof notify === 'function') notify('Ran Execute JS');
const text = (kpHoveredClickable && kpHoveredClickable.textContent) || '';
if (typeof copyToClipboard === 'function') await copyToClipboard(text.trim());
if (typeof showPopover === 'function') await showPopover(text.trim() || '(empty)', 'Hovered text');
return text;
```

## लौटाया मान

- स्निपेट एक **`async` फ़ंक्शन का बॉडी** है। आप कोई भी मान `return` कर सकते हैं और `await` उपयोग कर सकते हैं।
- **कुंजी दबाने** पर लौटाया मान उपयोग नहीं होता, सिवाय इसके कि हैंडलर फिर भी प्रॉमिस का इंतज़ार करता है।
- **मैक्रो चरण** के रूप में लौटाया मान अगले चरण के लिए `kpPriorResult` बन जाता है। फेंकी गई त्रुटि या टाइमआउट मैक्रो को इसी चरण पर रोक देता है।

```js
return kpHoveredClickable && kpHoveredClickable.getAttribute('href');
```

## उदाहरण

होवर क्लिक करने योग्य का दिखाई देने वाला पाठ कॉपी करें:

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

फ़ोकस किया फ़ील्ड पढ़ें:

```js
const field = kpFocusedTextField;
if (!field) return '';
return 'value' in field ? String(field.value || '') : String(field.innerText || '');
```

## सुरक्षा नोट

- आइसोलेटेड वर्ल्ड ≠ पेज वर्ल्ड: साइट द्वारा परिभाषित `window` API साझा नहीं होते।
- अविश्वसनीय स्क्रिप्ट न चिपकाएँ। स्निपेट वर्तमान पेज का DOM पढ़ सकता है।
- विफल या टाइमआउट हुई स्क्रिप्ट उस चरण को रोकती हैं; गेट खाली परिणाम पहचान सकते हैं।
- केवल वे कॉलबैक चालू करें जिन्हें आप कॉल करते हैं, ताकि बिना इस्तेमाल के नाम `undefined` रहें।
