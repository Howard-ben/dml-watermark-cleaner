// Basic UI + mask drawing. Not production hardened but works for a local prototype.
const imgTab = document.getElementById('imgTab');
const vidTab = document.getElementById('vidTab');
const imagePanel = document.getElementById('imagePanel');
const videoPanel = document.getElementById('videoPanel');
const status = document.getElementById('status');

// Tabs
imgTab.onclick = () => { imgTab.classList.add('active'); vidTab.classList.remove('active'); imagePanel.classList.remove('hidden'); videoPanel.classList.add('hidden'); }
vidTab.onclick = () => { vidTab.classList.add('active'); imgTab.classList.remove('active'); videoPanel.classList.remove('hidden'); imagePanel.classList.add('hidden'); }

// Image editor
const imgFile = document.getElementById('imgFile');
const imgCanvas = document.getElementById('imgCanvas');
const clearMaskBtn = document.getElementById('clearMaskBtn');
const downloadMaskBtn = document.getElementById('downloadMaskBtn');
const cleanImageBtn = document.getElementById('cleanImageBtn');

let imgCtx, maskCanvas, maskCtx, baseImage = null;
function setupImageCanvas(w, h){
  imgCanvas.width = w;
  imgCanvas.height = h;
  maskCanvas = document.createElement('canvas');
  maskCanvas.width = w; maskCanvas.height = h;
  maskCtx = maskCanvas.getContext('2d');
  maskCtx.fillStyle = 'black'; maskCtx.fillRect(0,0,w,h);
  imgCtx = imgCanvas.getContext('2d');
  imgCtx.clearRect(0,0,w,h);
}
imgFile.onchange = () => {
  const f = imgFile.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      baseImage = img;
      setupImageCanvas(img.width, img.height);
      imgCtx.drawImage(img,0,0);
      // draw mask overlay on top (semi-transparent red)
      drawMaskOverlay();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(f);
};

// Drawing
let drawing=false;
imgCanvas.addEventListener('mousedown', e => { drawing=true; drawAt(e); });
imgCanvas.addEventListener('mousemove', e => { if(drawing) drawAt(e); });
window.addEventListener('mouseup', () => { drawing=false; });

function drawAt(e){
  const rect = imgCanvas.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (imgCanvas.width / rect.width));
  const y = Math.round((e.clientY - rect.top) * (imgCanvas.height / rect.height));
  maskCtx.fillStyle = 'white';
  maskCtx.beginPath();
  maskCtx.arc(x,y,30,0,Math.PI*2);
  maskCtx.fill();
  drawMaskOverlay();
}
function drawMaskOverlay(){
  if(!baseImage) return;
  imgCtx.clearRect(0,0,imgCanvas.width,imgCanvas.height);
  imgCtx.drawImage(baseImage,0,0);
  // overlay semi-transparent red for mask
  const maskData = maskCtx.getImageData(0,0,maskCanvas.width,maskCanvas.height);
  const temp = document.createElement('canvas');
  temp.width = maskCanvas.width; temp.height = maskCanvas.height;
  const tctx = temp.getContext('2d');
  tctx.putImageData(maskData,0,0);
  imgCtx.globalAlpha = 0.45;
  imgCtx.fillStyle = 'red';
  imgCtx.drawImage(temp,0,0);
  imgCtx.globalAlpha = 1.0;
}

clearMaskBtn.onclick = () => {
  if(!maskCtx) return;
  maskCtx.fillStyle = 'black'; maskCtx.fillRect(0,0,maskCanvas.width,maskCanvas.height);
  drawMaskOverlay();
};

downloadMaskBtn.onclick = () => {
  if(!maskCanvas) return;
  const link = document.createElement('a');
  link.href = maskCanvas.toDataURL('image/png');
  link.download = 'mask.png';
  link.click();
};

cleanImageBtn.onclick = async () => {
  if(!baseImage || !maskCanvas) return alert('Load an image and draw a mask first.');
  status.textContent = 'Uploading and processing image...';
  const blob = await new Promise(res => imgCanvas.toBlob(res, 'image/png'));
  const maskBlob = await new Promise(res => maskCanvas.toBlob(res, 'image/png'));
  const fd = new FormData();
  // replace: use original file name if available
  fd.append('file', imgFile.files[0]);
  fd.append('mask', maskBlob, 'mask.png');
  try {
    const r = await fetch('/process-image', { method:'POST', body: fd });
    if(!r.ok){ const err = await r.json(); status.textContent = 'Error: ' + (err.error || r.statusText); return; }
    const blobOut = await r.blob();
    const url = URL.createObjectURL(blobOut);
    const link = document.createElement('a');
    link.href = url; link.download = 'cleaned_image.png'; link.click();
    status.textContent = 'Image processed — download should begin.';
  } catch(err){
    status.textContent = 'Error: ' + err.message;
  }
};

// Video editor
const vidFile = document.getElementById('vidFile');
const vidPreview = document.getElementById('vidPreview');
const vidCanvas = document.getElementById('vidCanvas');
const captureFrameBtn = document.getElementById('captureFrameBtn');
const clearVidMaskBtn = document.getElementById('clearVidMaskBtn');
const cleanVideoBtn = document.getElementById('cleanVideoBtn');

let vidCtx, vidMaskCanvas, vidMaskCtx, capturedImage = null;
function setupVidCanvas(w,h){
  vidCanvas.width = w; vidCanvas.height = h;
  vidMaskCanvas = document.createElement('canvas');
  vidMaskCanvas.width = w; vidMaskCanvas.height = h;
  vidMaskCtx = vidMaskCanvas.getContext('2d');
  vidMaskCtx.fillStyle = 'black'; vidMaskCtx.fillRect(0,0,w,h);
  vidCtx = vidCanvas.getContext('2d');
  vidCtx.clearRect(0,0,w,h);
}

vidFile.onchange = () => {
  const f = vidFile.files[0];
  if(!f) return;
  const url = URL.createObjectURL(f);
  vidPreview.src = url;
  vidPreview.load();
};

captureFrameBtn.onclick = () => {
  if(!vidPreview || vidPreview.readyState < 2) return alert('Load video and play/pause at desired frame.');
  const w = vidPreview.videoWidth, h = vidPreview.videoHeight;
  setupVidCanvas(w,h);
  vidCtx.drawImage(vidPreview, 0, 0, w, h);
  capturedImage = new Image();
  capturedImage.src = vidCanvas.toDataURL('image/png');
  drawVidMaskOverlay();
};

// drawing for video mask
vidCanvas.addEventListener('mousedown', e => { if(!vidMaskCtx) return; drawing=true; drawVidAt(e); });
vidCanvas.addEventListener('mousemove', e => { if(drawing) drawVidAt(e); });
function drawVidAt(e){
  const rect = vidCanvas.getBoundingClientRect();
  const x = Math.round((e.clientX - rect.left) * (vidCanvas.width / rect.width));
  const y = Math.round((e.clientY - rect.top) * (vidCanvas.height / rect.height));
  vidMaskCtx.fillStyle = 'white';
  vidMaskCtx.beginPath();
  vidMaskCtx.arc(x,y,30,0,Math.PI*2);
  vidMaskCtx.fill();
  drawVidMaskOverlay();
}
function drawVidMaskOverlay(){
  if(!capturedImage) return;
  vidCtx.clearRect(0,0,vidCanvas.width,vidCanvas.height);
  vidCtx.drawImage(capturedImage,0,0);
  const temp = document.createElement('canvas');
  temp.width = vidMaskCanvas.width; temp.height = vidMaskCanvas.height;
  temp.getContext('2d').putImageData(vidMaskCtx.getImageData(0,0,vidMaskCanvas.width,vidMaskCanvas.height),0,0);
  vidCtx.globalAlpha = 0.45;
  vidCtx.drawImage(temp,0,0);
  vidCtx.globalAlpha = 1.0;
}

clearVidMaskBtn.onclick = () => {
  if(!vidMaskCtx) return;
  vidMaskCtx.fillStyle = 'black'; vidMaskCtx.fillRect(0,0,vidMaskCanvas.width,vidMaskCanvas.height);
  drawVidMaskOverlay();
};

cleanVideoBtn.onclick = async () => {
  if(!vidFile.files[0] || !vidMaskCanvas) return alert('Load a video and capture a frame + draw mask first.');
  status.textContent = 'Uploading video and starting processing (this can take time)...';
  const fd = new FormData();
  fd.append('file', vidFile.files[0]);
  const maskBlob = await new Promise(res => vidMaskCanvas.toBlob(res, 'image/png'));
  fd.append('mask', maskBlob, 'mask.png');
  try {
    const r = await fetch('/process-video', { method:'POST', body: fd });
    if(!r.ok){ const err = await r.json(); status.textContent = 'Error: ' + (err.error || r.statusText); return; }
    const blobOut = await r.blob();
    const url = URL.createObjectURL(blobOut);
    const link = document.createElement('a');
    link.href = url; link.download = 'cleaned_video.mp4'; link.click();
    status.textContent = 'Video processed — download should begin.';
  } catch(err){
    status.textContent = 'Error: ' + err.message;
  }
};
