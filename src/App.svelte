<script>
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import Tailwind from "./Tailwind.svelte";
  import PDFPage from "./PDFPage.svelte";
  import Image from "./Image.svelte";
  import Text from "./Text.svelte";
  import Timestamp from "./Timestamp.svelte";
  import Stripe from "./Stripe.svelte";
  import Drawing from "./Drawing.svelte";
  import DrawingCanvas from "./DrawingCanvas.svelte";
  import Sign from "./Sign.svelte";
  import prepareAssets, { fetchFont } from "./utils/prepareAssets.js";
  import {
    readAsArrayBuffer,
    readAsImage,
    readAsPDF,
    readAsDataURL
  } from "./utils/asyncReader.js";
  import { ggID } from "./utils/helper.js";
  import { save } from "./utils/PDF.js";
  import {imageToUint8Array, bytesToBase64, b64toBlob} from "pdf-editor/src/utils/toBase64";

  let genID = ggID();
  export let pdfFile;
  let asset_base = window.drupalSettings.asset_base;
  let signature_access = window.drupalSettings.signature_access;
  let pdfName = "";
  let pages = [];
  let pagesScale = [];
  export let allObjects = [];
  let currentFont = "Times-Roman";
  let focusId = null;
  let selectedPageIndex = -1;
  let saving = false;
  let addingDrawing = false;
  let nextDrawingPos = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    parent: null,
  };
  export let id;
  let all_object_input = document.querySelector('.all_pdf_objects[data-id="' + id + '"]');
  export let fileUrl;
  export let existingObjects;
  export let uploadDate;

  onMount(async () => {
    try {
      if (!fileUrl) {
        return;
      }
      const res = await fetch(fileUrl);
      const pdfBlob = await res.blob();

      if (existingObjects && existingObjects.length) {
        let currentObjects = existingObjects;
        allObjects = currentObjects;

        for (let p = 0; p < currentObjects.length; p++) {
          for (let o = 0; o < currentObjects[p].length; o++) {
            if (currentObjects[p][o].type == 'image') {

              let base64 = currentObjects[p][o].file;
              const contentType = currentObjects[p][o].image_type;
              let imgUrl = 'data:' + contentType + ';base64, ' + base64;

              currentObjects[p][o].payload = await readAsImage(imgUrl);
              currentObjects[p][o].file = b64toBlob(base64, contentType);

              updateObject(currentObjects[p][o].id, {
                file: b64toBlob(base64, contentType),
                payload: await readAsImage(imgUrl),
              });
            }
          }
        }

        // Get highest ID.
        let highest = 0;
        for (let p = 0; p < allObjects.length; p++) {
         for (let i = 0; i < allObjects[p].length; i++) {
           let _id = allObjects[p][i].id;
           if (allObjects[p][i].type === 'text') {
             allObjects[p][i].text = allObjects[p][i].lines.join("\n");
             updateObject(_id, {
               text: allObjects[p][i].lines.join("\n"),
             });
           }
           if (_id && _id > highest) {
             highest = _id;
           }
         }
        }

        // Make sure genId generates non-existing ids.
        for (let x = 0; x < highest + 1; x++) {
          genID();
        }
      }


      await addPDF(pdfBlob);
      selectedPageIndex = 0;

      fetchFont(currentFont);
      prepareAssets();

    } catch (e) {
      console.log(e);
    }
  });
  async function onUploadPDF(e) {
    const files = e.target.files || (e.dataTransfer && e.dataTransfer.files);
    const file = files[0];
    if (!file || file.type !== "application/pdf") return;
    selectedPageIndex = -1;
    try {
      await addPDF(file);
      selectedPageIndex = 0;
    } catch (e) {
      console.log(e);
    }
  }
  async function addPDF(file) {
    try {
      const pdf = await readAsPDF(file);
      pdfName = file.name;
      pdfFile = file;
      const numPages = pdf.numPages;
      pages = Array(numPages)
        .fill()
        .map((_, i) => pdf.getPage(i + 1));
      for (let i = 0; i < numPages; i++) {
        if (typeof allObjects[i] === "undefined") {
          allObjects[i] = [];
        }
      }
      pagesScale = Array(numPages).fill(1);
    } catch (e) {
      console.log("Failed to add pdf.");
      throw e;
    }
  }
  async function onUploadImage(e) {
    const file = e.target.files[0];
    if (file && selectedPageIndex >= 0) {
      addImage(file);
    }
    e.target.value = null;
  }
  async function addImage(file) {
    try {
      // get dataURL to prevent canvas from tainted
      const url = await readAsDataURL(file);

      const img = await readAsImage(url);
      const id = genID();
      const { width, height } = img;
      const object = {
        id,
        type: "image",
        image_type: file.type,
        width,
        height,
        x: 0,
        y: 0,
        payload: img,
        file
      };

      allObjects = allObjects.map((objects, pIndex) =>
        pIndex === selectedPageIndex ? [...objects, object] : objects
      );
      updateInputValue();
    } catch (e) {
      console.log(`Fail to add image.`, e);
    }
  }

  function onAddSignField() {
    if (selectedPageIndex >= 0) {
      addSignField();
    }
  }

  function onAddStripeField() {
    if (selectedPageIndex >= 0) {
      addStripeField();
    }
  }

  function addStripeField(width = 100, height = 10, x = 0, y = 0) {
    const id = genID();
    const object = {
      id,
      type: "stripe",
      width: width,
      height: height,
      x: x,
      y: y
    };
    allObjects = allObjects.map((objects, pIndex) =>
            pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    updateInputValue();
  }

  function addSignField(width = 100, height = 75, x = 0, y = 0) {
    const id = genID();
    const object = {
      id,
      type: "sign",
      width: width,
      height: height,
      x: x,
      y: y
    };

    allObjects = allObjects.map((objects, pIndex) =>
            pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    updateInputValue();
  }


  function onAddTextField() {
    if (selectedPageIndex >= 0) {
      addTextField();
    }
  }
  function addTextField(text = "New Text Field") {
    const id = genID();
    fetchFont(currentFont);
    const object = {
      id,
      text,
      type: "text",
      size: 16,
      width: 0, // recalculate after editing
      lineHeight: 1.4,
      fontFamily: currentFont,
      x: 0,
      y: 0
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    updateInputValue();
  }
  function onAddTimestamp() {
    if (selectedPageIndex >= 0) {
      addTimestamp();
    }
  }
  function addTimestamp() {
    const id = genID();
    const object = {
      id,
      type: "timestamp",
      width: 120,
      height: 20,
      x: 0,
      y: 0,
      size: 8,
      lineHeight: 1,
      fontFamily: "Times-Roman",
      uploadDate: uploadDate,
    };
    allObjects = allObjects.map((objects, pIndex) =>
            pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    updateInputValue();
  }
  function onAddDrawing() {
    if (selectedPageIndex >= 0) {
      addingDrawing = true;
    }
  }
  function addDrawing(originWidth, originHeight, path, scale = 1) {
    const id = genID();
    // Scale drawing and set it to the middle.
    if (nextDrawingPos.width > 0) {
      scale = nextDrawingPos.width / originWidth;
      let newHeight = originHeight * scale;
      if (newHeight > nextDrawingPos.height) {
        scale = nextDrawingPos.height / originHeight;
        let newWidth = originWidth * scale;
        nextDrawingPos.x += ((nextDrawingPos.width - newWidth) / 2);
      }
      else {
        nextDrawingPos.y += ((nextDrawingPos.height - newHeight) / 2);
      }
    }
    const object = {
      id,
      path,
      type: "drawing",
      x: nextDrawingPos.x,
      y: nextDrawingPos.y,
      originWidth,
      originHeight,
      width: originWidth * scale,
      scale,
      parent: nextDrawingPos.parent,
    };
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex === selectedPageIndex ? [...objects, object] : objects
    );
    updateInputValue();

    nextDrawingPos.x = 0;
    nextDrawingPos.y = 0;
    nextDrawingPos.width = 0;
    nextDrawingPos.height = 0;
    nextDrawingPos.parent = null;
  }
  function selectFontFamily(event) {
    const name = event.detail.name;
    fetchFont(name);
    currentFont = name;
  }
  function selectPage(index) {
    selectedPageIndex = index;
  }

  function updateObject(objectId, payload) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.map(object =>
            object.id === objectId ? { ...object, ...payload } : object
          )
        : objects
    );
    updateInputValue();
  }

  function updateInputValue() {
    if (all_object_input) {
      reformatImages().then(res => {
        all_object_input.value = JSON.stringify(res);
      });
    }
  }

  async function reformatImages() {
    let objects = allObjects;
    for (let p = 0; p < objects.length; p++) {
      for (let o = 0; o < objects[p].length; o++) {
        if (objects[p][o].type == 'image') {
          let canvas = document.createElement("canvas");
          canvas.width = objects[p][o].width;
          canvas.height = objects[p][o].height;
          let context = canvas.getContext("2d");
          let img = objects[p][o].payload;
          img.width = canvas.width;
          img.height = canvas.height;
          objects[p][o].file = bytesToBase64(await imageToUint8Array(img, context));

          canvas.remove();
        }
      }
    }

    return objects;
  }

  function deleteObject(objectId) {
    allObjects = allObjects.map((objects, pIndex) =>
      pIndex == selectedPageIndex
        ? objects.filter(object => object.id !== objectId)
        : objects
    );
    updateInputValue();
  }
  function createDrawingFromSignature(objectId) {
    let object = null;
    if (allObjects.length > 0) {
      for (let pid = 0; pid < allObjects.length; pid++) {
        let obj = allObjects[pid];
        if (obj.length > 0) {
          for (let delta = 0; delta < obj.length; delta++) {
            if (obj[delta].id == objectId) {
              object = obj[delta];
              break;
            }
          }
          if (object) {
            break;
          }
        }
      }
    }

    if (object) {
      nextDrawingPos.x = object.x;
      nextDrawingPos.y = object.y;
      nextDrawingPos.width = object.width;
      nextDrawingPos.height = object.height;
      nextDrawingPos.parent = objectId;
      onAddDrawing();
    }
  }
  function onMeasure(scale, i) {
    scale = scale == 0 ?  1 : scale;
    pagesScale[i] = scale ?? 1;
  }


  // FIXME: Should wait all objects finish their async work
  export async function savePDF() {
    if (!pdfFile || saving || !pages.length) return;
    saving = true;
    try {
      await save(pdfFile, allObjects, pdfName, id, false);
    } catch (e) {
      console.log(e);
    } finally {
      saving = false;
    }
  }
  async function download() {
    if (!pdfFile || saving || !pages.length) return;
    saving = true;
    try {
      await save(pdfFile, allObjects, pdfName, id, true);
    } catch (e) {
      console.log(e);
    } finally {
      saving = false;
    }
  }
</script>

<svelte:window
  on:dragenter|preventDefault
  on:dragover|preventDefault
  on:drop|preventDefault={onUploadPDF} />
<Tailwind />
<main class="flex flex-col items-center py-16 bg-gray-100 min-h-screen pdf_editor_main">
  <div
    class="fixed z-10 top-0 left-0 right-0 h-12 flex justify-center items-center
    bg-gray-200 border-b border-gray-300 pdf_editor_header">
    <input
      type="file"
      name="pdf"
      id="pdf"
      on:change={onUploadPDF}
      class="hidden" />
    <input
      type="file"
      id="image"
      name="image"
      class="hidden"
      on:change={onUploadImage} />
    <label
      class="whitespace-no-wrap bg-blue-500 hover:bg-blue-700 text-white
      font-bold py-1 px-3 md:px-4 rounded mr-3 cursor-pointer md:mr-4 hidden"
      for="pdf">
      Choose PDF
    </label>
    <div
      class="relative mr-3 flex h-8 bg-gray-400 rounded-sm overflow-hidden
      md:mr-4">
      {#if signature_access}
        <label
                class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer" for="stripe"
                class:cursor-not-allowed={selectedPageIndex < 0}
                class:bg-gray-500={selectedPageIndex < 0}
                on:click={onAddStripeField}>
          <img src="{asset_base}stripe.svg" alt="An icon for adding stripes" id="stripe" />
        </label>
        <label
                class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer"
                for="image"
                class:cursor-not-allowed={selectedPageIndex < 0}
                class:bg-gray-500={selectedPageIndex < 0}>
          <img src="{asset_base}image.svg" alt="An icon for adding images" />
        </label>
        <label
                class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer" for="signature"
                class:cursor-not-allowed={selectedPageIndex < 0}
                class:bg-gray-500={selectedPageIndex < 0}
                on:click={onAddSignField}>
          <img src="{asset_base}sign.svg" alt="An icon for adding signatures" id="signature" />
        </label>
        <label
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer"
          for="text"
          class:cursor-not-allowed={selectedPageIndex < 0}
          class:bg-gray-500={selectedPageIndex < 0}
          on:click={onAddTextField}>
          <img src="{asset_base}notes.svg" alt="An icon for adding text" id="text" />
        </label>
        <label
          class="flex items-center justify-center h-full w-8 hover:bg-gray-500
          cursor-pointer" for="drawing"
          on:click={onAddDrawing}
          class:cursor-not-allowed={selectedPageIndex < 0}
          class:bg-gray-500={selectedPageIndex < 0}>
          <img src="{asset_base}gesture.svg" alt="An icon for adding drawing" id="drawing" />
        </label>
        {#if uploadDate && uploadDate.length }
          <label
            class="flex items-center justify-center h-full w-8 hover:bg-gray-500
            cursor-pointer" for="timestamp"
            on:click={onAddTimestamp}
            class:cursor-not-allowed={selectedPageIndex < 0}
            class:bg-gray-500={selectedPageIndex < 0}>
            <img src="{asset_base}timestamp.svg" alt="An icon for adding timestamp" id="timestamp" />
          </label>
        {/if}
      {/if}
    </div>
    <button
      on:click={savePDF}
      class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
      md:px-4 mr-3 md:mr-4 rounded save-pdf-real hidden"
      class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
      class:bg-blue-700={pages.length === 0 || saving || !pdfFile}>
      {saving ? 'Saving' : 'Save'}
    </button>
    {#if signature_access}
      <button
        on:click={download}
        class="w-20 bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3
        md:px-4 mr-3 md:mr-4 download-pdf-real rounded"
        class:cursor-not-allowed={pages.length === 0 || saving || !pdfFile}
        class:bg-blue-700={pages.length === 0 || saving || !pdfFile}>
        {saving ? 'Downloading' : 'Download'}
      </button>
    {/if}
  </div>
  {#if addingDrawing}
    <div
      transition:fly={{ y: -200, duration: 500 }}
      class="fixed z-10 top-0 left-0 right-0 border-b border-gray-300 bg-white
      shadow-lg"
      style="height: 50%;">
      <DrawingCanvas
        on:finish={e => {
          const { originWidth, originHeight, path } = e.detail;
          let scale = 1;
          if (originWidth > 500) {
            scale = 500 / originWidth;
          }
          addDrawing(originWidth, originHeight, path, scale);
          addingDrawing = false;
        }}
        on:cancel={() => (addingDrawing = false)} />
    </div>
  {/if}
  {#if pages.length}
    <div class="w-full">
      {#each pages as page, pIndex (page)}
        <div
          class="p-5 w-full flex flex-col items-center overflow-hidden"
          on:mousedown={() => selectPage(pIndex)}
          on:touchstart={() => selectPage(pIndex)}>
          <div
            class="relative shadow-lg"
            class:shadow-outline={pIndex === selectedPageIndex}>
            <PDFPage
              on:measure={e => onMeasure(e.detail.scale, pIndex)}
              {page} />
            <div
              class="absolute top-0 left-0 transform origin-top-left"
              style="transform: scale({pagesScale[pIndex]}); touch-action: none;">
              {#each allObjects[pIndex] as object (object.id)}
                {#if object.type === 'image'}
                  <Image
                    on:update={e => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    file={object.file}
                    payload={object.payload}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    height={object.height}
                    pageScale={pagesScale[pIndex]??1} />
                {:else if object.type === 'text'}
                  <Text
                    on:update={e => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    on:selectFont={selectFontFamily}
                    text={object.text}
                    x={object.x}
                    y={object.y}
                    size={object.size}
                    lineHeight={object.lineHeight}
                    fontFamily={object.fontFamily}
                    pageScale={pagesScale[pIndex]??1} />
                {:else if object.type === 'drawing'}
                  <Drawing
                    on:update={e => updateObject(object.id, e.detail)}
                    on:delete={() => deleteObject(object.id)}
                    path={object.path}
                    x={object.x}
                    y={object.y}
                    width={object.width}
                    originWidth={object.originWidth}
                    originHeight={object.originHeight}
                    pageScale={pagesScale[pIndex]??1}
                    parent="{object.parent}"/>
                {:else if object.type === 'sign'}
                  <Sign
                          on:update={e => updateObject(object.id, e.detail)}
                          on:delete={() => deleteObject(object.id)}
                          on:create={() => createDrawingFromSignature(object.id)}
                          x={object.x}
                          y={object.y}
                          height={object.height}
                          width={object.width}
                          pageScale={pagesScale[pIndex]??1} />
                {:else if object.type === 'stripe'}
                  <Stripe
                          on:update={e => updateObject(object.id, e.detail)}
                          on:delete={() => deleteObject(object.id)}
                          x={object.x}
                          y={object.y}
                          height={object.height}
                          width={object.width}
                          pageScale={pagesScale[pIndex]??1} />
                {:else if object.type === 'timestamp'}
                  <Timestamp
                          on:update={e => updateObject(object.id, e.detail)}
                          on:delete={() => deleteObject(object.id)}
                          x={object.x}
                          y={object.y}
                          height={object.height}
                          width={object.width}
                          pageScale={pagesScale[pIndex]??1}
                          uploadDate="{uploadDate}"/>
                {/if}
              {/each}

            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</main>
