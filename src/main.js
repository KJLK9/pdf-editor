import App from './App.svelte';
import { getAsset } from './utils/prepareAssets.js';

getAsset('pdfjsLib');
const app = new App({
  target: document.getElementById('pdf_editor'),
});

export default app;
