import { mount } from "svelte";
import "src/styles/base.css";
import Popup from "src/components/Popup.svelte";

document.documentElement.lang = chrome.i18n.getUILanguage();
const target = document.getElementById("app")!;

function render() {
    mount(Popup, { target });
}

document.addEventListener("DOMContentLoaded", render);
