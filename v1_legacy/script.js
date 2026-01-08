import { IMAGES, STORY_TEMPLATES } from './narrative_data.js';

let currentStory = [];
let selectedImages = [];
let storyCategory = null;
let isStoryEnded = false;
let usedTemplateIndices = {
    start: [],
    middle: [],
    end: []
};

const storyContentEl = document.getElementById('story-content');
const galleryEl = document.getElementById('image-gallery');
const sequenceEl = document.getElementById('selection-sequence');
const controlsEl = document.getElementById('story-controls');
const restartBtn = document.getElementById('restart-btn');
const endStoryBtn = document.getElementById('end-story-btn');
const shareStoryBtn = document.getElementById('share-story-btn');
const shareOverlay = document.getElementById('share-overlay');
const fullStoryTextEl = document.getElementById('full-story-text');
const closeModalBtn = document.getElementById('close-modal-btn');
const copyTextBtn = document.getElementById('copy-text-btn');
const galleryStatus = document.getElementById('gallery-status');

// Initialize Gallery
function initGallery() {
    galleryEl.innerHTML = '';
    IMAGES.forEach(img => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.dataset.id = img.id;
        item.innerHTML = `<img src="${img.url}" alt="${img.alt}" loading="lazy">`;
        item.addEventListener('click', () => handleImageSelect(img));
        galleryEl.appendChild(item);
    });
}

// Handle Image Selection
function handleImageSelect(image) {
    if (isStoryEnded) return;
    if (selectedImages.find(img => img.id === image.id)) return;

    selectedImages.push(image);
    updateGalleryUI(image.id);
    addThumbnailToSequence(image);

    if (selectedImages.length === 1) {
        startStory(image);
    } else {
        continueStory(image);
    }

    controlsEl.style.display = 'flex';
    restartBtn.style.display = 'block';
}

function updateGalleryUI(selectedId) {
    const items = galleryEl.querySelectorAll('.gallery-item');
    items.forEach(item => {
        if (item.dataset.id == selectedId) {
            item.classList.add('selected');
        }
    });
}

function addThumbnailToSequence(image) {
    const thumb = document.createElement('div');
    thumb.className = 'sequence-thumb';
    thumb.innerHTML = `<img src="${image.url}" alt="${image.alt}">`;
    sequenceEl.appendChild(thumb);
}

// Story Logic
function startStory(image) {
    // Pick category based on tags
    storyCategory = image.tags.includes('mystery') ? 'mystery' : 'adventure';

    const templates = STORY_TEMPLATES[storyCategory].start;
    const available = templates.map((_, i) => i).filter(i => !usedTemplateIndices.start.includes(i));
    const index = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * templates.length);

    usedTemplateIndices.start.push(index);
    const template = templates[index];
    const text = template.replace('[IMAGE_DESC]', `<strong>${image.desc}</strong>`);

    storyContentEl.innerHTML = ''; // Clear welcome message
    renderSegment(text);
    galleryStatus.innerText = "Keep going! What happens next?";
}

function continueStory(image) {
    const templates = STORY_TEMPLATES[storyCategory].middle;
    const available = templates.map((_, i) => i).filter(i => !usedTemplateIndices.middle.includes(i));

    // If we run out of unique templates, reset them (though unlikely in a short session)
    if (available.length === 0) usedTemplateIndices.middle = [];

    const index = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * templates.length);
    usedTemplateIndices.middle.push(index);

    const template = templates[index];
    const text = template.replace('[IMAGE_DESC]', `<strong>${image.desc}</strong>`);

    renderSegment(text);
}

function renderSegment(text) {
    const div = document.createElement('div');
    div.className = 'story-segment';
    div.innerHTML = text;
    storyContentEl.appendChild(div);
    currentStory.push(text.replace(/<\/?[^>]+(>|$)/g, "")); // Store plain text for sharing

    // Auto scroll to bottom
    const container = document.querySelector('.story-container');
    container.scrollTop = container.scrollHeight;
}

// End Story
endStoryBtn.addEventListener('click', () => {
    if (isStoryEnded) return;

    const lastImg = selectedImages[selectedImages.length - 1];
    const templates = STORY_TEMPLATES[storyCategory].end;
    const available = templates.map((_, i) => i).filter(i => !usedTemplateIndices.end.includes(i));
    const index = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : Math.floor(Math.random() * templates.length);

    usedTemplateIndices.end.push(index);
    const template = templates[index];
    const text = template.replace('[IMAGE_DESC]', `<strong>${lastImg.desc}</strong>`);

    renderSegment(text);
    isStoryEnded = true;
    galleryEl.style.opacity = '0.5';
    galleryEl.style.pointerEvents = 'none';
    galleryStatus.innerText = "The end. Your story is complete.";
    endStoryBtn.style.display = 'none';
});

// Restart
restartBtn.addEventListener('click', () => {
    location.reload(); // Simple way to reset state
});

// Share Story
shareStoryBtn.addEventListener('click', () => {
    fullStoryTextEl.innerText = currentStory.join('\n\n');
    shareOverlay.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
    shareOverlay.style.display = 'none';
});

copyTextBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentStory.join('\n\n')).then(() => {
        copyTextBtn.innerText = 'Copied!';
        setTimeout(() => copyTextBtn.innerText = 'Copy to Clipboard', 2000);
    });
});

// Initialize
initGallery();
