import { mount } from "svelte";
import Settings from "src/components/Settings.svelte";

const target = document.getElementById("app")!;

function render() {
    mount(Settings, { target });
}

document.addEventListener("DOMContentLoaded", render);
