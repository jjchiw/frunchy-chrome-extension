<script lang="ts">
  export let count: number;
  let successMessage: string = null;
  let page = 0;
  let total = 0;

  //   chrome.runtime.onMessageExternal.addListener(function (
  //     request,
  //     sender,
  //     sendResponse
  //   ) {

  //   });

  chrome.storage.onChanged.addListener((changes) => {
    console.log("woohooohoho");
    console.log(changes);
    page = changes.page.newValue as number;
    total = changes.total.oldValue as number;
  });

  //   var port = chrome.runtime.connect();

  function increment() {
    count += 1;
  }

  function decrement() {
    count -= 1;
  }

  async function scrap() {
    console.log("scrap clicked");
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          message: "SCROLL_DOWN",
        },
        function (response) {
          console.log(response);
          // window.close();
        }
      );
    });
    // scrollDown();
    // const [tab] = await chrome.tabs.query({
    //   active: true,
    //   lastFocusedWindow: true,
    // });
    // console.log("tab", tab);
    // const response = await chrome.tabs.sendMessage(tab.id, {
    //   greeting: "hello",
    // });
    // do something with response here, not outside the function
    // chrome.runtime.sendMessage("SCROLL_DOWN");
    // console.log("frunchy try send message");
    // chrome.runtime.sendMessage("SCROLL_DOWN", function (response) {
    //   console.log(chrome.runtime.lastError);
    //   if (chrome.runtime.lastError) {
    //     setTimeout(scrap, 1000);
    //   } else {
    //     console.log("frunchy", response);
    //   }
    // });
    // console.log("post message");
    // window.postMessage(
    //   {
    //     type: "SCROLL_DOWN",
    //     url: this._url,
    //     responseText: this.responseText,
    //   },
    //   "*"
    // );
  }

  function save() {
    // storage.set({ count }).then(() => {
    //     successMessage = "Options saved!";
    //     setTimeout(() => {
    //         successMessage = null;
    //     }, 1500);
    // });
  }
</script>

<div class="container">
  <p>Send updates:</p>
  <p>Page:<b>{page}</b></p>
  <p>Total:<b>{total}</b></p>
  <div>
    <button on:click={decrement}>-</button>
    <button on:click={increment}>+</button>
    <button on:click={save}>Save</button>
    <button on:click={scrap}>Scrap</button>
    {#if successMessage}<span class="success">{successMessage}</span>{/if}
    {#if successMessage}<span class="success">{successMessage}</span>{/if}
  </div>
</div>

<style>
  .container {
    min-width: 250px;
  }

  button {
    border-radius: 2px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    background-color: #2ecc71;
    color: #ecf0f1;
    transition: background-color 0.3s;
    padding: 5px 10px;
    border: none;
  }

  button:hover,
  button:focus {
    background-color: #27ae60;
  }

  .success {
    color: #2ecc71;
    font-weight: bold;
  }
</style>
