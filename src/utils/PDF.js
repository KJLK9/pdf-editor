import { readAsArrayBuffer } from './asyncReader.js';
import { fetchFont, getAsset } from './prepareAssets';
import { noop } from './helper.js';
import {
  b64toBlob,
  bytesToBase64,
  imageToUint8Array,
  timestampToString
} from "./toBase64";

export async function save(pdfFile, objects, name, id, toDownload = false) {
  const isAdvisor = window.drupalSettings.signature_access;
  const PDFLib = await getAsset('PDFLib');
  const download = await getAsset('download');
  const makeTextPDF = await getAsset('makeTextPDF');
  let pdfDoc;
  try {
    pdfDoc = await PDFLib.PDFDocument.load(await readAsArrayBuffer(pdfFile));
  } catch (e) {
    console.log('Failed to load PDF.');
    throw e;
  }
  if (isAdvisor && toDownload) {
    const pagesProcesses = pdfDoc.getPages().map(async (page, pageIndex) => {
      const pageObjects = objects[pageIndex];
      // 'y' starts from bottom in PDFLib, use this to calculate y
      const pageHeight = page.getHeight();
      const embedProcesses = pageObjects.map(async (object) => {
        if (object.type === 'sign') {
          return () => {};
        }
        else if (object.type === 'stripe') {
          let scale = object.scale;

          let path = `M0 0 L0 ${object.height} L${object.width} ${object.height} L${object.width} 0 L0 0 Z`;
          let x = object.x;
          let y = object.y;

          const {
            pushGraphicsState,
            setLineCap,
            popGraphicsState,
            setLineJoin,
            LineCapStyle,
            LineJoinStyle,
            rgb,
          } = PDFLib;
          return () => {
            page.pushOperators(
                pushGraphicsState(),
                setLineCap(LineCapStyle.Round),
                setLineJoin(LineJoinStyle.Round),
            );
            page.drawSvgPath(path, {
              borderWidth: 0,
              scale: object.scale,
              x: object.x,
              y: pageHeight - object.y,
              color: rgb(0, 0, 0),
            });
            page.pushOperators(popGraphicsState());
          };
        }
        else if (object.type === 'image') {
          let { file, x, y, width, height } = object;
          let img;
          let imgType = object.image_type;
          // Base64 is PNG?
          if (typeof file === 'string') {
            imgType = 'image/png';
            file = b64toBlob(file, object.image_type);
          }
          try {
            if (imgType === 'image/jpeg' && false) {
              img = await pdfDoc.embedJpg(await readAsArrayBuffer(file));
            } else {
              img = await pdfDoc.embedPng(await readAsArrayBuffer(file));
            }
            return () =>
                page.drawImage(img, {
                  x,
                  y: pageHeight - y - height,
                  width,
                  height,
                });
          } catch (e) {
            console.log('Failed to embed image.', e);
            return noop;
          }
        } else if (object.type === 'timestamp' && object.uploadDate) {
          
          let text = timestampToString(object.uploadDate);
          const fontFamily = "Times-Roman";
          const height = object.size * object.lineHeight;
          const font = await fetchFont(fontFamily);
          const [textPage] = await pdfDoc.embedPdf(
              await makeTextPDF({
                lines: [text],
                fontSize: object.size,
                lineHeight: object.lineHeight,
                width: object.width,
                height: object.height,
                font: font.buffer || fontFamily, // built-in font family
                dy: font.correction(object.size, object.lineHeight),
              }),
          );
          return () => 
            page.drawPage(textPage, {
              width: object.width,
              height: object.height,
              x: object.x,
              y: pageHeight - object.y - object.height,
            });
        }  else if (object.type === 'text') {
          let { x, y, lines, lineHeight, size, fontFamily, width } = object;
          const height = size * lineHeight * lines.length;
          const font = await fetchFont(fontFamily);
          const [textPage] = await pdfDoc.embedPdf(
              await makeTextPDF({
                lines,
                fontSize: size,
                lineHeight,
                width,
                height,
                font: font.buffer || fontFamily, // built-in font family
                dy: font.correction(size, lineHeight),
              }),
          );
          return () =>
              page.drawPage(textPage, {
                width,
                height,
                x,
                y: pageHeight - y - height,
              });
        } else if (object.type === 'drawing') {
          let { x, y, path, scale } = object;
          const {
            pushGraphicsState,
            setLineCap,
            popGraphicsState,
            setLineJoin,
            LineCapStyle,
            LineJoinStyle,
          } = PDFLib;
          return () => {
            page.pushOperators(
                pushGraphicsState(),
                setLineCap(LineCapStyle.Round),
                setLineJoin(LineJoinStyle.Round),
            );
            page.drawSvgPath(path, {
              borderWidth: 5,
              scale,
              x,
              y: pageHeight - y,
            });
            page.pushOperators(popGraphicsState());
          };
        }
        else {
          return () => {};
        }
      });
      // embed objects in order
      const drawProcesses = await Promise.all(embedProcesses);
      drawProcesses.forEach((p) => p());
    });
    await Promise.all(pagesProcesses);
  }
  
  if (!toDownload) {
    for (let p = 0; p < objects.length; p++) {
      for (let o = 0; o < objects[p].length; o++) {
        if (objects[p][o].type == 'image') {
          let canvas = document.createElement("canvas");
          let scale = objects[p][o].pagesScale[p] ?? 1;
          canvas.width = objects[p][o].width / scale;
          canvas.height = objects[p][o].height / scale;
          let context = canvas.getContext("2d");
          let img = objects[p][o].payload;
          img.width = canvas.width;
          img.height = canvas.height;
          objects[p][o].file = bytesToBase64(await imageToUint8Array(img, context));
          
          canvas.remove();
        }
      }
    }
  }
  
  try {
    const pdfBytes = await pdfDoc.save();
    if (toDownload) {
      download(pdfBytes, name, 'application/pdf');
      return;
    }
    else {
      let base64 = bytesToBase64(pdfBytes);
      let all_object_input = document.querySelector('.all_pdf_objects[data-id="' + id + '"]');
      if (all_object_input) {
        all_object_input.value = JSON.stringify(objects);
      }
      let input = document.querySelector('.resp_file[data-id="' + id + '"]');
      if (isAdvisor && input) {
        input.value = base64;
      }
      const event = new CustomEvent('pdf_complete');
      input.dispatchEvent(event);
    }
  } catch (e) {
    console.log('Failed to save PDF.');
    throw e;
  }
}
