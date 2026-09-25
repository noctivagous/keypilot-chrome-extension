import { loadMessages } from "./chrome-stub.js";
import { DEFAULT_KEYBOARD_LAYOUT_ID, buildEffectiveKeybindings } from "../../../extension/src/config/keyboard-layouts.js";
import { buildKeyboardReferenceUiLayout } from "../../../extension/src/config/keyboard-hardware-layouts.js";
import { renderKeybindingsKeyboard } from "../../../extension/src/ui/keybindings-ui.js";
import { createTitlebarLeadingIcon, createTitlebarShortcut } from "../../../extension/src/ui/popover-titlebar.js";
import { createSelectMenu } from "../../../extension/src/ui/select-menu.js";
import { applyThemeCssVars, applyThemeDataset, getActiveTheme } from "../../../extension/src/modules/theme-manager.js";
import { getMessage } from "../../../extension/src/utils/i18n.js";

function paintPanelChrome(root) {
  const theme = getActiveTheme();
  applyThemeDataset(root, theme);
  applyThemeCssVars(root, theme);
  Object.assign(root.style, {
    position: "relative",
    display: "flex",
    width: "820px",
    maxWidth: "100%",
    flexDirection: "column",
    overflow: "hidden",
    boxSizing: "border-box",
    background: "var(--kp-panel-bg, var(--kp-color-panel, #232323))",
    color: "var(--kp-color-fg, #ddd)",
    border: "var(--kp-panel-border, 1px solid #111)",
    borderRadius: "var(--kp-radius-panel, 3px)",
    boxShadow: "var(--kp-panel-shadow)",
    fontFamily: "var(--kp-font-ui, Helvetica, Arial, sans-serif)"
  });
}

function paintTitlebar(header) {
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    height: "28px",
    minHeight: "28px",
    maxHeight: "28px",
    boxSizing: "border-box",
    padding: "0 6px 0 10px",
    margin: "0",
    borderBottom: "var(--kp-titlebar-border, 1px solid #111)",
    background: "var(--kp-titlebar-bg)",
    flex: "0 0 auto",
    userSelect: "none"
  });
}

function paintIconButton(button) {
  Object.assign(button.style, {
    width: "22px",
    height: "22px",
    minWidth: "22px",
    minHeight: "22px",
    borderRadius: "4px",
    border: "none",
    background: "transparent",
    color: "rgba(200, 200, 205, 0.9)",
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: "20px",
    padding: "0",
    margin: "0",
    flex: "0 0 auto",
    boxShadow: "var(--kp-icon-button-outline, inset 0 0 0 1px rgba(255,255,255,0.08))"
  });
}

function mountKeyboard(host) {
  const hardwareLayoutId = host.getAttribute("data-hardware") || "us-ansi-qwerty";
  const keybindings = buildEffectiveKeybindings(DEFAULT_KEYBOARD_LAYOUT_ID);
  const keyboardLayout = buildKeyboardReferenceUiLayout({
    hardwareLayoutId,
    keybindings
  });

  const root = document.createElement("div");
  root.className = "kp-floating-keyboard-help kp-chrome-window";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", getMessage("keyboard_help_aria_label") || "KeyPilot keyboard reference");
  paintPanelChrome(root);

  const header = document.createElement("div");
  header.setAttribute("data-kp-floating-keyboard-titlebar", "true");
  paintTitlebar(header);

  const title = document.createElement("div");
  title.setAttribute("data-kp-floating-keyboard-title", "true");
  title.textContent = getMessage("keyboard_help_title") || "Keyboard Reference";
  Object.assign(title.style, {
    fontSize: "11px",
    fontWeight: "var(--kp-titlebar-title-weight, 600)",
    letterSpacing: "0.02em",
    color: "var(--kp-color-fg, #ddd)",
    lineHeight: "28px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    margin: "0",
    minWidth: "0"
  });

  const shortcut = createTitlebarShortcut(document, "K");
  shortcut.title = getMessage("keyboard_help_toggle_title") || "";

  const layoutLabel = getMessage("layout_family_browsing_label") || "Browsing";
  const layoutSelect = createSelectMenu({
    ariaLabel: getMessage("keyboard_help_layout_aria") || layoutLabel,
    variant: "titlebar",
    value: "browsing",
    options: [{ value: "browsing", label: layoutLabel }]
  });
  layoutSelect.root.setAttribute("data-kp-floating-keyboard-layout-select", "true");
  layoutSelect.root.style.pointerEvents = "none";

  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.textContent = "▾";
  collapse.setAttribute("data-kp-floating-keyboard-collapse", "true");
  collapse.setAttribute("aria-label", getMessage("keyboard_help_collapse_aria") || "Collapse");
  paintIconButton(collapse);
  collapse.style.marginLeft = "auto";
  collapse.style.fontSize = "14px";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.textContent = "×";
  closeBtn.setAttribute("data-kp-floating-keyboard-close", "true");
  closeBtn.setAttribute("aria-label", getMessage("keyboard_help_close_aria") || "Close");
  paintIconButton(closeBtn);
  closeBtn.style.fontSize = "15px";
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
  });

  header.append(
    createTitlebarLeadingIcon(document, "keyboard"),
    title,
    shortcut,
    layoutSelect.root,
    collapse,
    closeBtn
  );

  const body = document.createElement("div");
  body.setAttribute("data-kp-floating-keyboard-body", "true");
  Object.assign(body.style, {
    padding: "0",
    margin: "0",
    flex: "1 1 auto",
    minHeight: "0",
    overflow: "auto"
  });

  const keyboard = document.createElement("div");
  keyboard.className = "kp-floating-keyboard-help__keyboard";
  body.appendChild(keyboard);
  root.append(header, body);
  host.replaceChildren(root);

  collapse.addEventListener("click", () => {
    const collapsed = body.style.display === "none";
    body.style.display = collapsed ? "" : "none";
    root.setAttribute("data-kp-collapsed", collapsed ? "false" : "true");
    collapse.textContent = collapsed ? "▾" : "▸";
    collapse.setAttribute(
      "aria-label",
      getMessage(collapsed ? "keyboard_help_collapse_aria" : "keyboard_help_expand_aria") || ""
    );
  });

  renderKeybindingsKeyboard({
    container: keyboard,
    keybindings,
    keyboardLayout,
    layoutId: DEFAULT_KEYBOARD_LAYOUT_ID,
    hardwareLayoutId,
    attachPopovers: true,
    pinOnClick: false
  });
}

async function start() {
  const host = document.querySelector("[data-kp-site-keyboard]");
  if (!host) return;
  try {
    await loadMessages();
  } catch (err) {
    console.warn("[KeyPilot site]", err);
  }
  mountKeyboard(host);
}

start();
