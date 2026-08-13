document.addEventListener('DOMContentLoaded', function() {
  const API_BASE = 'http://localhost:3001/api';

  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const imagePreview = document.getElementById('imagePreview');
  const videoPreview = document.getElementById('videoPreview');
  const uploadButton = document.getElementById('uploadButton');
  const videoButton = document.getElementById('videoButton');
  const cameraButton = document.getElementById('cameraButton');
  const recognizeButton = document.getElementById('recognizeButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const noResult = document.getElementById('noResult');
  const herbInfo = document.getElementById('herbInfo');
  const relatedHerbs = document.getElementById('relatedHerbs');
  const viewKnowledgeButton = document.getElementById('viewKnowledgeButton');
  const videoResults = document.getElementById('videoResults');
  const videoResultList = document.getElementById('videoResultList');
  const processingText = document.getElementById('processingText');

  const cameraModal = document.getElementById('cameraModal');
  const cameraPreview = document.getElementById('cameraPreview');
  const closeCameraModal = document.getElementById('closeCameraModal');
  const captureCameraButton = document.getElementById('captureCameraButton');
  const confirmCaptureButton = document.getElementById('confirmCaptureButton');
  const captureCanvas = document.getElementById('captureCanvas');
  const realtimeRecognitionButton = document.getElementById('realtimeRecognitionButton');
  const stopRealtimeRecognitionButton = document.getElementById('stopRealtimeRecognitionButton');
  const realtimeResultsOverlay = document.getElementById('realtimeResultsOverlay');

  const herbNameText = document.getElementById('herbNameText');
  const confidenceValue = document.getElementById('confidenceValue');
  const herbTypeValue = document.getElementById('herbCategoryValue');
  const herbRegionValue = document.getElementById('herbRegionValue');
  const herbPropertyValue = document.getElementById('herbPropertyValue');
  const herbMeridianValue = document.getElementById('herbMeridianValue');
  const herbDescriptionValue = document.getElementById('herbDescriptionValue');
  const herbResultImage = document.getElementById('herbResultImage');
  const confidenceFill = document.getElementById('confidenceFill');
  const relatedList = document.getElementById('relatedList');

  let selectedFile = null;
  let mediaStream = null;
  let recognizedHerb = null;

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', function(event) {
    event.preventDefault();
    this.classList.add('upload-area-active');
  });
  uploadArea.addEventListener('dragleave', function() {
    this.classList.remove('upload-area-active');
  });
  uploadArea.addEventListener('drop', function(event) {
    event.preventDefault();
    this.classList.remove('upload-area-active');
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) handleFile(this.files[0]);
  });
  uploadButton.addEventListener('click', function() {
    fileInput.accept = 'image/*,video/*';
    fileInput.click();
  });
  videoButton.addEventListener('click', function() {
    fileInput.accept = 'video/*';
    fileInput.click();
  });
  cameraButton.addEventListener('click', openCameraModal);
  recognizeButton.addEventListener('click', startRecognition);
  closeCameraModal.addEventListener('click', closeCameraAndModal);
  captureCameraButton.addEventListener('click', captureImage);
  confirmCaptureButton.addEventListener('click', useCapturedImage);
  realtimeRecognitionButton.addEventListener('click', function() {
    showStatus('实时识别暂不可用，请拍照后上传识别。');
  });
  stopRealtimeRecognitionButton.addEventListener('click', function() {
    realtimeResultsOverlay.hidden = true;
  });
  viewKnowledgeButton.addEventListener('click', function() {
    if (recognizedHerb?.name) {
      window.location.href = `knowledge-graph.html?herb=${encodeURIComponent(recognizedHerb.name)}`;
    }
  });

  function handleFile(file) {
    selectedFile = file;
    recognizeButton.disabled = false;
    hideResults();

    if (file.type.startsWith('image/')) {
      videoPreview.hidden = true;
      videoPreview.pause();
      imagePreview.src = URL.createObjectURL(file);
      imagePreview.hidden = false;
    } else if (file.type.startsWith('video/')) {
      imagePreview.hidden = true;
      videoPreview.src = URL.createObjectURL(file);
      videoPreview.hidden = false;
    } else {
      selectedFile = null;
      recognizeButton.disabled = true;
      showStatus('仅支持图片或视频文件。');
    }
    fileInput.accept = 'image/*,video/*';
  }

  async function startRecognition() {
    if (!selectedFile) return;
    loadingIndicator.style.display = 'flex';
    processingText.textContent = '正在识别，请稍候...';
    hideResults();

    try {
      const form = new FormData();
      form.append('file', selectedFile);
      const response = await fetch(`${API_BASE}/herb-recognition`, {
        method: 'POST',
        body: form
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) {
        throw new Error(json.message || '识别失败');
      }
      displayRecognitionResult(json.data.herb, json.data.confidence);
    } catch (error) {
      showStatus(error.message || '识别失败');
    } finally {
      loadingIndicator.style.display = 'none';
    }
  }

  function displayRecognitionResult(herb, confidence) {
    recognizedHerb = herb;
    herbNameText.textContent = herb.name || '未知药材';
    confidenceValue.textContent = Number.isFinite(Number(confidence)) ? `${Math.round(Number(confidence) * 100) / 100}%` : '已识别';
    herbTypeValue.textContent = herb.category_name || '暂无分类';
    herbRegionValue.textContent = herb.region_name || '暂无产地';
    herbPropertyValue.textContent = (herb.properties || []).join('、') || '暂无性味';
    herbMeridianValue.textContent = (herb.meridians || []).join('、') || '暂无归经';
    herbDescriptionValue.textContent = herb.description || herb.efficacies?.join('、') || '暂无详情';
    confidenceFill.style.width = Number.isFinite(Number(confidence)) ? `${Math.min(100, Math.max(0, Number(confidence)))}%` : '100%';
    renderResultHerbImage(herb);

    displayRelatedHerbs(herb.related || []);
    noResult.style.display = 'none';
    herbInfo.hidden = false;
    relatedHerbs.hidden = false;
    viewKnowledgeButton.hidden = false;
  }

  function displayRelatedHerbs(items) {
    relatedList.innerHTML = '';
    if (!items.length) {
      relatedList.innerHTML = '<div class="empty-state">暂无相关药材。</div>';
      return;
    }
    items.forEach(item => {
      const relatedItem = document.createElement('a');
      relatedItem.className = 'related-item';
      relatedItem.href = `herb-detail.html?id=${encodeURIComponent(item.id)}&herb=${encodeURIComponent(item.name)}`;
      relatedItem.innerHTML = `
        ${renderRelatedHerbImage(item)}
        <div class="related-item-name">${escapeHtml(item.name)}</div>
        <div class="related-item-meta">${escapeHtml(item.category_name || '暂无分类')}</div>`;
      relatedList.appendChild(relatedItem);
      hydrateRelatedHerbImage(relatedItem, item);
    });
  }

  function renderResultHerbImage(herb) {
    if (!herbResultImage) return;
    const imageUrl = getImageUrlFromHerb(herb);
    herbResultImage.className = imageUrl ? 'result-herb-image has-image' : 'result-herb-image no-image';
    herbResultImage.innerHTML = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(herb.name)}药材图片" loading="lazy">`
      : '<span>暂无药材图片</span>'; 
    hydrateResultHerbImage(herb);
  }

  async function hydrateResultHerbImage(herb) {
    if (!herbResultImage || !herb?.id || getImageUrlFromHerb(herb)) return;
    try {
      const response = await fetch(`${API_BASE}/herb-images/${encodeURIComponent(herb.id)}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) return;
      const imageUrl = firstImageUrl(json.data?.images || json.images || []);
      if (!imageUrl) return;
      herbResultImage.className = 'result-herb-image has-image';
      herbResultImage.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(herb.name)}药材图片" loading="lazy">`; 
    } catch (error) {
      // Keep the explicit no-image state when the backend has no image or the request fails.
    }
  }

  function renderRelatedHerbImage(item) {
    const imageUrl = getImageUrlFromHerb(item);
    if (imageUrl) {
      return `<div class="related-thumb has-image"><img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}药材图片" loading="lazy"></div>`;
    }
    return '<div class="related-thumb no-image"><span>暂无药材图片</span></div>'; 
  }

  async function hydrateRelatedHerbImage(container, item) {
    if (!item?.id || getImageUrlFromHerb(item)) return;
    try {
      const response = await fetch(`${API_BASE}/herb-images/${encodeURIComponent(item.id)}`);
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) return;
      const imageUrl = firstImageUrl(json.data?.images || json.images || []);
      if (!imageUrl) return;
      const thumb = container.querySelector('.related-thumb');
      if (thumb) {
        thumb.className = 'related-thumb has-image';
        thumb.innerHTML = `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(item.name)}药材图片" loading="lazy">`; 
      }
    } catch (error) {
      // Keep the explicit no-image state when the backend has no image or the request fails.
    }
  }

  function getImageUrlFromHerb(item) {
    return firstImageUrl(item?.images || item?.imageList || []) || absoluteAssetUrl(item?.image || item?.image_url || item?.imageUrl || item?.thumbnail || item?.thumbnail_url || '');
  }

  function firstImageUrl(images) {
    const list = Array.isArray(images) ? images : [];
    const image = list.find(entry => entry?.path || entry?.url || entry?.image_url || entry?.imageUrl || entry?.thumbnail || entry?.thumbnail_url);
    return image ? absoluteAssetUrl(image.path || image.url || image.image_url || image.imageUrl || image.thumbnail || image.thumbnail_url) : '';
  }

  function absoluteAssetUrl(value) {
    if (!value) return '';
    const url = String(value);
    if (/^https?:\/\//i.test(url)) return url;
    const path = url.startsWith('/') ? url : `/${url}`;
    if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
      const host = window.location.host;
      if (host === 'localhost:3001' || host === '127.0.0.1:3001') return path;
    }
    return `http://localhost:3001${path}`;
  }

  function hideResults() {
    noResult.style.display = 'block';
    herbInfo.hidden = true;
    relatedHerbs.hidden = true;
    viewKnowledgeButton.hidden = true;
    if (videoResults) videoResults.hidden = true;
    if (videoResultList) videoResultList.innerHTML = '';
  }

  function showStatus(message) {
    noResult.style.display = 'block';
    noResult.innerHTML = `<i class="fas fa-circle-info"></i><p>${escapeHtml(message)}</p>`;
    herbInfo.hidden = true;
    relatedHerbs.hidden = true;
    viewKnowledgeButton.hidden = true;
  }

  function openCameraModal() {
    cameraModal.hidden = false;
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then(stream => {
        mediaStream = stream;
        cameraPreview.srcObject = stream;
      })
      .catch(() => {
        showStatus('无法访问摄像头，请检查浏览器权限或改用文件上传。');
        closeCameraAndModal();
      });
  }

  function closeCameraAndModal() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    cameraModal.hidden = true;
    confirmCaptureButton.hidden = true;
    captureCameraButton.hidden = false;
    realtimeResultsOverlay.hidden = true;
  }

  function captureImage() {
    const context = captureCanvas.getContext('2d');
    captureCanvas.width = cameraPreview.videoWidth;
    captureCanvas.height = cameraPreview.videoHeight;
    context.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);
    confirmCaptureButton.hidden = false;
    captureCameraButton.hidden = true;
  }

  function useCapturedImage() {
    captureCanvas.toBlob(blob => {
      if (!blob) return;
      selectedFile = new File([blob], 'camera-capture.png', { type: 'image/png' });
      imagePreview.src = URL.createObjectURL(selectedFile);
      imagePreview.hidden = false;
      videoPreview.hidden = true;
      recognizeButton.disabled = false;
      closeCameraAndModal();
    }, 'image/png');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
});
