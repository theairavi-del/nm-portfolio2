const board = document.getElementById('board');
const emptyState = document.getElementById('emptyState');
const cardTemplate = document.getElementById('cardTemplate');

const statusPill = document.getElementById('statusPill');
const portfolioCount = document.getElementById('portfolioCount');
const metaStarted = document.getElementById('metaStarted');
const metaModified = document.getElementById('metaModified');
const metaLength = document.getElementById('metaLength');

const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const lightboxVideo = document.getElementById('lightboxVideo');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxPrev = document.getElementById('lightboxPrev');
const lightboxNext = document.getElementById('lightboxNext');

const imageCards = new Map();
const imageIndexByName = new Map();
const preloadCache = new Set();

let imagesState = [];
let isLoading = false;
let currentLightboxIndex = -1;
let lightboxSwapToken = 0;
let imageObserver = null;

const PREFETCH_NEIGHBOR_COUNT = 2;
const EAGER_LOAD_COUNT = 8;
const OBSERVER_ROOT_MARGIN = '640px 0px';
const CARD_TILT_MAX_DEGREES = 7;
const HAS_FINE_POINTER = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const ALLOWED_MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.mp4', '.m4v', '.webm', '.mov']);
let videoPlaybackObserver = null;

function normalizeName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function appendModifiedQuery(url, modifiedMs) {
  if (typeof url !== 'string' || !url.trim()) {
    return '';
  }
  const stamp = Number.isFinite(Number(modifiedMs)) ? Math.floor(Number(modifiedMs)) : 0;
  const joiner = url.includes('?') ? '&' : '?';
  return `${url}${joiner}v=${stamp}`;
}

function buildImageUrl(image) {
  return appendModifiedQuery(image.url, image.modifiedMs);
}

function isVideoMedia(item) {
  return item && item.mediaType === 'video';
}

function buildThumbnailUrl(image) {
  const thumbUrl = typeof image.thumbUrl === 'string' && image.thumbUrl ? image.thumbUrl : image.url;
  return appendModifiedQuery(thumbUrl, image.modifiedMs);
}

function normalizeStaticManifestItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }
  const name = typeof item.name === 'string' ? item.name.trim() : '';
  if (!name) {
    return null;
  }
  const extension = name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '';
  if (!ALLOWED_MEDIA_EXTENSIONS.has(extension)) {
    return null;
  }

  const modifiedMs = Number.isFinite(Number(item.modifiedMs)) ? Number(item.modifiedMs) : 0;
  const size = Number.isFinite(Number(item.size)) ? Number(item.size) : 0;
  const mediaType = item.mediaType === 'video' ? 'video' : 'image';
  const baseUrl = typeof item.url === 'string' && item.url ? item.url : `./media/${encodeURIComponent(name)}`;
  const thumbUrl = typeof item.thumbUrl === 'string' && item.thumbUrl ? item.thumbUrl : baseUrl;

  return {
    name,
    modifiedMs,
    size,
    mediaType,
    width: Number.isFinite(Number(item.width)) ? Number(item.width) : null,
    height: Number.isFinite(Number(item.height)) ? Number(item.height) : null,
    url: baseUrl,
    thumbUrl,
    key: typeof item.key === 'string' && item.key ? item.key : `${name}-${Math.floor(modifiedMs)}`,
  };
}

function getStaticManifestImages() {
  const rawManifest = globalThis.NM_MEDIA_INDEX;
  if (!Array.isArray(rawManifest)) {
    return [];
  }

  return rawManifest
    .map((item) => normalizeStaticManifestItem(item))
    .filter(Boolean)
    .sort((a, b) => b.modifiedMs - a.modifiedMs);
}

async function fetchImagePayload() {
  const endpoints = ['./api/images', '/api/images'];
  const errors = [];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) {
        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorPayload = await response.json();
          if (errorPayload && typeof errorPayload.error === 'string' && errorPayload.error.trim()) {
            errorMessage = errorPayload.error.trim();
          }
        } catch (_error) {
          // Fall back to the status-derived message when error payload isn't JSON.
        }
        errors.push(`${endpoint}: ${errorMessage}`);
        continue;
      }

      const payload = await response.json();
      return { payload, fallback: false };
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Unknown fetch error';
      errors.push(`${endpoint}: ${message}`);
    }
  }

  const fallbackImages = getStaticManifestImages();
  if (fallbackImages.length > 0) {
    return {
      payload: {
        images: fallbackImages,
      },
      fallback: true,
    };
  }

  throw new Error(errors[0] || 'Could not read image folder');
}

function hasValidMediaDimensions(item) {
  const width = Number(item?.width);
  const height = Number(item?.height);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function setMediaAspectRatio(mediaSlot, mediaElement, item) {
  if (hasValidMediaDimensions(item)) {
    const width = Math.round(Number(item.width));
    const height = Math.round(Number(item.height));
    mediaSlot.style.aspectRatio = `${width} / ${height}`;
    mediaElement.width = width;
    mediaElement.height = height;
    return;
  }

  mediaSlot.style.removeProperty('aspect-ratio');
  mediaElement.removeAttribute('width');
  mediaElement.removeAttribute('height');
}

function playVideoSafely(videoElement) {
  if (!videoElement) {
    return;
  }
  const playAttempt = videoElement.play();
  if (playAttempt && typeof playAttempt.catch === 'function') {
    playAttempt.catch(() => {});
  }
}

function formatSyncTime(timestamp = Date.now()) {
  const time = new Date(timestamp);
  return time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatMetaDate(timestamp) {
  if (!timestamp) {
    return '—';
  }

  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function setStatus(message, state = 'live') {
  if (!statusPill) {
    return;
  }

  statusPill.textContent = message;
  statusPill.classList.remove('live', 'error');
  if (state === 'live') {
    statusPill.classList.add('live');
  }
  if (state === 'error') {
    statusPill.classList.add('error');
  }
}

function syncMeta(images) {
  const count = images.length;
  const hasStaticStarted = Boolean(metaStarted?.dataset.static === 'true');
  const hasStaticModified = Boolean(metaModified?.dataset.static === 'true');
  const hasStaticLength = Boolean(metaLength?.dataset.static === 'true');

  if (portfolioCount) {
    portfolioCount.textContent = String(count);
  }

  if (metaLength && !hasStaticLength) {
    metaLength.textContent = String(count);
  }

  if (count === 0) {
    if (metaStarted && !hasStaticStarted) {
      metaStarted.textContent = '—';
    }
    if (metaModified && !hasStaticModified) {
      metaModified.textContent = '—';
    }
    return;
  }

  const latest = images[0];
  const oldest = images[count - 1];

  if (metaModified && !hasStaticModified) {
    metaModified.textContent = formatMetaDate(latest.modifiedMs);
  }
  if (metaStarted && !hasStaticStarted) {
    metaStarted.textContent = formatMetaDate(oldest.modifiedMs);
  }
}

function getImageObserver() {
  if (!('IntersectionObserver' in window)) {
    return null;
  }

  if (imageObserver) {
    return imageObserver;
  }

  imageObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const imageElement = entry.target;
        imageObserver.unobserve(imageElement);
        loadCardMedia(imageElement);
      }
    },
    {
      root: null,
      rootMargin: OBSERVER_ROOT_MARGIN,
      threshold: 0.01,
    }
  );

  return imageObserver;
}

function markCardImageReady(imageElement) {
  imageElement.dataset.loaded = '1';
  imageElement.classList.add('is-ready');
}

function markCardVideoReady(videoElement) {
  videoElement.dataset.loaded = '1';
  videoElement.classList.add('is-ready');
  playVideoSafely(videoElement);
}

function loadCardImage(imageElement) {
  if (!imageElement || imageElement.dataset.loaded === '1') {
    return;
  }

  const sourceUrl = imageElement.dataset.src;
  if (!sourceUrl) {
    return;
  }

  imageElement.src = sourceUrl;
  imageElement.decoding = 'async';
  if ('fetchPriority' in imageElement) {
    imageElement.fetchPriority = imageElement.dataset.priority === 'high' ? 'high' : 'low';
  }

  if (imageElement.complete) {
    markCardImageReady(imageElement);
    return;
  }

  imageElement.addEventListener('load', () => markCardImageReady(imageElement), { once: true });
  imageElement.addEventListener('error', () => markCardImageReady(imageElement), { once: true });
}

function loadCardVideo(videoElement) {
  if (!videoElement || videoElement.dataset.loaded === '1') {
    return;
  }

  const sourceUrl = videoElement.dataset.src;
  if (!sourceUrl) {
    return;
  }

  if (videoElement.src !== sourceUrl) {
    videoElement.src = sourceUrl;
  }
  videoElement.defaultMuted = true;
  videoElement.muted = true;
  videoElement.loop = true;
  videoElement.autoplay = true;
  videoElement.playsInline = true;
  videoElement.setAttribute('autoplay', '');
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('muted', '');
  videoElement.preload = videoElement.dataset.priority === 'high' ? 'auto' : 'metadata';

  if (videoElement.readyState >= 2) {
    markCardVideoReady(videoElement);
    return;
  }

  videoElement.addEventListener('loadeddata', () => markCardVideoReady(videoElement), { once: true });
  videoElement.addEventListener('canplay', () => markCardVideoReady(videoElement), { once: true });
  videoElement.addEventListener('error', () => markCardVideoReady(videoElement), { once: true });
  videoElement.load();
}

function loadCardMedia(mediaElement) {
  if (!mediaElement) {
    return;
  }
  if (mediaElement.tagName === 'VIDEO') {
    loadCardVideo(mediaElement);
    return;
  }
  loadCardImage(mediaElement);
}

function queueCardMediaLoad(mediaElement, eager = false) {
  if (!mediaElement) {
    return;
  }

  if (mediaElement.tagName === 'VIDEO') {
    mediaElement.dataset.priority = eager ? 'high' : 'low';
    if (eager) {
      loadCardVideo(mediaElement);
    }
    return;
  }

  mediaElement.dataset.priority = eager ? 'high' : 'low';

  if (eager) {
    loadCardMedia(mediaElement);
    return;
  }

  const observer = getImageObserver();
  if (!observer) {
    loadCardMedia(mediaElement);
    return;
  }

  observer.observe(mediaElement);
}

function getVideoPlaybackObserver() {
  if (!('IntersectionObserver' in window)) {
    return null;
  }

  if (videoPlaybackObserver) {
    return videoPlaybackObserver;
  }

  videoPlaybackObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const mediaElement = entry.target;
        if (!(mediaElement instanceof HTMLVideoElement)) {
          continue;
        }

        if (entry.isIntersecting && entry.intersectionRatio >= 0.15) {
          if (mediaElement.dataset.loaded === '1') {
            playVideoSafely(mediaElement);
          } else {
            loadCardVideo(mediaElement);
          }
        } else {
          mediaElement.pause();
        }
      }
    },
    {
      root: null,
      rootMargin: '260px 0px',
      threshold: [0, 0.08, 0.4],
    }
  );

  return videoPlaybackObserver;
}

function updateLightboxNavState() {
  const canNavigate = imagesState.length > 1;
  lightboxPrev.disabled = !canNavigate;
  lightboxNext.disabled = !canNavigate;
  lightboxPrev.hidden = !canNavigate;
  lightboxNext.hidden = !canNavigate;
}

function preloadImage(sourceUrl) {
  if (!sourceUrl || preloadCache.has(sourceUrl)) {
    return;
  }

  preloadCache.add(sourceUrl);
  const preloader = new Image();
  preloader.src = sourceUrl;
}

function preloadNeighbors(index) {
  if (imagesState.length < 2) {
    return;
  }

  for (let step = 1; step <= PREFETCH_NEIGHBOR_COUNT; step += 1) {
    const nextIndex = (index + step) % imagesState.length;
    const prevIndex = (index - step + imagesState.length) % imagesState.length;
    const nextMedia = imagesState[nextIndex];
    const prevMedia = imagesState[prevIndex];
    if (!isVideoMedia(nextMedia)) {
      preloadImage(buildImageUrl(nextMedia));
    }
    if (!isVideoMedia(prevMedia)) {
      preloadImage(buildImageUrl(prevMedia));
    }
  }
}

function renderLightboxMedia(index) {
  const media = imagesState[index];
  if (!media) {
    return;
  }

  const nextSource = buildImageUrl(media);
  const swapToken = ++lightboxSwapToken;

  lightboxVideo.pause();
  lightboxVideo.removeAttribute('src');
  lightboxVideo.load();
  lightboxImage.classList.add('is-loading');
  lightboxVideo.classList.add('is-loading');

  if (isVideoMedia(media)) {
    const commitVideo = () => {
      if (swapToken !== lightboxSwapToken) {
        return;
      }
      lightboxImage.hidden = true;
      lightboxVideo.hidden = false;
      lightboxVideo.src = nextSource;
      lightboxVideo.defaultMuted = true;
      lightboxVideo.muted = true;
      lightboxVideo.loop = true;
      lightboxVideo.autoplay = true;
      lightboxVideo.playsInline = true;
      lightboxVideo.setAttribute('autoplay', '');
      lightboxVideo.setAttribute('playsinline', '');
      lightboxVideo.setAttribute('muted', '');
      lightboxVideo.load();
      playVideoSafely(lightboxVideo);
      lightbox.dataset.currentName = media.name;
      lightbox.dataset.currentKey = media.key;
      lightboxImage.classList.remove('is-loading');
      lightboxVideo.classList.remove('is-loading');
    };
    commitVideo();
  } else {
    const loader = new Image();
    loader.decoding = 'async';
    loader.src = nextSource;

    const commitImage = () => {
      if (swapToken !== lightboxSwapToken) {
        return;
      }
      lightboxVideo.hidden = true;
      lightboxImage.hidden = false;
      if (lightboxImage.src !== loader.src) {
        lightboxImage.src = loader.src;
      }
      lightboxImage.alt = 'Expanded portfolio image';
      lightbox.dataset.currentName = media.name;
      lightbox.dataset.currentKey = media.key;
      lightboxImage.classList.remove('is-loading');
      lightboxVideo.classList.remove('is-loading');
    };

    if (loader.complete) {
      commitImage();
    } else {
      loader.addEventListener('load', commitImage, { once: true });
      loader.addEventListener(
        'error',
        () => {
          if (swapToken !== lightboxSwapToken) {
            return;
          }
          lightboxImage.classList.remove('is-loading');
          lightboxVideo.classList.remove('is-loading');
        },
        { once: true }
      );
    }
  }

  preloadNeighbors(index);
  updateLightboxNavState();
}

function openLightbox(index, previewSrc = '') {
  if (!imagesState.length) {
    return;
  }

  currentLightboxIndex = (index + imagesState.length) % imagesState.length;
  const currentMedia = imagesState[currentLightboxIndex];
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  updateLightboxNavState();

  if (previewSrc && !isVideoMedia(currentMedia)) {
    lightboxImage.src = previewSrc;
  }

  renderLightboxMedia(currentLightboxIndex);
}

function openLightboxByName(name, previewSrc = '') {
  const index = imageIndexByName.get(name);
  if (typeof index !== 'number') {
    return;
  }
  openLightbox(index, previewSrc);
}

function closeLightbox() {
  if (lightbox.hidden) {
    return;
  }

  lightbox.hidden = true;
  document.body.style.overflow = '';
  lightboxImage.classList.remove('is-loading');
  lightboxVideo.classList.remove('is-loading');
  lightboxVideo.pause();
  lightboxVideo.removeAttribute('src');
  lightboxVideo.load();
  delete lightbox.dataset.currentName;
  delete lightbox.dataset.currentKey;
  currentLightboxIndex = -1;
  lightboxSwapToken += 1;
}

function navigateLightbox(step) {
  if (lightbox.hidden || imagesState.length < 2) {
    return;
  }

  currentLightboxIndex = (currentLightboxIndex + step + imagesState.length) % imagesState.length;
  renderLightboxMedia(currentLightboxIndex);
}

function setupCardTilt(button) {
  if (!HAS_FINE_POINTER || !button) {
    return;
  }

  let animationFrameId = 0;
  let nextRotateX = 0;
  let nextRotateY = 0;

  const commit = () => {
    animationFrameId = 0;
    button.style.setProperty('--pin-rx', `${nextRotateX.toFixed(2)}deg`);
    button.style.setProperty('--pin-ry', `${nextRotateY.toFixed(2)}deg`);
    button.style.setProperty('--pin-scale', '1.02');
  };

  button.addEventListener('pointermove', (event) => {
    const rect = button.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const xRatio = (event.clientX - rect.left) / rect.width;
    const yRatio = (event.clientY - rect.top) / rect.height;

    nextRotateY = (xRatio - 0.5) * CARD_TILT_MAX_DEGREES * 2;
    nextRotateX = (0.5 - yRatio) * CARD_TILT_MAX_DEGREES * 2;

    if (!animationFrameId) {
      animationFrameId = window.requestAnimationFrame(commit);
    }
  });

  const resetTilt = () => {
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    }
    button.style.setProperty('--pin-rx', '0deg');
    button.style.setProperty('--pin-ry', '0deg');
    button.style.setProperty('--pin-scale', '1');
  };

  button.addEventListener('pointerleave', resetTilt);
  button.addEventListener('pointercancel', resetTilt);
  button.addEventListener('pointerdown', () => {
    button.style.setProperty('--pin-scale', '1.01');
  });
  button.addEventListener('pointerup', () => {
    button.style.setProperty('--pin-scale', '1.02');
  });
}

function buildCard(image, isNew = false) {
  const cardFragment = cardTemplate.content.cloneNode(true);
  const card = cardFragment.querySelector('.pin-card');
  const button = cardFragment.querySelector('.pin-button');
  const mediaSlot = cardFragment.querySelector('.pin-media-slot');
  const sourceUrl = isVideoMedia(image) ? buildImageUrl(image) : buildThumbnailUrl(image);
  let mediaElement;

  if (isVideoMedia(image)) {
    const video = document.createElement('video');
    video.className = 'pin-video';
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('autoplay', '');
    video.preload = 'metadata';
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.dataset.src = sourceUrl;
    video.dataset.loaded = '0';
    mediaElement = video;
  } else {
    const imageElement = document.createElement('img');
    imageElement.className = 'pin-image';
    imageElement.loading = 'lazy';
    imageElement.alt = normalizeName(image.name);
    imageElement.dataset.src = sourceUrl;
    imageElement.dataset.loaded = '0';
    imageElement.classList.remove('is-ready');
    mediaElement = imageElement;
  }

  setMediaAspectRatio(mediaSlot, mediaElement, image);
  mediaSlot.replaceChildren(mediaElement);

  button.setAttribute('aria-label', `Open ${normalizeName(image.name)}`);

  button.addEventListener('click', () => {
    const previewSrc = mediaElement.currentSrc || mediaElement.src || '';
    openLightboxByName(image.name, previewSrc);
  });
  setupCardTilt(button);

  if (isNew) {
    card.classList.add('is-new');
  }

  card.dataset.key = image.key;
  card.dataset.name = image.name;

  return card;
}

function reorderBoardIfNeeded(orderedCards) {
  const currentChildren = board.children;
  let shouldReorder = currentChildren.length !== orderedCards.length;

  if (!shouldReorder) {
    for (let index = 0; index < orderedCards.length; index += 1) {
      if (currentChildren[index] !== orderedCards[index]) {
        shouldReorder = true;
        break;
      }
    }
  }

  if (shouldReorder) {
    board.replaceChildren(...orderedCards);
  }
}

function syncCards(images) {
  imagesState = images;
  imageIndexByName.clear();
  images.forEach((image, index) => imageIndexByName.set(image.name, index));

  const nextNames = new Set(images.map((image) => image.name));

  for (const [name, card] of imageCards.entries()) {
    if (nextNames.has(name)) {
      continue;
    }

    const mediaElement = card.querySelector('.pin-image, .pin-video');
    if (imageObserver && mediaElement) {
      imageObserver.unobserve(mediaElement);
    }
    if (videoPlaybackObserver && mediaElement instanceof HTMLVideoElement) {
      videoPlaybackObserver.unobserve(mediaElement);
      mediaElement.pause();
    }

    card.remove();
    imageCards.delete(name);
  }

  for (const image of images) {
    const existingCard = imageCards.get(image.name);

    if (existingCard) {
      if (existingCard.dataset.key !== image.key) {
        const mediaElement = existingCard.querySelector('.pin-image, .pin-video');
        if (imageObserver && mediaElement) {
          imageObserver.unobserve(mediaElement);
        }
        if (videoPlaybackObserver && mediaElement instanceof HTMLVideoElement) {
          videoPlaybackObserver.unobserve(mediaElement);
          mediaElement.pause();
        }

        const refreshedCard = buildCard(image);
        existingCard.replaceWith(refreshedCard);
        imageCards.set(image.name, refreshedCard);
      }
      continue;
    }

    const newCard = buildCard(image, true);
    imageCards.set(image.name, newCard);
  }

  const orderedImageCards = images.map((image) => imageCards.get(image.name)).filter(Boolean);
  reorderBoardIfNeeded(orderedImageCards);

  orderedImageCards.forEach((card, index) => {
    const mediaElement = card.querySelector('.pin-image, .pin-video');
    if (mediaElement instanceof HTMLVideoElement) {
      const playbackObserver = getVideoPlaybackObserver();
      if (playbackObserver) {
        playbackObserver.observe(mediaElement);
      }
    }
    queueCardMediaLoad(mediaElement, index < EAGER_LOAD_COUNT);
  });

  board.hidden = false;
  emptyState.hidden = true;

  if (!lightbox.hidden) {
    const activeName = lightbox.dataset.currentName;
    const activeIndex = typeof activeName === 'string' ? imageIndexByName.get(activeName) : undefined;

    if (typeof activeIndex !== 'number') {
      closeLightbox();
      return;
    }

    currentLightboxIndex = activeIndex;
    const currentImage = imagesState[activeIndex];
    if (lightbox.dataset.currentKey !== currentImage.key) {
      renderLightboxMedia(activeIndex);
    } else {
      updateLightboxNavState();
      preloadNeighbors(activeIndex);
    }
  }
}

async function loadImages() {
  if (isLoading) {
    return;
  }

  isLoading = true;

  try {
    const { payload, fallback } = await fetchImagePayload();
    const images = Array.isArray(payload.images) ? payload.images : [];

    syncCards(images);
    syncMeta(images);
    if (fallback) {
      setStatus(`Loaded static media index • ${formatSyncTime()}`);
    } else {
      setStatus(`Loaded • ${formatSyncTime()} • Manual refresh`);
    }
  } catch (error) {
    console.error(error);
    const message = error instanceof Error && error.message ? error.message : 'Could not read image folder';
    setStatus(message, 'error');
    board.hidden = true;
    emptyState.hidden = false;
  } finally {
    isLoading = false;
  }
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
lightboxNext.addEventListener('click', () => navigateLightbox(1));

lightbox.addEventListener('click', (event) => {
  if (event.target === lightbox) {
    closeLightbox();
  }
});

document.addEventListener('keydown', (event) => {
  if (lightbox.hidden) {
    return;
  }

  if (event.key === 'Escape') {
    closeLightbox();
  } else if (event.key === 'ArrowLeft') {
    navigateLightbox(-1);
  } else if (event.key === 'ArrowRight') {
    navigateLightbox(1);
  }
});

// 🥚 EASTER EGGS 🥚

// 1. Konami Code Easter Egg
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiIndex = 0;

document.addEventListener('keydown', (event) => {
  if (event.key === konamiCode[konamiIndex]) {
    konamiIndex++;
    if (konamiIndex === konamiCode.length) {
      activateKonamiMode();
      konamiIndex = 0;
    }
  } else {
    konamiIndex = 0;
  }
});

function activateKonamiMode() {
  document.body.style.filter = 'hue-rotate(180deg) saturate(2)';
  setStatus('🎮 KONAMI CODE ACTIVATED - SECRET MODE UNLOCKED', 'success');
  
  // Add floating emojis
  for (let i = 0; i < 20; i++) {
    setTimeout(() => createFloatingEmoji(), i * 100);
  }
  
  // Reset after 10 seconds
  setTimeout(() => {
    document.body.style.filter = '';
    setStatus('Loaded • ' + formatSyncTime(), 'success');
  }, 10000);
}

function createFloatingEmoji() {
  const emoji = document.createElement('div');
  emoji.textContent = ['🎨', '🎭', '🎪', '🎯', '🎲', '🎸', '🎺', '🎻'][Math.floor(Math.random() * 8)];
  emoji.style.cssText = `
    position: fixed;
    font-size: 24px;
    left: ${Math.random() * 100}vw;
    top: 100vh;
    pointer-events: none;
    z-index: 9999;
    animation: floatUp 3s ease-out forwards;
  `;
  document.body.appendChild(emoji);
  
  setTimeout(() => emoji.remove(), 3000);
}

// Add float animation
const style = document.createElement('style');
style.textContent = `
  @keyframes floatUp {
    to {
      transform: translateY(-110vh) rotate(360deg);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// 2. Secret Logo Click Easter Egg
let logoClickCount = 0;
const brandMark = document.querySelector('.brand-mark');
if (brandMark) {
  brandMark.addEventListener('click', (e) => {
    if (e.shiftKey) {
      e.preventDefault();
      logoClickCount++;
      
      if (logoClickCount === 5) {
        document.body.style.cursor = 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><text y=\'24\' font-size=\'20\'>🎨</text></svg>"), auto';
        setStatus('🖌️ SECRET BRUSH MODE ACTIVATED', 'success');
        logoClickCount = 0;
        
        setTimeout(() => {
          document.body.style.cursor = '';
        }, 5000);
      }
    }
  });
}

// 3. Status Pill Secret Click
let statusClickCount = 0;
const statusPillEl = document.getElementById('statusPill');
if (statusPillEl) {
  statusPillEl.style.cursor = 'pointer';
  statusPillEl.addEventListener('click', () => {
    statusClickCount++;
    if (statusClickCount === 3) {
      const messages = [
        '✨ You found a secret!',
        '🎭 Keep exploring...',
        '🎪 Magic is everywhere',
        '🎯 Nice clicking!',
        '🎲 Roll the dice'
      ];
      setStatus(messages[Math.floor(Math.random() * messages.length)], 'success');
      statusClickCount = 0;
    }
  });
}

// 4. Console Secret Message
console.log('%c🎨 SECRET DISCOVERED! 🎨', 'font-size: 24px; font-weight: bold; color: #4a9eff;');
console.log('%cYou\'ve found the developer console!', 'font-size: 14px; color: #666;');
console.log('%cTry typing: showSecrets()', 'font-size: 14px; color: #4a9eff; font-style: italic;');

window.showSecrets = function() {
  console.log('%c🥚 EASTER EGGS FOUND:', 'font-size: 16px; font-weight: bold; color: #4a9eff;');
  console.log('%c1. Konami Code:', 'font-weight: bold;');
  console.log('   ↑ ↑ ↓ ↓ ← → ← → B A');
  console.log('   (Changes colors & spawns emojis)');
  console.log('%c2. Secret Logo:', 'font-weight: bold;');
  console.log('   Hold SHIFT and click logo 5 times');
  console.log('   (Changes cursor to brush)');
  console.log('%c3. Status Pill:', 'font-weight: bold;');
  console.log('   Click status pill 3 times');
  console.log('   (Shows random messages)');
  console.log('%c4. This Console:', 'font-weight: bold;');
  console.log('   You\'re looking at it right now!');
  
  return '🎉 All secrets revealed! Check console for details.';
};

// 5. Secret Key Combo - "Matrix Mode"
let matrixMode = false;
document.addEventListener('keydown', (event) => {
  // Ctrl/Cmd + Shift + M
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'M') {
    event.preventDefault();
    matrixMode = !matrixMode;
    
    if (matrixMode) {
      document.body.style.cssText += `
        filter: hue-rotate(90deg) contrast(1.2);
        font-family: 'Courier New', monospace !important;
      `;
      setStatus('💊 MATRIX MODE ENGAGED', 'success');
    } else {
      document.body.style.filter = '';
      document.body.style.fontFamily = '';
      setStatus('Loaded • ' + formatSyncTime(), 'success');
    }
  }
});

loadImages();
