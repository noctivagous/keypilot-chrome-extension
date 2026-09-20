(function (global) {
    var LOCALES = { en: true, de: true, es: true, es_419: true };
    var HTML_LANG = { en: "en", de: "de", es: "es", es_419: "es-419" };

    function requestedLocale() {
        var params = new URLSearchParams(location.search);
        var raw = params.get("lang") || params.get("locale") || "";
        raw = String(raw).replace(/-/g, "_");
        if (LOCALES[raw]) return raw;
        if (raw === "es_ES") return "es";
        if (raw.indexOf("es") === 0) return "es_419";
        if (raw.indexOf("de") === 0) return "de";
        return "";
    }

    function applyVars(vars) {
        if (!vars) return;
        document.querySelectorAll("[data-var-text]").forEach(function (el) {
            var key = el.getAttribute("data-var-text");
            if (vars[key] == null) return;
            el.textContent = vars[key];
        });
        if (vars.document_title) document.title = vars.document_title;
        if (vars.aria_label) {
            var svg = document.querySelector("#stage svg");
            if (svg) svg.setAttribute("aria-label", vars.aria_label);
        }
        if (vars.locale && HTML_LANG[vars.locale]) {
            document.documentElement.lang = HTML_LANG[vars.locale];
        }
    }

    function localeUrl(locale) {
        return new URL("locales/key-click-intro/" + locale + ".json", document.baseURI).href;
    }

    global.__kpApplyKeyClickLocale = function () {
        var hf = global.__hyperframes;
        var hfVars = hf && typeof hf.getVariables === "function" ? hf.getVariables() || {} : {};
        var lang = requestedLocale();

        if (!lang && hfVars && Object.keys(hfVars).length) {
            applyVars(hfVars);
            return Promise.resolve(hfVars);
        }

        var locale = lang || "en";
        if (!lang && locale === "en") {
            applyVars({ locale: "en" });
            return Promise.resolve({});
        }

        return fetch(localeUrl(locale))
            .then(function (res) {
                if (!res.ok) throw new Error("locale " + locale);
                return res.json();
            })
            .then(function (json) {
                var merged = Object.assign({}, json, hfVars);
                applyVars(merged);
                return merged;
            })
            .catch(function (err) {
                console.warn("[key-click-intro] locale load failed:", err);
                applyVars(hfVars);
                return hfVars;
            });
    };
})(window);
