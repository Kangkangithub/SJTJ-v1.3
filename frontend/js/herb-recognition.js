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
  let previewObjectUrl = '';

  if (fileInput) fileInput.accept = 'image/*';

  uploadArea?.addEventListener('click', function(event) {
    if (event.target.closest('img, video, button, input')) return;
    fileInput?.click();
  });
  imagePreview?.addEventListener('click', event => event.stopPropagation());
  videoPreview?.addEventListener('click', event => event.stopPropagation());
  uploadArea?.addEventListener('dragover', function(event) {
    event.preventDefault();
    this.classList.add('upload-area-active');
  });
  uploadArea?.addEventListener('dragleave', function() {
    this.classList.remove('upload-area-active');
  });
  uploadArea?.addEventListener('drop', function(event) {
    event.preventDefault();
    this.classList.remove('upload-area-active');
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  fileInput?.addEventListener('change', function() {
    if (this.files && this.files[0]) handleFile(this.files[0]);
  });
  uploadButton?.addEventListener('click', function() {
    if (fileInput) fileInput.accept = 'image/*';
    fileInput?.click();
  });
  videoButton?.addEventListener('click', function() {
    showStatus('基础版仅支持图片识别，视频识别暂未开放。');
  });
  cameraButton?.addEventListener('click', openCameraModal);
  recognizeButton?.addEventListener('click', startRecognition);
  closeCameraModal?.addEventListener('click', closeCameraAndModal);
  captureCameraButton?.addEventListener('click', captureImage);
  confirmCaptureButton?.addEventListener('click', useCapturedImage);
  realtimeRecognitionButton?.addEventListener('click', function() {
    showStatus('基础版仅支持图片识别，实时识别暂未开放。');
  });
  stopRealtimeRecognitionButton?.addEventListener('click', function() {
    if (realtimeResultsOverlay) realtimeResultsOverlay.hidden = true;
  });
  viewKnowledgeButton?.addEventListener('click', function() {
    if (recognizedHerb?.name) {
      window.location.href = `knowledge-graph.html?herb=${encodeURIComponent(recognizedHerb.name)}`;
    }
  });

  function handleFile(file) {
    hideResults();
    resetPreviewObjectUrl();

    if (!file.type.startsWith('image/')) {
      selectedFile = null;
      if (recognizeButton) recognizeButton.disabled = true;
      clearPreview();
      showStatus('基础版仅支持图片文件。');
      return;
    }

    selectedFile = file;
    recognizedHerb = null;
    if (recognizeButton) recognizeButton.disabled = false;

    if (videoPreview) {
      videoPreview.hidden = true;
      videoPreview.pause?.();
      videoPreview.removeAttribute('src');
    }
    previewObjectUrl = URL.createObjectURL(file);
    if (imagePreview) {
      imagePreview.src = previewObjectUrl;
      imagePreview.hidden = false;
    }
    if (fileInput) fileInput.accept = 'image/*';
  }

  function clearPreview() {
    if (imagePreview) {
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
    }
    if (videoPreview) {
      videoPreview.hidden = true;
      videoPreview.removeAttribute('src');
    }
  }

  function resetPreviewObjectUrl() {
    if (!previewObjectUrl) return;
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = '';
  }

  async function startRecognition() {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      showStatus('基础版仅支持图片文件。');
      return;
    }

    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (processingText) processingText.textContent = '正在识别，请稍候...';
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
        throw new Error(messageForRecognitionError(json));
      }
      displayRecognitionResult(json.data?.herb, json.data?.confidence, json.data?.source);
    } catch (error) {
      showStatus(error.message || '未能识别出明确药材，请更换清晰图片后重试');
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  function displayRecognitionResult(herb, confidence, source) {
    if (!herb || !herb.name) {
      showStatus('未能识别出明确药材，请更换清晰图片后重试');
      return;
    }

    recognizedHerb = herb;
    const confidenceNumber = Number(confidence || 0);
    const confidencePercent = confidenceNumber > 0 ? Math.round(Math.min(1, Math.max(0, confidenceNumber)) * 100) : 0;

    if (herbNameText) herbNameText.textContent = herb.name;
    if (confidenceValue) confidenceValue.textContent = confidencePercent > 0 ? `${confidencePercent}%` : '已识别';
    if (herbTypeValue) herbTypeValue.textContent = herb.category_name || '暂无分类';
    if (herbRegionValue) herbRegionValue.textContent = herb.region_name || '暂无产地';
    if (herbPropertyValue) herbPropertyValue.textContent = formatNameList(herb.properties) || '暂无性味';
    if (herbMeridianValue) herbMeridianValue.textContent = formatNameList(herb.meridians) || '暂无归经';
    if (herbDescriptionValue) herbDescriptionValue.textContent = herb.description || formatNameList(herb.efficacies) || '暂无详情';
    if (confidenceFill) confidenceFill.style.width = confidencePercent > 0 ? `${confidencePercent}%` : '100%';

    renderResultHerbImage(herb);
    displayRelatedHerbs(herb.related || []);

    if (noResult) noResult.style.display = 'none';
    if (herbInfo) herbInfo.hidden = false;
    if (relatedHerbs) relatedHerbs.hidden = false;
    if (viewKnowledgeButton) viewKnowledgeButton.hidden = false;
  }

  function formatNameList(items) {
    return (Array.isArray(items) ? items : [])
      .map(item => typeof item === 'string' ? item : item?.name)
      .filter(Boolean)
      .join('、');
  }

  function messageForRecognitionError(json) {
    if (json?.code === 'VISION_SERVICE_NOT_CONFIGURED') return '药材识别服务尚未配置，请联系管理员配置后再试';
    if (json?.code === 'HERB_NOT_FOUND') return json.message || '识别结果暂未匹配到知识图谱药材';
    if (json?.code === 'HERB_RECOGNITION_FAILED') return json.message || '未能识别出明确药材，请更换清晰图片后重试';
    if (json?.code === 'HERB_RECOGNITION_TIMEOUT') return json.message || '药材识别请求超时，请稍后重试';
    return json?.message || '未能识别出明确药材，请更换清晰图片后重试';
  }

  function displayRelatedHerbs(items) {
    if (!relatedList) return;
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
      // 保持明确的无图状态即可。
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
      // 保持明确的无图状态即可。
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
    if (noResult) noResult.style.display = 'block';
    if (herbInfo) herbInfo.hidden = true;
    if (relatedHerbs) relatedHerbs.hidden = true;
    if (viewKnowledgeButton) viewKnowledgeButton.hidden = true;
    if (videoResults) videoResults.hidden = true;
    if (videoResultList) videoResultList.innerHTML = '';
  }

  function showStatus(message) {
    if (noResult) {
      noResult.style.display = 'block';
      noResult.innerHTML = `<i class="fas fa-circle-info"></i><p>${escapeHtml(message)}</p>`;
    }
    if (herbInfo) herbInfo.hidden = true;
    if (relatedHerbs) relatedHerbs.hidden = true;
    if (viewKnowledgeButton) viewKnowledgeButton.hidden = true;
  }

  function openCameraModal() {
    if (!cameraModal) return;
    cameraModal.hidden = false;
    navigator.mediaDevices?.getUserMedia({ video: true })
      .then(stream => {
        mediaStream = stream;
        if (cameraPreview) cameraPreview.srcObject = stream;
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
    if (cameraModal) cameraModal.hidden = true;
    if (confirmCaptureButton) confirmCaptureButton.hidden = true;
    if (captureCameraButton) captureCameraButton.hidden = false;
    if (realtimeResultsOverlay) realtimeResultsOverlay.hidden = true;
  }

  function captureImage() {
    if (!captureCanvas || !cameraPreview) return;
    const context = captureCanvas.getContext('2d');
    captureCanvas.width = cameraPreview.videoWidth;
    captureCanvas.height = cameraPreview.videoHeight;
    context.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);
    if (confirmCaptureButton) confirmCaptureButton.hidden = false;
    if (captureCameraButton) captureCameraButton.hidden = true;
  }

  function useCapturedImage() {
    if (!captureCanvas) return;
    captureCanvas.toBlob(blob => {
      if (!blob) return;
      handleFile(new File([blob], 'camera-capture.png', { type: 'image/png' }));
      closeCameraAndModal();
    }, 'image/png');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
