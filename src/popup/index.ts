import { mount } from "svelte";
import Popup from "src/components/Popup.svelte";

const target = document.getElementById("app")!;

function render() {
    mount(Popup, { target });
}

document.addEventListener("DOMContentLoaded", render);
