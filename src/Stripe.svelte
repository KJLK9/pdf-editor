<script>
  import { onMount, createEventDispatcher } from "svelte";
  import { pannable } from "./utils/pannable.js";
  import { tapout } from "./utils/tapout.js";
  export let x;
  export let y;
  export let width;
  export let height;
  export let pageScale = 1;
  const dispatch = createEventDispatcher();
  let startX;
  let startY;
  let editable;
  let dx = 0;
  let dy = 0;
  let dw = 0;
  let dh= 0;
  let direction = "";
  let operation = "";
  let asset_base = window.drupalSettings.asset_base;
  let signature_access = window.drupalSettings.signature_access;

  function handlePanMove(event) {
    const _dx = (event.detail.x - startX) / pageScale;
    const _dy = (event.detail.y - startY) / pageScale;
    if (operation === "move") {
      dx = _dx;
      dy = _dy;
    } else if (operation === "resize") {
      if (direction === "left") {
        dx = _dx;
        dw = -_dx;
      }
      if (direction === "right") {
        dw = _dx;
      }

      if (direction === "top") {
        dy = _dy;
        dh = -_dy;
      }
      if (direction === "bottom") {
        dh = _dy;
      }
    }
  }

  function handlePanEnd(event) {
    if (operation === "move") {
      dispatch("update", {
        x: x + dx,
        y: y + dy,
      });
      dx = 0;
      dy = 0;
    } else if (operation === "resize") {
      dispatch("update", {
        x: x + dx,
        y: y + dy,
        width: width + dw,
        height: height + dh,
      });
      dx = 0;
      dy = 0;
      dw = 0;
      dh = 0;
      direction = "";
    }
    editable.blur();
    operation = "";
  }

  function handlePanStart(event) {
    if (!signature_access) {
      return;
    }
    startX = event.detail.x;
    startY = event.detail.y;
    if (event.detail.target === event.currentTarget) {
      return (operation = "move");
    }
    operation = "resize";
    direction = event.detail.target.dataset.direction;
  }

  function onFocus() {
    operation = "edit";
  }

  async function onBlur() {
    if (operation !== "edit") return;
    editable.blur();
    dispatch("update", {
      width: editable.clientWidth,
      height: editable.clientHeight
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
</style>

<svelte:options immutable={true} />
<div
        use:tapout
        on:tapout={onBlur}
        on:click={onFocus}
        class="absolute left-0 top-0 select-none stripe-obj"
        style="transform: translate({x + dx}px, {y + dy}px);background: black;border-radius: 3px;">
    <div
            use:pannable
            on:panstart={handlePanStart}
            on:panmove={handlePanMove}
            on:panend={handlePanEnd}
            class="absolute w-full h-full cursor-grab border border-dotted
    border-gray-500"
            class:cursor-grab={!operation && signature_access}
            class:cursor-grabbing={operation === 'move' && signature_access}
            style="text-align: center; line-height: {height + dh}px; color: rgba(0, 0, 0, .4)"
    >
        {#if signature_access}
            <div
                    data-direction="left"
                    class="absolute left-0 w-10 h-10 bg-green-400 rounded-full
      cursor-ew-resize transform -translate-x-1/2 -translate-y-1/2 md:scale-25"
                    style="top: 50%"/>
            <div
                    data-direction="right"
                    class="absolute right-0 w-10 h-10 bg-green-400 rounded-full
      cursor-ew-resize transform translate-x-1/2 translate-y-1/2 md:scale-25"
                    style="bottom: 50%" />
            <div
                    data-direction="top"
                    class="absolute top-0 w-10 h-10 bg-green-400 rounded-full
      cursor-ns-resize transform -translate-x-1/2 -translate-y-1/2 md:scale-25" style="left:50%;"/>
            <div
                    data-direction="bottom"
                    class="absolute right-0 bottom-0 w-10 h-10 bg-green-400 rounded-full
      cursor-ns-resize transform translate-x-1/2 translate-y-1/2 md:scale-25"
                    style="right: 50%"/>
            <div
                    on:click={onDelete}
                    class="absolute left-0 top-0 w-12 h-12 m-auto rounded-full bg-white
    cursor-pointer transform -translate-y-1/2 -translate-x-1/2 md:scale-25">
                <img class="w-full h-full" src="{asset_base}/delete.svg" alt="delete object" />
            </div>
        {/if}
    </div>
    <div
            bind:this={editable}
            on:focus={onFocus}
            class="outline-none whitespace-no-wrap"
            style="width: {width + dw}px; height: {height + dh}px;">
    </div>
</div>
