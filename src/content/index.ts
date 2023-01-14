import { storage } from "../storage";

// Some global styles on the page
import "./styles.css";

// Some JS on the page
//storage.get().then(console.log);

// Some svelte component on the page
//new Overlay({ target: document.body });

let lastBodyScrollHeight = 0;
let isSameHeightTimes = 0;

const scrollDown = () => {
  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight);
    if (lastBodyScrollHeight !== document.body.scrollHeight) {
      lastBodyScrollHeight = document.body.scrollHeight;
      isSameHeightTimes = 0;
      scrollDown();
      return;
    }
    if (isSameHeightTimes < 3) {
      isSameHeightTimes++;
      scrollDown();
      return;
    }
    alert("Finish Scrapping");
  }, 2000);
};

scrollDown();
