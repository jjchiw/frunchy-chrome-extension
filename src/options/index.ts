import { mount } from "svelte";
import "src/styles/base.css";
import Settings from "src/components/Settings.svelte";

document.documentElement.lang = chrome.i18n.getUILanguage();
const target = document.getElementById("app")!;

function render() {
    mount(Settings, { target });
}

document.addEventListener("DOMContentLoaded", render);
