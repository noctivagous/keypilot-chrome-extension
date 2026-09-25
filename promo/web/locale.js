(function () {
    var STORAGE_KEY = "kp-lang";
    var PATHS = {
        de: "de/",
        es: "es/",
        es_419: "es_419/",
        ja: "ja/",
        sk: "sk/",
        zh_CN: "zh_CN/",
        zh_TW: "zh_TW/"
    };
    var LATAM = {
        "419": true,
        mx: true,
        ar: true,
        bo: true,
        cl: true,
        co: true,
        cr: true,
        cu: true,
        do: true,
        ec: true,
        gt: true,
        hn: true,
        ni: true,
        pa: true,
        pe: true,
        pr: true,
        py: true,
        sv: true,
        uy: true,
        ve: true
    };
    var pageLocale = document.documentElement.getAttribute("data-locale")
        || document.documentElement.lang
        || "en";

    function readLang() {
        try {
            return localStorage.getItem(STORAGE_KEY);
        } catch (err) {
            return null;
        }
    }

    function writeLang(lang) {
        try {
            localStorage.setItem(STORAGE_KEY, lang);
        } catch (err) {
            /* private mode */
        }
    }

    function detectLocale(tags) {
        for (var i = 0; i < tags.length; i++) {
            var parts = String(tags[i]).toLowerCase().replace(/_/g, "-").split("-");
            var lang = parts[0];
            var rest = parts.slice(1);
            if (lang === "de") {
                return "de";
            }
            if (lang === "sk") {
                return "sk";
            }
            if (lang === "ja") {
                return "ja";
            }
            if (lang === "es") {
                return LATAM[parts[1] || ""] ? "es_419" : "es";
            }
            if (lang === "zh") {
                for (var j = 0; j < rest.length; j++) {
                    var tag = rest[j];
                    if (tag === "tw" || tag === "hk" || tag === "mo" || tag === "hant") {
                        return "zh_TW";
                    }
                }
                return "zh_CN";
            }
        }
        return null;
    }

    document.addEventListener("click", function (event) {
        var link = event.target.closest && event.target.closest("[data-set-lang]");
        if (link) {
            writeLang(link.getAttribute("data-set-lang"));
        }
    }, true);

    if (pageLocale !== "en") {
        return;
    }

    var stored = readLang();
    if (stored === "en") {
        return;
    }

    var target = PATHS[stored] ? stored : null;
    if (!stored) {
        var tags = navigator.languages && navigator.languages.length
            ? navigator.languages
            : [navigator.language || "en"];
        target = detectLocale(tags);
    }

    if (target && PATHS[target]) {
        writeLang(target);
        location.replace(PATHS[target]);
    }
})();
