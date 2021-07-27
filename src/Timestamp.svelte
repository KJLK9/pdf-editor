<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { pannable } from "./utils/pannable.js";
  import { tapout } from "./utils/tapout.js";
  import { Fonts } from "./utils/prepareAssets.js";
  import {timestampToString} from "pdf-editor/src/utils/toBase64";
  export let size;
  export let uploadDate;
  export let lineHeight;
  export let x;
  export let y;
  export let fontFamily;
  let text = timestampToString(uploadDate);

  let asset_base = window.drupalSettings.asset_base;
  export let pageScale = 1;
  const Families = Object.keys(Fonts);
  const dispatch = createEventDispatcher();
  let startX;
  let startY;
  let editable;
  let _size = size;
  let _lineHeight = lineHeight;
  let _fontFamily = fontFamily;
  let dx = 0;
  let dy = 0;
  let operation = "";
  function handlePanMove(event) {
    dx = (event.detail.x - startX) / pageScale;
    dy = (event.detail.y - startY) / pageScale;
  }

  function handlePanEnd(event) {
    if (dx === 0 && dy === 0) {
      return editable.focus();
    }
    dispatch("update", {
      x: x + dx,
      y: y + dy
    });
    dx = 0;
    dy = 0;
    operation = "";
  }
  function handlePanStart(event) {
    startX = event.detail.x;
    startY = event.detail.y;
    operation = "move";
  }
  function onFocus() {
    operation = "edit";
  }
  async function onBlur() {
    if (operation !== "edit") return;
    editable.blur();
    dispatch("update", {
      width: editable.clientWidth
    });
    operation = "";
  }

  function render() {
    editable.focus();
  }

  function onDelete() {
    dispatch("delete");
  }
  onMount(render);
</script>

<style>
    .editing {
        @apply pointer-events-none border-gray-800 border-dashed;
    }
    .font-family {
        @apply block appearance-none h-6 w-full bg-white pl-2 pr-8 rounded-sm leading-tight;
    }
</style>

<svelte:options immutable={true} />
<div
        use:tapout
        on:tapout={onBlur}
        class="absolute left-0 top-0 select-none"
        style="transform: translate({x + dx}px, {y + dy}px);">
    <div
            use:pannable
            on:panstart={handlePanStart}
            on:panmove={handlePanMove}
            on:panend={handlePanEnd}
            class="absolute w-full h-full cursor-grab border border-dotted
    border-gray-500"
            class:cursor-grab={!operation}
            class:cursor-grabbing={operation === 'move'}
            class:editing={['edit'].includes(operation)} />
    <div
            on:click={onDelete}
            class="absolute right-0 left-100 top-0 w-12 h-12 m-auto rounded-full bg-white
    cursor-pointer transform -translate-y-1/2 -translate-x-1/2 md:scale-25">
        <img class="w-full h-full" src="{asset_base}/delete.svg" alt="delete object" />
    </div>
    <div
            bind:this={editable}
            on:focus={onFocus}
            class="outline-none whitespace-no-wrap"
            style="font-size: {_size}px; font-family: '{_fontFamily}', serif;
    line-height: {_lineHeight}; -webkit-user-select: text; padding: 0 2px;">
        {text}
    </div>
</div>
