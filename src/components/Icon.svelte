<script lang="ts" module>
  // Material Symbols (outlined, weight 400), bundled so the popup loads nothing remote.
  import bolt from "@material-symbols/svg-400/outlined/bolt.svg?raw";
  import check_circle from "@material-symbols/svg-400/outlined/check_circle.svg?raw";
  import cloud_done from "@material-symbols/svg-400/outlined/cloud_done.svg?raw";
  import cloud_off from "@material-symbols/svg-400/outlined/cloud_off.svg?raw";
  import cloud_upload from "@material-symbols/svg-400/outlined/cloud_upload.svg?raw";
  import del from "@material-symbols/svg-400/outlined/delete.svg?raw";
  import download from "@material-symbols/svg-400/outlined/download.svg?raw";
  import download_done from "@material-symbols/svg-400/outlined/download_done.svg?raw";
  import error from "@material-symbols/svg-400/outlined/error.svg?raw";
  import history from "@material-symbols/svg-400/outlined/history.svg?raw";
  import open_in_new from "@material-symbols/svg-400/outlined/open_in_new.svg?raw";
  import refresh from "@material-symbols/svg-400/outlined/refresh.svg?raw";
  import schedule from "@material-symbols/svg-400/outlined/schedule.svg?raw";
  import stop from "@material-symbols/svg-400/outlined/stop.svg?raw";
  import sync from "@material-symbols/svg-400/outlined/sync.svg?raw";
  import tune from "@material-symbols/svg-400/outlined/tune.svg?raw";
  import visibility from "@material-symbols/svg-400/outlined/visibility.svg?raw";
  import visibility_off from "@material-symbols/svg-400/outlined/visibility_off.svg?raw";

  const sources = {
    bolt,
    check_circle,
    cloud_done,
    cloud_off,
    cloud_upload,
    delete: del,
    download,
    download_done,
    error,
    history,
    open_in_new,
    refresh,
    schedule,
    stop,
    sync,
    tune,
    visibility,
    visibility_off,
  };

  export type IconName = keyof typeof sources;

  // Keep only the path data; the wrapper below sets size and colour.
  const paths = Object.fromEntries(
    Object.entries(sources).map(([name, svg]) => [name, svg.replace(/^<svg[^>]*>|<\/svg>$/g, "")])
  ) as Record<IconName, string>;
</script>

<script lang="ts">
  let { name, size = 20 }: { name: IconName; size?: number } = $props();
</script>

<svg
  class="icon"
  width={size}
  height={size}
  viewBox="0 -960 960 960"
  fill="currentColor"
  aria-hidden="true"
  focusable="false"
>
  {@html paths[name]}
</svg>

<style>
  .icon {
    flex: none;
  }
</style>
