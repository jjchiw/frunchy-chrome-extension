import { mount } from "svelte";
import Options from "src/components/Options.svelte";

const target = document.getElementById("app")!;

function render() {
    mount(Options, { target });
}

document.addEventListener("DOMContentLoaded", render);
