document.addEventListener('DOMContentLoaded', function() {
  const API_BASE = 'http://localhost:3001/api';

  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const imagePreview = document.getElementById('imagePreview');
  const videoPreview = document.getElementById('videoPreview');
  const uploadButton = document.getElementById('uploadButton');
  const videoButton = document.getElementById('videoButton');
  const recognizeButton = document.getElementById('recognizeButton');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const noResult = document.getElementById('noResult');
  const herbInfo = document.getElementById('herbInfo');
  const relatedHerbs = document.getElementById('relatedHerbs');
  const viewKnowledgeButton = document.getElementById('viewKnowledgeButton');
  const processingText = document.getElementById('processingText');

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
  let recognizedHerb = null;
  let previewObjectUrl = '';

  if (fileInput) fileInput.accept = 'image/*,video/*';

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
    if (fileInput) fileInput.accept = 'video/*';
    fileInput?.click();
  });
  recognizeButton?.addEventListener('click', startRecognition);
  viewKnowledgeButton?.addEventListener('click', function() {
    if (recognizedHerb?.name) {
      window.location.href = `knowledge-graph.html?herb=${encodeURIComponent(recognizedHerb.name)}`;
    }
  });

  function handleFile(file) {
    hideResults();
    resetPreviewObjectUrl();

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      selectedFile = null;
      if (recognizeButton) recognizeButton.disabled = true;
      clearPreview();
      showStatus('请上传图片或视频文件。');
      return;
    }

    selectedFile = file;
    recognizedHerb = null;
    if (recognizeButton) recognizeButton.disabled = false;

    previewObjectUrl = URL.createObjectURL(file);
    if (isImage) {
      if (videoPreview) {
        videoPreview.hidden = true;
        videoPreview.pause?.();
        videoPreview.removeAttribute('src');
      }
      if (imagePreview) {
        imagePreview.src = previewObjectUrl;
        imagePreview.hidden = false;
      }
    } else {
      if (imagePreview) {
        imagePreview.hidden = true;
        imagePreview.removeAttribute('src');
      }
      if (videoPreview) {
        videoPreview.src = previewObjectUrl;
        videoPreview.hidden = false;
      }
      showStatus('视频已选择，点击开始识别后将自动抽取关键帧。');
    }
    if (fileInput) fileInput.accept = 'image/*,video/*';
  }

  function clearPreview() {
    if (imagePreview) {
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
    }
    if (videoPreview) {
      videoPreview.hidden = true;
      videoPreview.pause?.();
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
    const isImage = selectedFile.type.startsWith('image/');
    const isVideo = selectedFile.type.startsWith('video/');
    if (!isImage && !isVideo) {
      showStatus('请上传图片或视频文件。');
      return;
    }

    if (loadingIndicator) loadingIndicator.style.display = 'flex';
    if (processingText) processingText.textContent = isVideo ? '正在抽取视频关键帧...' : '正在识别，请稍候...';
    hideResults();

    try {
      const result = isVideo ? await recognizeVideo(selectedFile) : await recognizeImageFile(selectedFile);
      displayRecognitionResult(result.herb, result.confidence, result.source);
    } catch (error) {
      showStatus(error.message || '未能识别出明确药材，请更换清晰图片后重试');
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  async function recognizeImageFile(file) {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_BASE}/herb-recognition`, {
      method: 'POST',
      body: form
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) {
      throw new Error(messageForRecognitionError(json));
    }
    return {
      herb: json.data?.herb,
      confidence: json.data?.confidence,
      source: json.data?.source
    };
  }

  async function recognizeVideo(file) {
    const frames = await extractVideoFrames(file, 5);
    if (!frames.length) throw new Error('未能从视频中提取清晰画面，请更换视频或上传图片。');

    const results = [];
    for (let index = 0; index < frames.length; index++) {
      if (processingText) processingText.textContent = `正在识别视频关键帧 ${index + 1}/${frames.length}...`;
      try {
        const result = await recognizeImageFile(frames[index]);
        if (result?.herb?.name) results.push(result);
      } catch (error) {
        // 单帧识别失败不影响后续关键帧。
      }
    }

    if (!results.length) throw new Error('未能从视频关键帧中识别出明确药材，请更换更清晰的视频。');
    const best = pickBestVideoRecognitionResult(results);
    return {
      herb: best.herb,
      confidence: best.confidence,
      source: 'video-keyframes'
    };
  }

  function pickBestVideoRecognitionResult(results) {
    const grouped = new Map();
    results.forEach((item) => {
      const name = item.herb?.name || '';
      if (!name) return;
      const current = grouped.get(name) || { count: 0, confidence: 0, item };
      const confidence = Number(item.confidence || 0) || 0;
      current.count += 1;
      if (confidence >= current.confidence) {
        current.confidence = confidence;
        current.item = item;
      }
      grouped.set(name, current);
    });
    return Array.from(grouped.values())
      .sort((a, b) => b.count - a.count || b.confidence - a.confidence)[0].item;
  }

  async function extractVideoFrames(file, frameCount) {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
      await waitForVideoEvent(video, 'loadedmetadata');
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const canvas = document.createElement('canvas');
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const maxSide = 960;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      const times = buildFrameTimes(duration, frameCount);
      const frames = [];

      for (const time of times) {
        video.currentTime = time;
        await waitForVideoEvent(video, 'seeked');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88);
        if (blob) frames.push(new File([blob], `video-frame-${Math.round(time * 1000)}.jpg`, { type: 'image/jpeg' }));
      }
      return frames;
    } finally {
      URL.revokeObjectURL(url);
      video.removeAttribute('src');
      video.load?.();
    }
  }

  function buildFrameTimes(duration, frameCount) {
    const total = Math.max(1, frameCount || 1);
    const safeDuration = Math.max(0.2, duration || 1);
    if (total === 1) return [Math.min(0.2, safeDuration / 2)];
    return Array.from({ length: total }, (_, index) => {
      const ratio = (index + 1) / (total + 1);
      return Math.min(safeDuration - 0.05, Math.max(0.05, safeDuration * ratio));
    });
  }

  function waitForVideoEvent(video, eventName) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener(eventName, onEvent);
        video.removeEventListener('error', onError);
      };
      const onEvent = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('视频读取失败，请更换文件后重试。'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('视频读取超时，请更换更短或更清晰的视频。'));
      }, 8000);
      video.addEventListener(eventName, onEvent, { once: true });
      video.addEventListener('error', onError, { once: true });
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(resolve => canvas.toBlob(resolve, type, quality));
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

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
});
