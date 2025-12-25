// PDF.js Configuration - Local worker for Electron
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

// State Management - Multi-Workspace System
const workspaces = [];
let activeWorkspaceId = null;
let workspaceCounter = 0;

// Create a new workspace state
function createWorkspaceState() {
    return {
        id: ++workspaceCounter,
        name: `Yeni Belge ${workspaceCounter}`,
        pdfDoc: null,
        currentPage: 1,
        totalPages: 0,
        zoom: 1.0,
        activeTool: 'replace',
        annotations: [],
        imageAnnotations: [],
        currentAnnotation: null,
        isDrawing: false,
        draggedAnnotation: null,
        draggedImage: null,
        dragOffsetX: 0,
        dragOffsetY: 0,
        startX: 0,
        startY: 0,
        editingIndex: null,
        originalFile: null,
        pendingImage: null,
        resizingAnnotation: null,
        resizingImage: null,
        resizeEdge: null,
        selectedAnnotation: null,
        selectedImage: null,
        currentViewport: { width: 1, height: 1 }
    };
}

// Current active workspace state accessor
function getState() {
    if (!activeWorkspaceId) return null;
    return workspaces.find(w => w.id === activeWorkspaceId);
}

// Legacy state object - points to active workspace for backward compatibility
const state = new Proxy({}, {
    get: (target, prop) => {
        const ws = getState();
        if (ws) return ws[prop];
        return undefined;
    },
    set: (target, prop, value) => {
        const ws = getState();
        if (ws) ws[prop] = value;
        return true;
    }
});

// Shared state (not per-workspace)
const sharedState = {
    apiKey: 'AIzaSyAwYD2lK1m0sMh6v7n4P2dPuqUrHMql1x0' // Default API key for font matching
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const canvasContainer = document.getElementById('canvasContainer');
const pdfCanvas = document.getElementById('pdfCanvas');
const annotationCanvas = document.getElementById('annotationCanvas');
const pdfCtx = pdfCanvas.getContext('2d');
const annotationCtx = annotationCanvas.getContext('2d');
const zoomInBtn = document.getElementById('zoomIn');
const zoomOutBtn = document.getElementById('zoomOut');
const zoomLevel = document.getElementById('zoomLevel');
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const currentPageDisplay = document.getElementById('currentPage');
const totalPagesDisplay = document.getElementById('totalPages');
const moveTool = document.getElementById('moveTool');
const replaceTool = document.getElementById('replaceTool');
const addTool = document.getElementById('addTool');
const addImageTool = document.getElementById('addImageTool');
const removeObjectTool = document.getElementById('removeObjectTool');
const imageInput = document.getElementById('imageInput');
// Sidebar Panel Elements (replacing modal)
const textEditorPanel = document.getElementById('textEditorPanel');
const textInput = document.getElementById('textInput');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeInput = document.getElementById('fontSize');
const textColorInput = document.getElementById('textColor');
const colorValueLabel = document.getElementById('colorValue');
const fontBoldCheckbox = document.getElementById('fontBold');
const fontItalicCheckbox = document.getElementById('fontItalic');
const alignLeftRadio = document.getElementById('alignLeft');
const alignCenterRadio = document.getElementById('alignCenter');
const alignRightRadio = document.getElementById('alignRight');
const pixelateTextCheckbox = document.getElementById('pixelateText');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const applyTextBtn = document.getElementById('applyTextBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const apiKeyInput = document.getElementById('apiKey');
const annotationsList = document.getElementById('annotationsList');
const downloadBtn = document.getElementById('downloadBtn');
// Tab Bar Elements
const tabsContainer = document.getElementById('tabsContainer');
// Ruler Elements (now divs with CSS patterns, no canvas)
const rulerHorizontal = document.getElementById('rulerHorizontal');
const rulerVertical = document.getElementById('rulerVertical');
// Guide Canvas (full screen overlay)
const guideCanvas = document.getElementById('guideCanvas');
const guideCtx = guideCanvas?.getContext('2d');

// ============================
// Tab Management Functions
// ============================

function createTab(name = null) {
    const ws = createWorkspaceState();
    if (name) ws.name = name;
    workspaces.push(ws);
    switchToTab(ws.id);
    renderTabs();
    return ws;
}

function switchToTab(workspaceId) {
    // Save current state before switching (already handled by proxy)
    activeWorkspaceId = workspaceId;

    const ws = getState();
    if (!ws) return;

    // Update UI to reflect workspace state
    if (ws.pdfDoc) {
        dropZone.style.display = 'none';
        canvasContainer.style.display = 'flex';
        renderPage(ws.currentPage);
        updatePageControls();
    } else {
        dropZone.style.display = 'flex';
        canvasContainer.style.display = 'none';
    }

    // Update tool highlighting
    setActiveTool(ws.activeTool);

    // Update zoom display
    zoomLevel.textContent = Math.round(ws.zoom * 100) + '%';

    // Update annotations list
    updateAnnotationsList();

    // Close text panel
    if (textEditorPanel) textEditorPanel.style.display = 'none';

    renderTabs();
}

function closeTab(workspaceId) {
    const index = workspaces.findIndex(w => w.id === workspaceId);
    if (index === -1) return;

    // Don't close if it's the only tab
    if (workspaces.length === 1) {
        // Reset to empty state instead
        const ws = workspaces[0];
        ws.pdfDoc = null;
        ws.annotations = [];
        ws.imageAnnotations = [];
        ws.name = 'Yeni Belge';
        dropZone.style.display = 'flex';
        canvasContainer.style.display = 'none';
        renderTabs();
        return;
    }

    workspaces.splice(index, 1);

    // Switch to another tab if we closed the active one
    if (activeWorkspaceId === workspaceId) {
        const newActive = workspaces[Math.min(index, workspaces.length - 1)];
        switchToTab(newActive.id);
    } else {
        renderTabs();
    }
}

function renderTabs() {
    tabsContainer.innerHTML = '';

    workspaces.forEach(ws => {
        const tab = document.createElement('div');
        tab.className = 'tab-item' + (ws.id === activeWorkspaceId ? ' active' : '');
        tab.innerHTML = `
            <span class="tab-title" title="${ws.name}">${ws.name}</span>
            <button class="tab-close" title="Sekmeyi Kapat">×</button>
        `;

        tab.querySelector('.tab-title').addEventListener('click', () => {
            switchToTab(ws.id);
        });

        tab.querySelector('.tab-close').addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(ws.id);
        });

        tabsContainer.appendChild(tab);
    });

    // Add the + button right after the last tab
    const addBtn = document.createElement('button');
    addBtn.className = 'tab-add-btn';
    addBtn.title = 'Yeni Sekme';
    addBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
    `;
    addBtn.addEventListener('click', () => createTab());
    tabsContainer.appendChild(addBtn);
}

// Initialize first tab
function initTabs() {
    createTab('Yeni Belge');
}

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);

// Zoom in 10% increments (10%, 20%, 30%, etc.)
zoomInBtn.addEventListener('click', () => {
    const newZoom = Math.round((state.zoom + 0.1) * 10) / 10;
    setZoom(newZoom);
});
zoomOutBtn.addEventListener('click', () => {
    const newZoom = Math.round((state.zoom - 0.1) * 10) / 10;
    setZoom(newZoom);
});
prevPageBtn.addEventListener('click', () => goToPage(state.currentPage - 1));
nextPageBtn.addEventListener('click', () => goToPage(state.currentPage + 1));

moveTool.addEventListener('click', () => setActiveTool('move'));
replaceTool.addEventListener('click', () => setActiveTool('replace'));
addTool.addEventListener('click', () => setActiveTool('add'));
removeObjectTool.addEventListener('click', () => setActiveTool('removeObject'));
addImageTool.addEventListener('click', () => {
    if (!state.pdfDoc) {
        alert('Lütfen önce bir PDF yükleyin.');
        return;
    }
    imageInput.click();
});
imageInput.addEventListener('change', handleImageSelect);

// Handle image file selection
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Lütfen geçerli bir görsel dosyası seçin.');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Store the image for placement
            state.pendingImage = {
                element: img,
                width: img.width,
                height: img.height,
                src: event.target.result
            };

            // Switch to image placement mode
            setActiveTool('placeImage');
            annotationCanvas.style.cursor = 'crosshair';

            console.log('Image loaded, ready for placement:', img.width, 'x', img.height);
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    imageInput.value = '';
}

annotationCanvas.addEventListener('mousedown', handleMouseDown);
annotationCanvas.addEventListener('mousemove', handleMouseMove);
annotationCanvas.addEventListener('mouseup', handleMouseUp);
annotationCanvas.addEventListener('dblclick', handleDoubleClick);

// Sidebar panel button event listeners
applyTextBtn.addEventListener('click', applyText);
cancelEditBtn.addEventListener('click', closeTextPanel);

// Eyedropper functionality
let eyedropperActive = false;
eyedropperBtn.addEventListener('click', () => {
    eyedropperActive = !eyedropperActive;
    eyedropperBtn.classList.toggle('active', eyedropperActive);
    if (eyedropperActive) {
        annotationCanvas.style.cursor = 'crosshair';
    } else {
        annotationCanvas.style.cursor = 'default';
    }
});

// Eyedropper color picking from canvas
annotationCanvas.addEventListener('click', (e) => {
    if (!eyedropperActive) return;

    const rect = pdfCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Get pixel color from PDF canvas
    const pixel = pdfCtx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(c => c.toString(16).padStart(2, '0')).join('');

    textColorInput.value = hex;
    colorValueLabel.textContent = hex.toUpperCase();

    // Deactivate eyedropper
    eyedropperActive = false;
    eyedropperBtn.classList.remove('active');
    annotationCanvas.style.cursor = 'default';

    // Update preview
    updateLivePreview();
});

// Real-time preview - update canvas when text input changes
textInput.addEventListener('input', updateLivePreview);
fontFamilySelect.addEventListener('change', updateLivePreview);
fontSizeInput.addEventListener('input', updateLivePreview);
textColorInput.addEventListener('input', (e) => {
    colorValueLabel.textContent = e.target.value.toUpperCase();
    updateLivePreview();
});
fontBoldCheckbox.addEventListener('change', updateLivePreview);

// Font weight cycling (0=normal, 1=semibold, 2=bold, 3=extrabold)
let currentFontWeight = 0;
const fontWeightLevels = [
    { weight: 400, label: 'Normal', css: 'normal' },       // 0 - Normal
    { weight: 600, label: 'Semibold', css: '600' },         // 1 - Semibold
    { weight: 700, label: 'Bold', css: 'bold' },            // 2 - Bold
    { weight: 800, label: 'Extrabold', css: '800' }         // 3 - Extrabold
];

fontBoldCheckbox.addEventListener('click', (e) => {
    e.preventDefault();
    currentFontWeight = (currentFontWeight + 1) % 4;
    fontBoldCheckbox.checked = currentFontWeight > 0;

    // Update button visual feedback
    const toggleBtn = fontBoldCheckbox.parentElement?.querySelector('.toggle-btn');
    if (toggleBtn) {
        toggleBtn.title = `Kalınlık: ${fontWeightLevels[currentFontWeight].label}`;
        toggleBtn.setAttribute('data-level', currentFontWeight);
    }

    updateLivePreview();
});
fontItalicCheckbox.addEventListener('change', updateLivePreview);
alignLeftRadio.addEventListener('change', updateLivePreview);
alignCenterRadio.addEventListener('change', updateLivePreview);
alignRightRadio.addEventListener('change', updateLivePreview);

// Pixelate level cycling (0=off, 1=light, 2=medium, 3=heavy)
let currentPixelateLevel = 0;
const pixelateLevels = [
    { scale: 1, label: 'Kapalı' },      // 0 - No pixelation
    { scale: 0.75, label: 'Hafif' },    // 1 - Light (75%)
    { scale: 0.5, label: 'Orta' },      // 2 - Medium (50%)
    { scale: 0.25, label: 'Yoğun' }     // 3 - Heavy (25%)
];

pixelateTextCheckbox.addEventListener('click', (e) => {
    e.preventDefault();
    currentPixelateLevel = (currentPixelateLevel + 1) % 4;
    pixelateTextCheckbox.checked = currentPixelateLevel > 0;

    // Update button visual feedback
    const toggleBtn = pixelateTextCheckbox.parentElement.querySelector('.toggle-btn');
    if (toggleBtn) {
        toggleBtn.title = `Piksellendir: ${pixelateLevels[currentPixelateLevel].label}`;
        toggleBtn.setAttribute('data-level', currentPixelateLevel);
    }

    updateLivePreview();
});

// Live preview function - updates annotation on canvas in real-time
function updateLivePreview() {
    if (!state.currentAnnotation) return;

    // Update current annotation with form values
    state.currentAnnotation.text = textInput.value;
    state.currentAnnotation.fontSize = parseInt(fontSizeInput.value) || 14;
    state.currentAnnotation.fontFamily = fontFamilySelect.value;
    state.currentAnnotation.color = textColorInput.value;
    state.currentAnnotation.fontWeight = currentFontWeight; // 0=normal, 1=semibold, 2=bold, 3=extrabold
    state.currentAnnotation.italic = fontItalicCheckbox.checked;
    state.currentAnnotation.textAlign = document.querySelector('input[name="textAlign"]:checked')?.value || 'left';
    state.currentAnnotation.pixelateLevel = currentPixelateLevel;

    // Redraw to show live preview
    redrawAnnotations();

    // Draw current annotation being edited
    drawAnnotationPreview(state.currentAnnotation);
}

// Helper function to wrap text with support for newlines (Enter key)
function wrapTextWithNewlines(ctx, text, maxWidth) {
    const lines = [];

    // First split by newline characters
    const paragraphs = text.split('\n');

    paragraphs.forEach(paragraph => {
        if (paragraph.trim() === '') {
            // Empty line (just Enter pressed)
            lines.push('');
            return;
        }

        // Word wrap each paragraph
        const words = paragraph.split(' ');
        let currentLine = '';

        words.forEach(word => {
            const testLine = currentLine + word + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine = testLine;
            }
        });

        if (currentLine.trim()) {
            lines.push(currentLine.trim());
        }
    });

    return lines;
}

// Draw annotation preview (for live editing)
function drawAnnotationPreview(ann) {
    if (!ann) return;

    // Draw background
    if (ann.type === 'replace') {
        annotationCtx.fillStyle = ann.backgroundColor || '#ffffff';
        annotationCtx.fillRect(ann.x, ann.y, ann.width, ann.height);
    }

    // Draw border
    annotationCtx.strokeStyle = '#667eea';
    annotationCtx.lineWidth = 2;
    annotationCtx.setLineDash([5, 5]);
    annotationCtx.strokeRect(ann.x, ann.y, ann.width, ann.height);
    annotationCtx.setLineDash([]);

    // Draw text
    if (ann.text) {
        const fontSize = ann.fontSize || 14;
        const lineHeight = fontSize * 1.4;
        const fontWeight = ann.fontWeight !== undefined ? fontWeightLevels[ann.fontWeight]?.css || 'normal' : (ann.bold ? 'bold' : 'normal');
        const style = ann.italic ? 'italic ' : '';
        const family = ann.fontFamily || 'Inter';
        const textAlign = ann.textAlign || 'left';
        const padding = 5;

        // Calculate text position
        let textX;
        if (textAlign === 'center') {
            textX = ann.width / 2;
        } else if (textAlign === 'right') {
            textX = ann.width - padding;
        } else {
            textX = padding;
        }

        // Calculate lines for word wrap (with newline support)
        annotationCtx.font = `${style}${fontWeight} ${fontSize}px "${family}"`;
        const lines = wrapTextWithNewlines(annotationCtx, ann.text, ann.width - 10);

        // Calculate vertical centering
        const totalTextHeight = lines.length * lineHeight;
        const startY = (ann.height - totalTextHeight) / 2 + fontSize;

        if (ann.pixelateLevel && ann.pixelateLevel > 0) {
            // Pixelated text rendering - draw at low resolution then scale up
            const scale = pixelateLevels[ann.pixelateLevel].scale;
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = Math.ceil(ann.width * scale);
            tempCanvas.height = Math.ceil(ann.height * scale);
            const tempCtx = tempCanvas.getContext('2d');

            // Disable smoothing for crisp pixels
            tempCtx.imageSmoothingEnabled = false;

            // Scale down context
            tempCtx.scale(scale, scale);

            // Draw text at lower resolution
            tempCtx.fillStyle = ann.color || '#000000';
            tempCtx.font = `${style}${fontWeight} ${fontSize}px "${family}"`;
            tempCtx.textAlign = textAlign;

            lines.forEach((line, index) => {
                tempCtx.fillText(line, textX, startY + index * lineHeight);
            });

            // Draw scaled-up pixelated result
            annotationCtx.imageSmoothingEnabled = false;
            annotationCtx.drawImage(tempCanvas, ann.x, ann.y, ann.width, ann.height);
            annotationCtx.imageSmoothingEnabled = true;
        } else {
            // Normal text rendering
            annotationCtx.fillStyle = ann.color || '#000000';
            annotationCtx.font = `${style}${fontWeight} ${fontSize}px "${family}"`;
            annotationCtx.textAlign = textAlign;

            lines.forEach((line, index) => {
                annotationCtx.fillText(line, ann.x + textX, ann.y + startY + index * lineHeight);
            });
        }

        annotationCtx.textAlign = 'left';
    }
}

// Resize edge detection threshold
const RESIZE_HANDLE_SIZE = 8;

// Helper function to detect which resize edge/corner is being hovered
// x, y are screen coordinates, ann has base coordinates
function getResizeEdge(x, y, ann) {
    if (!ann) return null;

    // Convert annotation base coordinates to screen coordinates
    const screenAnn = baseToScreen(ann.x, ann.y, ann.width, ann.height);
    const sx = screenAnn.x;
    const sy = screenAnn.y;
    const sw = screenAnn.width;
    const sh = screenAnn.height;

    const handles = RESIZE_HANDLE_SIZE;
    const onLeft = Math.abs(x - sx) <= handles;
    const onRight = Math.abs(x - (sx + sw)) <= handles;
    const onTop = Math.abs(y - sy) <= handles;
    const onBottom = Math.abs(y - (sy + sh)) <= handles;
    const inHorizontalRange = x >= sx - handles && x <= sx + sw + handles;
    const inVerticalRange = y >= sy - handles && y <= sy + sh + handles;

    // Corners first (higher priority)
    if (onTop && onLeft && inHorizontalRange && inVerticalRange) return 'nw';
    if (onTop && onRight && inHorizontalRange && inVerticalRange) return 'ne';
    if (onBottom && onLeft && inHorizontalRange && inVerticalRange) return 'sw';
    if (onBottom && onRight && inHorizontalRange && inVerticalRange) return 'se';

    // Edges
    if (onLeft && inVerticalRange) return 'w';
    if (onRight && inVerticalRange) return 'e';
    if (onTop && inHorizontalRange) return 'n';
    if (onBottom && inHorizontalRange) return 's';

    return null;
}

// Get cursor for resize edge
function getResizeCursor(edge) {
    switch (edge) {
        case 'n': case 's': return 'ns-resize';
        case 'e': case 'w': return 'ew-resize';
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        default: return null;
    }
}

// Double click to select annotation for resizing
function handleDoubleClick(e) {
    if (state.activeTool !== 'move') return;

    const rect = annotationCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coords to base for comparison
    const baseX = screenToBaseValue(x);
    const baseY = screenToBaseValue(y);

    // Find clicked text annotation (using base coordinates)
    const clickedAnnotation = state.annotations
        .filter(ann => ann.page === state.currentPage)
        .slice().reverse()
        .find(ann =>
            baseX >= ann.x && baseX <= ann.x + ann.width &&
            baseY >= ann.y && baseY <= ann.y + ann.height
        );

    // Find clicked image annotation (using base coordinates)
    const clickedImage = state.imageAnnotations
        .filter(img => img.page === state.currentPage)
        .slice().reverse()
        .find(img =>
            baseX >= img.x && baseX <= img.x + img.width &&
            baseY >= img.y && baseY <= img.y + img.height
        );

    // Prefer image if both overlap (images are on top)
    const selectedItem = clickedImage || clickedAnnotation;

    if (selectedItem) {
        // Toggle selection
        if (state.selectedAnnotation === selectedItem) {
            state.selectedAnnotation = null;
            state.selectedImage = null;
        } else {
            if (clickedImage) {
                state.selectedImage = clickedImage;
                state.selectedAnnotation = null;
            } else {
                state.selectedAnnotation = clickedAnnotation;
                state.selectedImage = null;
            }
        }
        redrawAnnotations();
        console.log('Selected for resize:', state.selectedAnnotation ? 'annotation' : (state.selectedImage ? 'image' : 'none'));
    } else {
        // Clicked outside - deselect
        state.selectedAnnotation = null;
        state.selectedImage = null;
        redrawAnnotations();
    }
}

textColorInput.addEventListener('input', (e) => {
    colorValueLabel.textContent = e.target.value.toUpperCase();
});

apiKeyInput.addEventListener('change', (e) => {
    sharedState.apiKey = e.target.value;
    localStorage.setItem('pdfEditorApiKey', e.target.value);
    updateApiStatus();
});

apiKeyInput.addEventListener('input', (e) => {
    sharedState.apiKey = e.target.value;
    updateApiStatus();
});

const toggleApiKeyBtn = document.getElementById('toggleApiKey');
toggleApiKeyBtn.addEventListener('click', () => {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);

    // Update icon based on state
    if (type === 'text') {
        toggleApiKeyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M1 1l22 22"></path>
            </svg>
        `;
    } else {
        toggleApiKeyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        `;
    }
});

// API Status Functions
const apiStatus = document.getElementById('apiStatus');
const testApiBtn = document.getElementById('testApiBtn');

function updateApiStatus(status = null, message = null) {
    const dot = apiStatus.querySelector('.status-dot');
    const text = apiStatus.querySelector('.status-text');

    if (status) {
        dot.className = 'status-dot ' + status;
        text.textContent = message;
    } else {
        // Auto-detect based on API key presence
        if (sharedState.apiKey && sharedState.apiKey.length > 10) {
            dot.className = 'status-dot inactive';
            text.textContent = 'API anahtarı girildi (test edilmedi)';
        } else {
            dot.className = 'status-dot inactive';
            text.textContent = 'API anahtarı girilmedi';
        }
    }
}

testApiBtn.addEventListener('click', async () => {
    if (!sharedState.apiKey || sharedState.apiKey.length < 10) {
        updateApiStatus('error', 'Lütfen önce bir API anahtarı girin');
        return;
    }

    updateApiStatus('testing', 'Test ediliyor...');

    try {
        // Use gemini-2.0-flash model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${sharedState.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Say "Hello" in Turkish.' }]
                }]
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.candidates && data.candidates.length > 0) {
                updateApiStatus('active', 'API aktif ve çalışıyor ✓');
                localStorage.setItem('pdfEditorApiKey', sharedState.apiKey);
                console.log('API Test successful:', data.candidates[0].content.parts[0].text);
            } else {
                updateApiStatus('error', 'API yanıt verdi ama boş');
            }
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Test failed:', response.status, errorData);
            if (response.status === 404) {
                updateApiStatus('error', 'Model bulunamadı - API anahtarını kontrol edin');
            } else if (response.status === 400) {
                updateApiStatus('error', 'Geçersiz istek - API anahtarı hatalı olabilir');
            } else if (response.status === 403) {
                updateApiStatus('error', 'Erişim reddedildi - API anahtarı yetkisiz');
            } else if (response.status === 429) {
                updateApiStatus('error', 'Limit aşıldı - 1-2 dk bekleyip tekrar deneyin');
            } else {
                updateApiStatus('error', `Hata: ${response.status}`);
            }
        }
    } catch (error) {
        console.error('API Test error:', error);
        updateApiStatus('error', 'Bağlantı hatası');
    }
});

// Load saved API key or use default
const savedApiKey = localStorage.getItem('pdfEditorApiKey');
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    sharedState.apiKey = savedApiKey;
} else {
    // Use default API key
    apiKeyInput.value = sharedState.apiKey;
}
updateApiStatus();

console.log('PDF Editor Ready. API Key status:', sharedState.apiKey ? 'Set' : 'Missing');



// File Handling
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    }
}

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Lütfen geçerli bir PDF dosyası yükleyin.');
        return;
    }

    // Store the original file for later download
    state.originalFile = file;

    // Update tab name with file name
    const ws = getState();
    if (ws) {
        ws.name = file.name.replace('.pdf', '').substring(0, 25);
        renderTabs();
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        await loadPDF(arrayBuffer);
    } catch (error) {
        console.error('File reading error:', error);
        alert('Dosya okunurken hata oluştu.');
    }
}

// PDF Loading
async function loadPDF(arrayBuffer) {
    console.log('loadPDF called, arrayBuffer size:', arrayBuffer.byteLength);
    try {
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

        state.pdfDoc = await loadingTask.promise;
        state.totalPages = state.pdfDoc.numPages;
        state.currentPage = 1;

        console.log('PDF loaded successfully. Pages:', state.totalPages);

        dropZone.style.display = 'none';
        canvasContainer.style.display = 'flex';

        // Enable download button
        downloadBtn.disabled = false;
        console.log('Download button enabled:', !downloadBtn.disabled);

        // Calculate fit-to-screen zoom
        const firstPage = await state.pdfDoc.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1 });

        // Get available canvas area (accounting for rulers and padding)
        const canvasWrapper = document.querySelector('.canvas-wrapper');
        // Less padding (60px) for tighter fit - 20px ruler + 40px margin
        const availableWidth = canvasWrapper.clientWidth - 60;
        const availableHeight = canvasWrapper.clientHeight - 60;

        // Calculate zoom to fit (1.5 is the internal render scale factor)
        const scaleX = availableWidth / (baseViewport.width * 1.5);
        const scaleY = availableHeight / (baseViewport.height * 1.5);
        const fitZoom = Math.min(scaleX, scaleY);

        // Round to nearest 10% (using Math.round for better fit, not floor)
        let roundedZoom = Math.round(fitZoom * 10) / 10;
        // Clamp between 10% and 100%
        state.zoom = Math.max(0.1, Math.min(roundedZoom, 1.0));
        zoomLevel.textContent = Math.round(state.zoom * 100) + '%';

        console.log('Fit zoom calculated:', state.zoom, 'from fitZoom:', fitZoom);

        await renderPage(state.currentPage);
        updatePageControls();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('PDF yüklenirken bir hata oluştu. Lütfen geçerli bir PDF dosyası seçin.');
    }
}

// PDF Rendering
async function renderPage(pageNum) {
    try {
        const page = await state.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: state.zoom * 1.5 });

        // Store current viewport dimensions
        state.currentViewport = { width: viewport.width, height: viewport.height };

        // Setup canvases
        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        annotationCanvas.width = viewport.width;
        annotationCanvas.height = viewport.height;

        // Render PDF
        const renderContext = {
            canvasContext: pdfCtx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Redraw annotations
        redrawAnnotations();

        // Rulers are now CSS-based, no need to draw them
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// Guide lines state - positions stored as percentages (0-1)
const guideLines = {
    horizontal: [], // Array of Y positions (as percentage 0-1)
    vertical: [],   // Array of X positions (as percentage 0-1)
    tempHorizontal: null, // Temporary guide while dragging (pixel)
    tempVertical: null,
    selectedGuide: null, // { type: 'horizontal' | 'vertical', index: number }
    isDragging: false
};

// Draw guide lines on full-screen guide canvas
function drawGuideLines() {
    if (!guideCtx || !guideCanvas) return;

    // Get the wrapper dimensions for full-screen guides
    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    // Resize guide canvas to match wrapper
    guideCanvas.width = width;
    guideCanvas.height = height;

    // Clear previous guides
    guideCtx.clearRect(0, 0, width, height);

    // Solid lines, no dash
    guideCtx.setLineDash([]);

    // Horizontal guides (red) - stored as percentage, draw as pixels
    guideLines.horizontal.forEach((yPercent, index) => {
        const y = yPercent * height;
        const isSelected = guideLines.selectedGuide?.type === 'horizontal' && guideLines.selectedGuide?.index === index;
        guideCtx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 1)' : 'rgba(239, 68, 68, 0.6)';
        guideCtx.lineWidth = isSelected ? 2 : 1;
        guideCtx.beginPath();
        guideCtx.moveTo(0, y);
        guideCtx.lineTo(width, y);
        guideCtx.stroke();
    });

    // Vertical guides (red) - stored as percentage, draw as pixels
    guideLines.vertical.forEach((xPercent, index) => {
        const x = xPercent * width;
        const isSelected = guideLines.selectedGuide?.type === 'vertical' && guideLines.selectedGuide?.index === index;
        guideCtx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 1)' : 'rgba(239, 68, 68, 0.6)';
        guideCtx.lineWidth = isSelected ? 2 : 1;
        guideCtx.beginPath();
        guideCtx.moveTo(x, 0);
        guideCtx.lineTo(x, height);
        guideCtx.stroke();
    });

    // Draw temporary guide while dragging (lighter)
    guideCtx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    guideCtx.lineWidth = 1;

    if (guideLines.tempHorizontal !== null) {
        guideCtx.beginPath();
        guideCtx.moveTo(0, guideLines.tempHorizontal);
        guideCtx.lineTo(width, guideLines.tempHorizontal);
        guideCtx.stroke();
    }

    if (guideLines.tempVertical !== null) {
        guideCtx.beginPath();
        guideCtx.moveTo(guideLines.tempVertical, 0);
        guideCtx.lineTo(guideLines.tempVertical, height);
        guideCtx.stroke();
    }
}

// Check if a point is near a guide line (for selection)
// Takes canvas coordinates and converts to wrapper coordinates
function getGuideAtPoint(canvasX, canvasY, threshold = 10) {
    const wrapper = document.querySelector('.canvas-wrapper');
    const canvasHolder = document.querySelector('.canvas-holder');
    if (!wrapper || !canvasHolder) return null;

    const wrapperRect = wrapper.getBoundingClientRect();
    const canvasRect = annotationCanvas.getBoundingClientRect();

    // Convert canvas coords to wrapper coords
    const wrapperX = (canvasRect.left - wrapperRect.left) + canvasX;
    const wrapperY = (canvasRect.top - wrapperRect.top) + canvasY;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    // Check vertical guides (stored as percentage)
    for (let i = 0; i < guideLines.vertical.length; i++) {
        const guideX = guideLines.vertical[i] * width;
        if (Math.abs(guideX - wrapperX) <= threshold) {
            return { type: 'vertical', index: i };
        }
    }
    // Check horizontal guides (stored as percentage)
    for (let i = 0; i < guideLines.horizontal.length; i++) {
        const guideY = guideLines.horizontal[i] * height;
        if (Math.abs(guideY - wrapperY) <= threshold) {
            return { type: 'horizontal', index: i };
        }
    }
    return null;
}

// Ruler drag events for guide lines
let rulerDragType = null; // 'horizontal' or 'vertical'

// Top ruler (rulerHorizontal) → creates HORIZONTAL guides
if (rulerHorizontal) {
    rulerHorizontal.addEventListener('mousedown', (e) => {
        rulerDragType = 'horizontal';
        guideLines.isDragging = true;
        const canvasRect = annotationCanvas.getBoundingClientRect();
        guideLines.tempHorizontal = 0; // Start at top
        redrawAnnotations();
    });

    rulerHorizontal.style.cursor = 'row-resize';
}

// Left ruler (rulerVertical) → creates VERTICAL guides
if (rulerVertical) {
    rulerVertical.addEventListener('mousedown', (e) => {
        rulerDragType = 'vertical';
        guideLines.isDragging = true;
        const canvasRect = annotationCanvas.getBoundingClientRect();
        guideLines.tempVertical = 0; // Start at left
        redrawAnnotations();
    });

    rulerVertical.style.cursor = 'col-resize';
}

// Global mouse events for drag
document.addEventListener('mousemove', (e) => {
    if (!guideLines.isDragging) return;

    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    if (rulerDragType === 'vertical') {
        guideLines.tempVertical = e.clientX - wrapperRect.left;
        guideLines.tempHorizontal = null;
    } else if (rulerDragType === 'horizontal') {
        guideLines.tempHorizontal = e.clientY - wrapperRect.top;
        guideLines.tempVertical = null;
    }

    drawGuideLines();
});

document.addEventListener('mouseup', (e) => {
    if (!guideLines.isDragging) return;

    const wrapper = document.querySelector('.canvas-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    // Only add guide if released over the wrapper area
    if (e.clientX >= wrapperRect.left && e.clientX <= wrapperRect.right &&
        e.clientY >= wrapperRect.top && e.clientY <= wrapperRect.bottom) {

        // Save as percentage (0-1) for zoom independence
        if (rulerDragType === 'vertical' && guideLines.tempVertical !== null) {
            guideLines.vertical.push(guideLines.tempVertical / width);
        } else if (rulerDragType === 'horizontal' && guideLines.tempHorizontal !== null) {
            guideLines.horizontal.push(guideLines.tempHorizontal / height);
        }
    }

    guideLines.tempVertical = null;
    guideLines.tempHorizontal = null;
    guideLines.isDragging = false;
    rulerDragType = null;
    drawGuideLines();
});

// Keyboard handler for deleting selected guide
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete if no input is focused
        if (document.activeElement.tagName === 'INPUT' ||
            document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        // Delete selected guide
        if (guideLines.selectedGuide) {
            if (guideLines.selectedGuide.type === 'vertical') {
                guideLines.vertical.splice(guideLines.selectedGuide.index, 1);
            } else {
                guideLines.horizontal.splice(guideLines.selectedGuide.index, 1);
            }
            guideLines.selectedGuide = null;
            redrawAnnotations();
            e.preventDefault();
        }
    }
});

// ============================
// Coordinate Conversion Helpers
// ============================
// All annotations are stored in BASE coordinates (zoom=1.0, scale=1.5)
// Screen coordinates = base coordinates * zoom
// Base coordinates = screen coordinates / zoom

// Convert screen coordinates to base coordinates (for storing)
function screenToBase(x, y, width, height) {
    const zoom = state.zoom;
    return {
        x: x / zoom,
        y: y / zoom,
        width: width !== undefined ? width / zoom : undefined,
        height: height !== undefined ? height / zoom : undefined
    };
}

// Convert base coordinates to screen coordinates (for rendering)
function baseToScreen(x, y, width, height) {
    const zoom = state.zoom;
    return {
        x: x * zoom,
        y: y * zoom,
        width: width !== undefined ? width * zoom : undefined,
        height: height !== undefined ? height * zoom : undefined
    };
}

// Convert a single value from screen to base
function screenToBaseValue(value) {
    return value / state.zoom;
}

// Convert a single value from base to screen
function baseToScreenValue(value) {
    return value * state.zoom;
}

// Zoom Control
// Annotations are stored in BASE coordinates (zoom=1.0)
// They are scaled during rendering, not during zoom changes
function setZoom(newZoom) {
    if (newZoom >= 0.1 && newZoom <= 3.0) {
        state.zoom = newZoom;
        zoomLevel.textContent = Math.round(newZoom * 100) + '%';

        // Clear selection to avoid stale references
        state.selectedAnnotation = null;
        state.selectedImage = null;

        renderPage(state.currentPage);
    }
}

// Page Navigation
function goToPage(pageNum) {
    if (pageNum >= 1 && pageNum <= state.totalPages) {
        state.currentPage = pageNum;
        renderPage(pageNum);
        updatePageControls();
    }
}

function updatePageControls() {
    currentPageDisplay.textContent = state.currentPage;
    totalPagesDisplay.textContent = state.totalPages;
    prevPageBtn.disabled = state.currentPage === 1;
    nextPageBtn.disabled = state.currentPage === state.totalPages;
}

// Tool Selection
function setActiveTool(tool) {
    state.activeTool = tool;

    moveTool.classList.toggle('active', tool === 'move');
    replaceTool.classList.toggle('active', tool === 'replace');
    addTool.classList.toggle('active', tool === 'add');
    addImageTool.classList.toggle('active', tool === 'placeImage');
    removeObjectTool.classList.toggle('active', tool === 'removeObject');

    if (tool === 'move') {
        annotationCanvas.style.cursor = 'default';
    } else if (tool === 'placeImage') {
        annotationCanvas.style.cursor = 'copy';
    } else {
        annotationCanvas.style.cursor = 'crosshair';
    }
}

// Mouse Event Handlers
function handleMouseDown(e) {
    if (!state.pdfDoc) return;

    const rect = annotationCanvas.getBoundingClientRect();
    state.startX = (e.clientX - rect.left);
    state.startY = (e.clientY - rect.top);
    state.isDrawing = true;

    if (state.activeTool === 'move') {
        // Check if starting to resize selected annotation
        if (state.selectedAnnotation && state.selectedAnnotation.page === state.currentPage) {
            const edge = getResizeEdge(state.startX, state.startY, state.selectedAnnotation);
            if (edge) {
                state.resizingAnnotation = state.selectedAnnotation;
                state.resizeEdge = edge;
                annotationCanvas.style.cursor = getResizeCursor(edge);
                console.log('Starting resize from edge:', edge);
                return;
            }
        }

        // Check if starting to resize selected image
        if (state.selectedImage && state.selectedImage.page === state.currentPage) {
            const edge = getResizeEdge(state.startX, state.startY, state.selectedImage);
            if (edge) {
                state.resizingImage = state.selectedImage;
                state.resizeEdge = edge;
                // Store original aspect ratio for proportional resizing
                state.originalAspectRatio = state.selectedImage.width / state.selectedImage.height;
                annotationCanvas.style.cursor = getResizeCursor(edge);
                console.log('Starting image resize from edge:', edge, 'aspect ratio:', state.originalAspectRatio);
                return;
            }
        }

        // Check if clicked on an image annotation (check images first - they're on top)
        // Convert screen coords to base for comparison
        const baseStartX = screenToBaseValue(state.startX);
        const baseStartY = screenToBaseValue(state.startY);

        const clickedImage = state.imageAnnotations
            .filter(img => img.page === state.currentPage)
            .slice().reverse()
            .find(img =>
                baseStartX >= img.x &&
                baseStartX <= img.x + img.width &&
                baseStartY >= img.y &&
                baseStartY <= img.y + img.height
            );

        if (clickedImage) {
            state.draggedImage = clickedImage;
            // Store offset in base coordinates
            state.dragOffsetX = baseStartX - clickedImage.x;
            state.dragOffsetY = baseStartY - clickedImage.y;
            annotationCanvas.style.cursor = 'grabbing';
            return;
        }

        // Check if clicked on an existing text annotation
        const clickedAnnotation = state.annotations
            .filter(ann => ann.page === state.currentPage)
            .slice().reverse() // Check top-most first
            .find(ann =>
                baseStartX >= ann.x &&
                baseStartX <= ann.x + ann.width &&
                baseStartY >= ann.y &&
                baseStartY <= ann.y + ann.height
            );

        if (clickedAnnotation) {
            state.draggedAnnotation = clickedAnnotation;
            // Store offset in base coordinates
            state.dragOffsetX = baseStartX - clickedAnnotation.x;
            state.dragOffsetY = baseStartY - clickedAnnotation.y;
            annotationCanvas.style.cursor = 'grabbing';
            return;
        }

        // Check if clicked on a guide line
        const clickedGuide = getGuideAtPoint(state.startX, state.startY);
        if (clickedGuide) {
            guideLines.selectedGuide = clickedGuide;
            redrawAnnotations();
            return;
        }

        // Clear guide selection if clicked elsewhere
        if (guideLines.selectedGuide) {
            guideLines.selectedGuide = null;
            redrawAnnotations();
        }
    }

    if (state.activeTool === 'replace' || state.activeTool === 'add') {
        // Store in BASE coordinates (divide by zoom)
        const baseCoords = screenToBase(state.startX, state.startY);
        state.currentAnnotation = {
            x: baseCoords.x,
            y: baseCoords.y,
            width: 0,
            height: 0,
            page: state.currentPage,
            text: '',
            type: state.activeTool // 'replace' or 'add'
        };
    }

    // Image placement mode
    if (state.activeTool === 'placeImage' && state.pendingImage) {
        // Store in BASE coordinates
        const baseCoords = screenToBase(state.startX, state.startY);
        state.currentAnnotation = {
            x: baseCoords.x,
            y: baseCoords.y,
            width: 0,
            height: 0,
            page: state.currentPage,
            type: 'image'
        };
    }

    // Remove object mode
    if (state.activeTool === 'removeObject') {
        // Store in BASE coordinates
        const baseCoords = screenToBase(state.startX, state.startY);
        state.currentAnnotation = {
            x: baseCoords.x,
            y: baseCoords.y,
            width: 0,
            height: 0,
            page: state.currentPage,
            type: 'removeObject'
        };
    }
}

function handleMouseMove(e) {
    const rect = annotationCanvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left);
    const currentY = (e.clientY - rect.top);

    // Handle Resizing - use base coordinates
    if (state.resizingAnnotation) {
        const ann = state.resizingAnnotation;
        const edge = state.resizeEdge;
        const minSize = screenToBaseValue(20); // Minimum in base coords

        // Convert screen mouse position to base coordinates
        const baseCurrentX = screenToBaseValue(currentX);
        const baseCurrentY = screenToBaseValue(currentY);

        // Calculate new dimensions based on which edge is being dragged
        if (edge.includes('n')) {
            const newHeight = ann.y + ann.height - baseCurrentY;
            if (newHeight >= minSize) {
                ann.y = baseCurrentY;
                ann.height = newHeight;
            }
        }
        if (edge.includes('s')) {
            const newHeight = baseCurrentY - ann.y;
            if (newHeight >= minSize) {
                ann.height = newHeight;
            }
        }
        if (edge.includes('w')) {
            const newWidth = ann.x + ann.width - baseCurrentX;
            if (newWidth >= minSize) {
                ann.x = baseCurrentX;
                ann.width = newWidth;
            }
        }
        if (edge.includes('e')) {
            const newWidth = baseCurrentX - ann.x;
            if (newWidth >= minSize) {
                ann.width = newWidth;
            }
        }

        redrawAnnotations();
        return;
    }

    // Handle Image Resizing
    if (state.resizingImage) {
        const img = state.resizingImage;
        const edge = state.resizeEdge;
        const minSize = 20; // Minimum width/height

        if (state.croppingImage === img) {
            // Masking/Framing Crop Mode
            const originalWidth = img.originalWidth || img.element.naturalWidth;
            const originalHeight = img.originalHeight || img.element.naturalHeight;

            // Initialize crop values if needed
            if (img.cropLeft === undefined) img.cropLeft = 0;
            if (img.cropTop === undefined) img.cropTop = 0;
            if (img.cropRight === undefined) img.cropRight = 0;
            if (img.cropBottom === undefined) img.cropBottom = 0;

            // Calculate current scale (screen pixels per image pixel) - CONSTANT DURING CROP
            const currentVisibleWidth = originalWidth - img.cropLeft - img.cropRight;
            const currentVisibleHeight = originalHeight - img.cropTop - img.cropBottom;

            // Protect against zero division
            const scaleX = currentVisibleWidth > 0 ? img.width / currentVisibleWidth : 1;
            const scaleY = currentVisibleHeight > 0 ? img.height / currentVisibleHeight : 1;

            const minVisibleRaw = 10 / scaleX; // Minimum 10px visible on screen converted to image pixels logic or just screen check

            if (edge.includes('w')) {
                // Dragging Left Handle: Changes x, width, and cropLeft
                const deltaX = currentX - img.x;
                const newWidth = img.width - deltaX;

                if (newWidth >= 20) { // Min screen width
                    const newVisibleImageWidth = newWidth / scaleX;
                    const newCropLeft = originalWidth - img.cropRight - newVisibleImageWidth;

                    if (newCropLeft >= 0) {
                        img.x = currentX;
                        img.width = newWidth;
                        img.cropLeft = newCropLeft;
                    }
                }
            }
            else if (edge.includes('e')) {
                // Dragging Right Handle: Changes width and cropRight
                const deltaX = currentX - (img.x + img.width);
                const newWidth = img.width + deltaX;

                if (newWidth >= 20) {
                    const newVisibleImageWidth = newWidth / scaleX;
                    const newCropRight = originalWidth - img.cropLeft - newVisibleImageWidth;

                    if (newCropRight >= 0) {
                        img.width = newWidth;
                        img.cropRight = newCropRight;
                    }
                }
            }

            if (edge.includes('n')) {
                // Dragging Top Handle: Changes y, height, and cropTop
                const deltaY = currentY - img.y;
                const newHeight = img.height - deltaY;

                if (newHeight >= 20) {
                    const newVisibleImageHeight = newHeight / scaleY;
                    const newCropTop = originalHeight - img.cropBottom - newVisibleImageHeight;

                    if (newCropTop >= 0) {
                        img.y = currentY;
                        img.height = newHeight;
                        img.cropTop = newCropTop;
                    }
                }
            }
            else if (edge.includes('s')) {
                // Dragging Bottom Handle: Changes height and cropBottom
                const deltaY = currentY - (img.y + img.height);
                const newHeight = img.height + deltaY;

                if (newHeight >= 20) {
                    const newVisibleImageHeight = newHeight / scaleY;
                    const newCropBottom = originalHeight - img.cropTop - newVisibleImageHeight;

                    if (newCropBottom >= 0) {
                        img.height = newHeight;
                        img.cropBottom = newCropBottom;
                    }
                }
            }

            redrawAnnotations();
            return;
        }

        // Check if it's a corner (diagonal) resize - maintain aspect ratio
        const isCorner = (edge === 'nw' || edge === 'ne' || edge === 'sw' || edge === 'se');

        if (isCorner && state.originalAspectRatio) {
            // Maintain aspect ratio for corner resizing
            const aspectRatio = state.originalAspectRatio;

            if (edge === 'se') {
                // Bottom-right corner - resize from fixed top-left
                const deltaX = currentX - img.x;
                const deltaY = currentY - img.y;

                // Use the larger delta to determine new size
                if (Math.abs(deltaX) > Math.abs(deltaY * aspectRatio)) {
                    const newWidth = Math.max(minSize, deltaX);
                    img.width = newWidth;
                    img.height = newWidth / aspectRatio;
                } else {
                    const newHeight = Math.max(minSize, deltaY);
                    img.height = newHeight;
                    img.width = newHeight * aspectRatio;
                }
            } else if (edge === 'nw') {
                // Top-left corner - resize from fixed bottom-right
                const rightX = img.x + img.width;
                const bottomY = img.y + img.height;
                const deltaX = rightX - currentX;
                const deltaY = bottomY - currentY;

                if (Math.abs(deltaX) > Math.abs(deltaY * aspectRatio)) {
                    const newWidth = Math.max(minSize, deltaX);
                    img.width = newWidth;
                    img.height = newWidth / aspectRatio;
                    img.x = rightX - newWidth;
                    img.y = bottomY - img.height;
                } else {
                    const newHeight = Math.max(minSize, deltaY);
                    img.height = newHeight;
                    img.width = newHeight * aspectRatio;
                    img.x = rightX - img.width;
                    img.y = bottomY - newHeight;
                }
            } else if (edge === 'ne') {
                // Top-right corner - resize from fixed bottom-left
                const bottomY = img.y + img.height;
                const deltaX = currentX - img.x;
                const deltaY = bottomY - currentY;

                if (Math.abs(deltaX) > Math.abs(deltaY * aspectRatio)) {
                    const newWidth = Math.max(minSize, deltaX);
                    img.width = newWidth;
                    img.height = newWidth / aspectRatio;
                    img.y = bottomY - img.height;
                } else {
                    const newHeight = Math.max(minSize, deltaY);
                    img.height = newHeight;
                    img.width = newHeight * aspectRatio;
                    img.y = bottomY - newHeight;
                }
            } else if (edge === 'sw') {
                // Bottom-left corner - resize from fixed top-right
                const rightX = img.x + img.width;
                const deltaX = rightX - currentX;
                const deltaY = currentY - img.y;

                if (Math.abs(deltaX) > Math.abs(deltaY * aspectRatio)) {
                    const newWidth = Math.max(minSize, deltaX);
                    img.width = newWidth;
                    img.height = newWidth / aspectRatio;
                    img.x = rightX - newWidth;
                } else {
                    const newHeight = Math.max(minSize, deltaY);
                    img.height = newHeight;
                    img.width = newHeight * aspectRatio;
                    img.x = rightX - img.width;
                }
            }
        } else {
            // Free resize for edge handles (n, s, e, w)
            if (edge.includes('n')) {
                const newHeight = img.y + img.height - currentY;
                if (newHeight >= minSize) {
                    img.y = currentY;
                    img.height = newHeight;
                }
            }
            if (edge.includes('s')) {
                const newHeight = currentY - img.y;
                if (newHeight >= minSize) {
                    img.height = newHeight;
                }
            }
            if (edge.includes('w')) {
                const newWidth = img.x + img.width - currentX;
                if (newWidth >= minSize) {
                    img.x = currentX;
                    img.width = newWidth;
                }
            }
            if (edge.includes('e')) {
                const newWidth = currentX - img.x;
                if (newWidth >= minSize) {
                    img.width = newWidth;
                }
            }
        }

        redrawAnnotations();
        return;
    }

    // Handle Dragging (text annotations) - use base coordinates
    if (state.draggedAnnotation) {
        const baseCurrentX = screenToBaseValue(currentX);
        const baseCurrentY = screenToBaseValue(currentY);
        state.draggedAnnotation.x = baseCurrentX - state.dragOffsetX;
        state.draggedAnnotation.y = baseCurrentY - state.dragOffsetY;
        redrawAnnotations();
        return;
    }

    // Handle Image Dragging - use base coordinates
    if (state.draggedImage) {
        const baseCurrentX = screenToBaseValue(currentX);
        const baseCurrentY = screenToBaseValue(currentY);
        state.draggedImage.x = baseCurrentX - state.dragOffsetX;
        state.draggedImage.y = baseCurrentY - state.dragOffsetY;
        redrawAnnotations();
        return;
    }

    // Hover effect for move tool - show resize cursors when hovering edges of selected annotation/image
    if (state.activeTool === 'move' && !state.draggedAnnotation && !state.draggedImage && !state.resizingAnnotation && !state.resizingImage) {
        // Check resize cursor for selected annotation
        if (state.selectedAnnotation && state.selectedAnnotation.page === state.currentPage) {
            const edge = getResizeEdge(currentX, currentY, state.selectedAnnotation);
            if (edge) {
                annotationCanvas.style.cursor = getResizeCursor(edge);
                return;
            }
        }

        // Check resize cursor for selected image
        if (state.selectedImage && state.selectedImage.page === state.currentPage) {
            const edge = getResizeEdge(currentX, currentY, state.selectedImage);
            if (edge) {
                annotationCanvas.style.cursor = getResizeCursor(edge);
                return;
            }
        }

        // Check for hover on any image - convert to base for comparison
        const baseCurrentX = screenToBaseValue(currentX);
        const baseCurrentY = screenToBaseValue(currentY);

        const hoveringImage = state.imageAnnotations.some(img =>
            img.page === state.currentPage &&
            baseCurrentX >= img.x &&
            baseCurrentX <= img.x + img.width &&
            baseCurrentY >= img.y &&
            baseCurrentY <= img.y + img.height
        );

        // Check for regular hover on any text annotation
        const hoveringAnnotation = state.annotations.some(ann =>
            ann.page === state.currentPage &&
            baseCurrentX >= ann.x &&
            baseCurrentX <= ann.x + ann.width &&
            baseCurrentY >= ann.y &&
            baseCurrentY <= ann.y + ann.height
        );

        annotationCanvas.style.cursor = (hoveringImage || hoveringAnnotation) ? 'grab' : 'default';
        return;
    }

    if (!state.isDrawing) return;

    // Handle image placement drawing
    if (state.activeTool === 'placeImage' && state.currentAnnotation) {
        // Width and height in BASE coordinates
        state.currentAnnotation.width = screenToBaseValue(currentX - state.startX);
        state.currentAnnotation.height = screenToBaseValue(currentY - state.startY);

        redrawAnnotations();
        // Draw image preview rectangle - convert back to screen coords for drawing
        const screenCoords = baseToScreen(
            state.currentAnnotation.x,
            state.currentAnnotation.y,
            state.currentAnnotation.width,
            state.currentAnnotation.height
        );
        annotationCtx.strokeStyle = '#48bb78'; // Green for images
        annotationCtx.lineWidth = 2;
        annotationCtx.setLineDash([5, 5]);
        annotationCtx.strokeRect(
            screenCoords.x,
            screenCoords.y,
            screenCoords.width,
            screenCoords.height
        );
        annotationCtx.setLineDash([]);
        return;
    }

    // Handle removeObject drawing
    if (state.activeTool === 'removeObject' && state.currentAnnotation) {
        // Width and height in BASE coordinates
        state.currentAnnotation.width = screenToBaseValue(currentX - state.startX);
        state.currentAnnotation.height = screenToBaseValue(currentY - state.startY);

        redrawAnnotations();
        // Draw red dashed rectangle for removal - convert to screen coords
        const screenCoords = baseToScreen(
            state.currentAnnotation.x,
            state.currentAnnotation.y,
            state.currentAnnotation.width,
            state.currentAnnotation.height
        );
        annotationCtx.strokeStyle = '#f56565'; // Red for removal
        annotationCtx.lineWidth = 2;
        annotationCtx.setLineDash([5, 5]);
        annotationCtx.strokeRect(
            screenCoords.x,
            screenCoords.y,
            screenCoords.width,
            screenCoords.height
        );
        annotationCtx.setLineDash([]);

        // Fill with semi-transparent red
        annotationCtx.fillStyle = 'rgba(245, 101, 101, 0.2)';
        annotationCtx.fillRect(
            screenCoords.x,
            screenCoords.y,
            screenCoords.width,
            screenCoords.height
        );
        return;
    }

    if (state.activeTool !== 'replace' && state.activeTool !== 'add') return;
    if (!state.currentAnnotation) return;

    // Width and height in BASE coordinates
    state.currentAnnotation.width = screenToBaseValue(currentX - state.startX);
    state.currentAnnotation.height = screenToBaseValue(currentY - state.startY);

    redrawAnnotations();
    // Draw dashed rect - convert to screen coords
    const screenCoords = baseToScreen(
        state.currentAnnotation.x,
        state.currentAnnotation.y,
        state.currentAnnotation.width,
        state.currentAnnotation.height
    );
    drawDashedRect(
        screenCoords.x,
        screenCoords.y,
        screenCoords.width,
        screenCoords.height
    );
}

function handleMouseUp(e) {
    if (!state.isDrawing) return;

    state.isDrawing = false;

    // Handle resize end
    if (state.resizingAnnotation) {
        console.log('Resize complete');
        state.resizingAnnotation = null;
        state.resizeEdge = null;
        annotationCanvas.style.cursor = 'default';
        redrawAnnotations();
        updateAnnotationsList();
        return;
    }

    // Handle image resize end
    if (state.resizingImage) {
        console.log('Image resize complete');
        state.resizingImage = null;
        state.resizeEdge = null;
        state.originalAspectRatio = null; // Clear aspect ratio
        annotationCanvas.style.cursor = 'default';
        redrawAnnotations();
        updateAnnotationsList();
        return;
    }

    if (state.draggedAnnotation) {
        state.draggedAnnotation = null;
        annotationCanvas.style.cursor = 'grab';
        return;
    }

    if (state.draggedImage) {
        state.draggedImage = null;
        annotationCanvas.style.cursor = 'grab';
        return;
    }

    // Handle image placement
    if (state.activeTool === 'placeImage' && state.pendingImage && state.currentAnnotation) {
        // Normalize dimensions
        if (state.currentAnnotation.width < 0) {
            state.currentAnnotation.x += state.currentAnnotation.width;
            state.currentAnnotation.width = Math.abs(state.currentAnnotation.width);
        }
        if (state.currentAnnotation.height < 0) {
            state.currentAnnotation.y += state.currentAnnotation.height;
            state.currentAnnotation.height = Math.abs(state.currentAnnotation.height);
        }

        // Only add if area is significant
        if (state.currentAnnotation.width > 20 && state.currentAnnotation.height > 20) {
            // Calculate fitting dimensions while maintaining aspect ratio
            const imgAspect = state.pendingImage.width / state.pendingImage.height;
            const boxAspect = state.currentAnnotation.width / state.currentAnnotation.height;

            let finalWidth, finalHeight, finalX, finalY;

            if (imgAspect > boxAspect) {
                // Image is wider - fit to width
                finalWidth = state.currentAnnotation.width;
                finalHeight = state.currentAnnotation.width / imgAspect;
                finalX = state.currentAnnotation.x;
                finalY = state.currentAnnotation.y + (state.currentAnnotation.height - finalHeight) / 2;
            } else {
                // Image is taller - fit to height
                finalHeight = state.currentAnnotation.height;
                finalWidth = state.currentAnnotation.height * imgAspect;
                finalX = state.currentAnnotation.x + (state.currentAnnotation.width - finalWidth) / 2;
                finalY = state.currentAnnotation.y;
            }

            const imageAnnotation = {
                type: 'image',
                page: state.currentPage,
                x: finalX,
                y: finalY,
                width: finalWidth,
                height: finalHeight,
                originalWidth: state.pendingImage.width,
                originalHeight: state.pendingImage.height,
                src: state.pendingImage.src,
                element: state.pendingImage.element
            };

            state.imageAnnotations.push(imageAnnotation);
            console.log('Image placed with aspect ratio preserved:', imageAnnotation);

            // Clear pending image and switch back to move tool
            state.pendingImage = null;
            state.currentAnnotation = null;
            setActiveTool('move');

            redrawAnnotations();
            updateAnnotationsList();
        } else {
            state.currentAnnotation = null;
            redrawAnnotations();
        }
        return;
    }

    // Handle removeObject - detect background color and create fill
    if (state.activeTool === 'removeObject' && state.currentAnnotation) {
        // Normalize dimensions
        if (state.currentAnnotation.width < 0) {
            state.currentAnnotation.x += state.currentAnnotation.width;
            state.currentAnnotation.width = Math.abs(state.currentAnnotation.width);
        }
        if (state.currentAnnotation.height < 0) {
            state.currentAnnotation.y += state.currentAnnotation.height;
            state.currentAnnotation.height = Math.abs(state.currentAnnotation.height);
        }

        // Only process if area is significant
        if (state.currentAnnotation.width > 10 && state.currentAnnotation.height > 10) {
            // Detect background color from the selected region
            const backgroundColor = detectBackgroundColor(state.currentAnnotation);
            console.log('Detected background color:', backgroundColor);

            // Create annotation that covers the area with detected background
            const removeAnnotation = {
                type: 'removeObject',
                page: state.currentPage,
                x: state.currentAnnotation.x,
                y: state.currentAnnotation.y,
                width: state.currentAnnotation.width,
                height: state.currentAnnotation.height,
                backgroundColor: backgroundColor
            };

            state.annotations.push(removeAnnotation);
            console.log('Object removal created:', removeAnnotation);

            state.currentAnnotation = null;
            redrawAnnotations();
            updateAnnotationsList();
        } else {
            state.currentAnnotation = null;
            redrawAnnotations();
        }
        return;
    }

    if ((state.activeTool === 'replace' || state.activeTool === 'add') && state.currentAnnotation) {
        // Normalize dimensions (handle negative width/height)
        if (state.currentAnnotation.width < 0) {
            state.currentAnnotation.x += state.currentAnnotation.width;
            state.currentAnnotation.width = Math.abs(state.currentAnnotation.width);
        }
        if (state.currentAnnotation.height < 0) {
            state.currentAnnotation.y += state.currentAnnotation.height;
            state.currentAnnotation.height = Math.abs(state.currentAnnotation.height);
        }

        // Only show modal if selection is significant
        if (state.currentAnnotation.width > 10 && state.currentAnnotation.height > 10) {
            // Detect background color for replace mode (so we can cover with the right color)
            if (state.activeTool === 'replace') {
                const backgroundColor = detectBackgroundColor(state.currentAnnotation);
                state.currentAnnotation.backgroundColor = backgroundColor;
                console.log('Detected background color for replace:', backgroundColor);
            }
            showTextModal();
        } else {
            state.currentAnnotation = null;
            redrawAnnotations();
        }
    }
}

// Detect background color from a region - samples from corners which are usually background
function detectBackgroundColor(annotation) {
    try {
        const x = Math.round(annotation.x);
        const y = Math.round(annotation.y);
        const w = Math.round(annotation.width);
        const h = Math.round(annotation.height);

        // Sample points: 4 corners + 4 edge midpoints
        const samplePoints = [
            [0, 0],           // Top-left corner
            [w - 1, 0],       // Top-right corner
            [0, h - 1],       // Bottom-left corner
            [w - 1, h - 1],   // Bottom-right corner
            [Math.floor(w / 2), 0],         // Top center
            [Math.floor(w / 2), h - 1],     // Bottom center
            [0, Math.floor(h / 2)],         // Left center
            [w - 1, Math.floor(h / 2)]      // Right center
        ];

        const imageData = pdfCtx.getImageData(x, y, w, h);
        const pixels = imageData.data;

        let totalR = 0, totalG = 0, totalB = 0;
        let validSamples = 0;

        for (const [px, py] of samplePoints) {
            if (px >= 0 && px < w && py >= 0 && py < h) {
                const i = (py * w + px) * 4;
                const r = pixels[i];
                const g = pixels[i + 1];
                const b = pixels[i + 2];
                const a = pixels[i + 3];

                // Only count non-transparent pixels
                if (a >= 128) {
                    totalR += r;
                    totalG += g;
                    totalB += b;
                    validSamples++;
                }
            }
        }

        // Calculate average color
        let bgColor = '#ffffff'; // Default white

        if (validSamples > 0) {
            const avgR = Math.round(totalR / validSamples);
            const avgG = Math.round(totalG / validSamples);
            const avgB = Math.round(totalB / validSamples);

            bgColor = '#' + [avgR, avgG, avgB].map(c => c.toString(16).padStart(2, '0')).join('');
        }

        console.log('Background color detected:', bgColor, '(from', validSamples, 'samples)');
        return bgColor;
    } catch (error) {
        console.error('Error detecting background color:', error);
        return '#ffffff'; // Default to white
    }
}

// Drawing Functions
function drawDashedRect(x, y, width, height) {
    annotationCtx.strokeStyle = '#667eea';
    annotationCtx.lineWidth = 2;
    annotationCtx.setLineDash([5, 5]);
    annotationCtx.strokeRect(x, y, width, height);
    annotationCtx.setLineDash([]);
    // No fill - only dashed border
}

function redrawAnnotations() {
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    // Draw saved annotations for current page
    state.annotations
        .filter(ann => ann.page === state.currentPage)
        .forEach(ann => {
            // Convert base coordinates to screen coordinates for rendering
            const screen = baseToScreen(ann.x, ann.y, ann.width, ann.height);
            const sx = screen.x;
            const sy = screen.y;
            const sw = screen.width;
            const sh = screen.height;
            const screenFontSize = ann.fontSize ? baseToScreenValue(ann.fontSize) : 14 * state.zoom;

            // If removeObject mode, fill with detected background color
            if (ann.type === 'removeObject') {
                annotationCtx.fillStyle = ann.backgroundColor || '#ffffff';
                annotationCtx.fillRect(sx, sy, sw, sh);
                // Only draw border if selected
                if (state.selectedAnnotation === ann) {
                    annotationCtx.strokeStyle = 'rgba(245, 101, 101, 0.5)';
                    annotationCtx.lineWidth = 2;
                    annotationCtx.setLineDash([3, 3]);
                    annotationCtx.strokeRect(sx, sy, sw, sh);
                    annotationCtx.setLineDash([]);
                }
                return; // Don't draw anything else for removeObject
            }

            // If replace mode, draw background first (detected or white fallback)
            if (ann.type === 'replace') {
                annotationCtx.fillStyle = ann.backgroundColor || '#ffffff';
                annotationCtx.fillRect(sx, sy, sw, sh);
            }

            // Only draw dashed border if this annotation is selected
            if (state.selectedAnnotation === ann) {
                drawDashedRect(sx, sy, sw, sh);
            }

            // Draw text if exists
            if (ann.text) {
                const fontWeight = ann.fontWeight !== undefined ? fontWeightLevels[ann.fontWeight]?.css || 'normal' : (ann.bold ? 'bold' : 'normal');
                const style = ann.italic ? 'italic ' : '';
                const family = ann.fontFamily || 'Inter';
                // Use screen-scaled font size
                const fontSize = screenFontSize;
                const lineHeight = fontSize * 1.4;
                const textAlign = ann.textAlign || 'left';
                const padding = 5 * state.zoom;

                annotationCtx.font = `${style}${fontWeight} ${fontSize}px "${family}"`;

                // Calculate x position based on alignment using screen coordinates
                let textXRel; // Relative to annotation
                let textXAbs; // Absolute position
                if (textAlign === 'center') {
                    textXRel = sw / 2;
                    textXAbs = sx + sw / 2;
                } else if (textAlign === 'right') {
                    textXRel = sw - padding;
                    textXAbs = sx + sw - padding;
                } else {
                    textXRel = padding;
                    textXAbs = sx + padding;
                }

                // First pass: calculate number of lines for vertical centering (with newline support)
                const lines = wrapTextWithNewlines(annotationCtx, ann.text, sw - 10 * state.zoom);

                // Calculate vertical centering
                const totalTextHeight = lines.length * lineHeight;
                const startYRel = (sh - totalTextHeight) / 2 + fontSize;
                const startYAbs = sy + startYRel;

                if (ann.pixelateLevel && ann.pixelateLevel > 0) {
                    // Pixelated text rendering - draw at low resolution then scale up
                    const scale = pixelateLevels[ann.pixelateLevel].scale;
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = Math.ceil(sw * scale);
                    tempCanvas.height = Math.ceil(sh * scale);
                    const tempCtx = tempCanvas.getContext('2d');

                    // Disable smoothing for crisp pixels
                    tempCtx.imageSmoothingEnabled = false;

                    // Scale down context
                    tempCtx.scale(scale, scale);

                    // Draw text at lower resolution
                    tempCtx.fillStyle = ann.color || '#000000';
                    tempCtx.font = `${style}${fontWeight} ${fontSize}px "${family}"`;
                    tempCtx.textAlign = textAlign;

                    lines.forEach((line, index) => {
                        tempCtx.fillText(line, textXRel, startYRel + index * lineHeight);
                    });

                    // Draw scaled-up pixelated result
                    annotationCtx.imageSmoothingEnabled = false;
                    annotationCtx.drawImage(tempCanvas, sx, sy, sw, sh);
                    annotationCtx.imageSmoothingEnabled = true;
                } else {
                    // Normal text rendering
                    annotationCtx.fillStyle = ann.color || '#000000';
                    annotationCtx.textAlign = textAlign;

                    lines.forEach((line, index) => {
                        annotationCtx.fillText(line, textXAbs, startYAbs + index * lineHeight);
                    });
                }

                // Reset text alignment to default
                annotationCtx.textAlign = 'left';
            }
        });

    // Draw image annotations for current page
    state.imageAnnotations
        .filter(img => img.page === state.currentPage)
        .forEach(img => {
            // Convert base coordinates to screen coordinates for rendering
            const screenImg = baseToScreen(img.x, img.y, img.width, img.height);
            const imgSx = screenImg.x;
            const imgSy = screenImg.y;
            const imgSw = screenImg.width;
            const imgSh = screenImg.height;

            // Calculate source rectangle (for cropping)
            const srcX = img.cropLeft || 0;
            const srcY = img.cropTop || 0;
            const srcWidth = (img.originalWidth || img.element.naturalWidth) - (img.cropLeft || 0) - (img.cropRight || 0);
            const srcHeight = (img.originalHeight || img.element.naturalHeight) - (img.cropTop || 0) - (img.cropBottom || 0);

            // Draw the image with crop applied - use screen coordinates for destination
            annotationCtx.drawImage(
                img.element,
                srcX, srcY, srcWidth, srcHeight,  // Source rectangle
                imgSx, imgSy, imgSw, imgSh  // Destination rectangle (screen coords)
            );

            // Draw border - orange for crop mode, green otherwise
            if (state.croppingImage === img) {
                annotationCtx.strokeStyle = '#f6993f'; // Orange for crop mode
                annotationCtx.lineWidth = 3;
            } else {
                annotationCtx.strokeStyle = '#48bb78'; // Green
                annotationCtx.lineWidth = 2;
            }
            annotationCtx.setLineDash([]);
            annotationCtx.strokeRect(imgSx, imgSy, imgSw, imgSh);
        });

    // Draw resize handles for selected annotation
    if (state.selectedAnnotation && state.selectedAnnotation.page === state.currentPage) {
        const ann = state.selectedAnnotation;
        // Convert base to screen coordinates
        const screenAnn = baseToScreen(ann.x, ann.y, ann.width, ann.height);
        const sax = screenAnn.x;
        const say = screenAnn.y;
        const saw = screenAnn.width;
        const sah = screenAnn.height;

        const handleSize = RESIZE_HANDLE_SIZE;
        const halfHandle = handleSize / 2;

        // Highlight selected annotation with thicker border
        annotationCtx.strokeStyle = '#667eea';
        annotationCtx.lineWidth = 3;
        annotationCtx.setLineDash([]);
        annotationCtx.strokeRect(sax, say, saw, sah);

        // Draw resize handles (small squares at corners and edges)
        annotationCtx.fillStyle = '#667eea';

        // Corner handles
        // Top-left
        annotationCtx.fillRect(sax - halfHandle, say - halfHandle, handleSize, handleSize);
        // Top-right
        annotationCtx.fillRect(sax + saw - halfHandle, say - halfHandle, handleSize, handleSize);
        // Bottom-left
        annotationCtx.fillRect(sax - halfHandle, say + sah - halfHandle, handleSize, handleSize);
        // Bottom-right
        annotationCtx.fillRect(sax + saw - halfHandle, say + sah - halfHandle, handleSize, handleSize);

        // Edge handles (middle of each edge)
        // Top
        annotationCtx.fillRect(sax + saw / 2 - halfHandle, say - halfHandle, handleSize, handleSize);
        // Bottom
        annotationCtx.fillRect(sax + saw / 2 - halfHandle, say + sah - halfHandle, handleSize, handleSize);
        // Left
        annotationCtx.fillRect(sax - halfHandle, say + sah / 2 - halfHandle, handleSize, handleSize);
        // Right
        annotationCtx.fillRect(sax + saw - halfHandle, say + sah / 2 - halfHandle, handleSize, handleSize);

        // Add white border to handles for visibility
        annotationCtx.strokeStyle = '#ffffff';
        annotationCtx.lineWidth = 1;

        // Corner handle borders
        annotationCtx.strokeRect(sax - halfHandle, say - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax + saw - halfHandle, say - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax - halfHandle, say + sah - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax + saw - halfHandle, say + sah - halfHandle, handleSize, handleSize);

        // Edge handle borders
        annotationCtx.strokeRect(sax + saw / 2 - halfHandle, say - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax + saw / 2 - halfHandle, say + sah - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax - halfHandle, say + sah / 2 - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(sax + saw - halfHandle, say + sah / 2 - halfHandle, handleSize, handleSize);
    }

    // Draw resize handles for selected image
    if (state.selectedImage && state.selectedImage.page === state.currentPage) {
        const img = state.selectedImage;
        // Convert base to screen coordinates
        const screenImg = baseToScreen(img.x, img.y, img.width, img.height);
        const six = screenImg.x;
        const siy = screenImg.y;
        const siw = screenImg.width;
        const sih = screenImg.height;

        const handleSize = RESIZE_HANDLE_SIZE;
        const halfHandle = handleSize / 2;

        // Highlight selected image with thicker border
        annotationCtx.strokeStyle = '#48bb78'; // Green for images
        annotationCtx.lineWidth = 3;
        annotationCtx.setLineDash([]);
        annotationCtx.strokeRect(six, siy, siw, sih);

        // Draw resize handles (small squares at corners and edges)
        annotationCtx.fillStyle = '#48bb78';

        // Corner handles
        // Top-left
        annotationCtx.fillRect(six - halfHandle, siy - halfHandle, handleSize, handleSize);
        // Top-right
        annotationCtx.fillRect(six + siw - halfHandle, siy - halfHandle, handleSize, handleSize);
        // Bottom-left
        annotationCtx.fillRect(six - halfHandle, siy + sih - halfHandle, handleSize, handleSize);
        // Bottom-right
        annotationCtx.fillRect(six + siw - halfHandle, siy + sih - halfHandle, handleSize, handleSize);

        // Edge handles (middle of each edge)
        // Top
        annotationCtx.fillRect(six + siw / 2 - halfHandle, siy - halfHandle, handleSize, handleSize);
        // Bottom
        annotationCtx.fillRect(six + siw / 2 - halfHandle, siy + sih - halfHandle, handleSize, handleSize);
        // Left
        annotationCtx.fillRect(six - halfHandle, siy + sih / 2 - halfHandle, handleSize, handleSize);
        // Right
        annotationCtx.fillRect(six + siw - halfHandle, siy + sih / 2 - halfHandle, handleSize, handleSize);

        // Add white border to handles for visibility
        annotationCtx.strokeStyle = '#ffffff';
        annotationCtx.lineWidth = 1;

        // Corner handle borders
        annotationCtx.strokeRect(six - halfHandle, siy - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six + siw - halfHandle, siy - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six - halfHandle, siy + sih - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six + siw - halfHandle, siy + sih - halfHandle, handleSize, handleSize);

        // Edge handle borders
        annotationCtx.strokeRect(six + siw / 2 - halfHandle, siy - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six + siw / 2 - halfHandle, siy + sih - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six - halfHandle, siy + sih / 2 - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(six + siw - halfHandle, siy + sih / 2 - halfHandle, handleSize, handleSize);
    }

    // Draw guide lines
    drawGuideLines();
}

// Panel Functions (replacing modal)
function showTextPanel() {
    textEditorPanel.style.display = 'block';
    textInput.value = '';

    // Reset defaults
    fontFamilySelect.value = 'Inter';
    fontSizeInput.value = '14';
    textColorInput.value = '#000000';
    colorValueLabel.textContent = '#000000';
    fontBoldCheckbox.checked = false;
    currentFontWeight = 0; // Reset font weight level
    fontItalicCheckbox.checked = false;
    alignLeftRadio.checked = true; // Default to left alignment
    pixelateTextCheckbox.checked = false; // Default to no pixelation
    currentPixelateLevel = 0; // Reset pixelation level

    // Reset pixelate button title
    const pixelateToggleBtn = pixelateTextCheckbox.parentElement?.querySelector('.toggle-btn');
    if (pixelateToggleBtn) {
        pixelateToggleBtn.title = 'Piksellendir: Kapalı';
        pixelateToggleBtn.setAttribute('data-level', '0');
    }

    // Reset bold button title
    const boldToggleBtn = fontBoldCheckbox.parentElement?.querySelector('.toggle-btn');
    if (boldToggleBtn) {
        boldToggleBtn.title = 'Kalınlık: Normal';
        boldToggleBtn.setAttribute('data-level', '0');
    }

    textInput.focus();

    // Scroll panel into view
    textEditorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTextPanel() {
    textEditorPanel.style.display = 'none';
    if (state.currentAnnotation && !state.currentAnnotation.text && state.editingIndex === null) {
        state.currentAnnotation = null;
        redrawAnnotations();
    }
}

// Alias for backward compatibility
function showTextModal() { showTextPanel(); }
function closeTextModal() { closeTextPanel(); }

async function applyText() {
    const text = textInput.value.trim();
    const useAI = document.getElementById('useAI').checked;

    if (!text) {
        alert('Lütfen metin girin.');
        return;
    }

    if (!state.currentAnnotation) return;

    // Save properties
    state.currentAnnotation.text = text;
    state.currentAnnotation.fontSize = parseInt(fontSizeInput.value) || 14;
    state.currentAnnotation.fontFamily = fontFamilySelect.value;
    state.currentAnnotation.color = textColorInput.value;
    state.currentAnnotation.fontWeight = currentFontWeight; // 0=normal, 1=semibold, 2=bold, 3=extrabold
    state.currentAnnotation.italic = fontItalicCheckbox.checked;
    // Save text alignment
    state.currentAnnotation.textAlign = document.querySelector('input[name="textAlign"]:checked')?.value || 'left';
    // Save pixelation level
    state.currentAnnotation.pixelateLevel = currentPixelateLevel;

    // Use AI to match font size
    if (useAI && state.apiKey) {
        try {
            await enhanceTextWithAI(state.currentAnnotation);
        } catch (error) {
            console.error('AI enhancement error:', error);
            // Non-blocking error
        }
    }

    // Add to annotations array or update existing
    if (state.editingIndex !== null) {
        state.annotations[state.editingIndex] = { ...state.currentAnnotation };
        state.editingIndex = null;
    } else {
        state.annotations.push({ ...state.currentAnnotation });
    }

    state.currentAnnotation = null;

    closeTextModal();
    redrawAnnotations();
    updateAnnotationsList();
}

// AI Integration
async function enhanceTextWithAI(annotation) {
    if (!sharedState.apiKey) return;

    // Show loading indicator
    textInput.setAttribute('placeholder', 'AI metin stilini analiz ediyor...');

    try {
        // Extract image data from the selected region
        const imageData = pdfCtx.getImageData(
            Math.round(annotation.x),
            Math.round(annotation.y),
            Math.round(annotation.width),
            Math.round(annotation.height)
        );

        // ===== PIXEL-BASED COLOR DETECTION =====
        // Analyze pixels to find the dominant text color (darkest non-white pixels)
        const pixels = imageData.data;
        const colorCounts = {};

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            // Skip transparent or very light pixels (background)
            const brightness = (r + g + b) / 3;
            if (a < 128 || brightness > 240) continue;

            // Group similar colors (quantize to reduce noise)
            const qr = Math.round(r / 16) * 16;
            const qg = Math.round(g / 16) * 16;
            const qb = Math.round(b / 16) * 16;
            const colorKey = `${qr},${qg},${qb}`;

            colorCounts[colorKey] = (colorCounts[colorKey] || 0) + 1;
        }

        // Find the most common dark color (text color)
        let dominantColor = '#000000';
        let maxCount = 0;

        for (const [colorKey, count] of Object.entries(colorCounts)) {
            const [r, g, b] = colorKey.split(',').map(Number);
            const brightness = (r + g + b) / 3;

            // Prefer darker colors (text) over lighter ones
            if (count > maxCount && brightness < 200) {
                maxCount = count;
                dominantColor = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
            }
        }

        console.log('Detected text color from pixels:', dominantColor);
        annotation.color = dominantColor;

        // ===== CONVERT TO BASE64 FOR AI =====
        const canvas = document.createElement('canvas');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        const ctx = canvas.getContext('2d');
        ctx.putImageData(imageData, 0, 0);
        const base64Image = canvas.toDataURL('image/png').split(',')[1];

        const prompt = `You are a typography expert. Analyze this image of text from a PDF document.

IMPORTANT MEASUREMENTS:
- Image width: ${Math.round(annotation.width)} pixels
- Image height: ${Math.round(annotation.height)} pixels

YOUR TASK: Detect the text properties with HIGH ACCURACY.

1. **fontSize**: Measure the approximate height of a capital letter in pixels. 
   - If the text fills most of the image height, fontSize ≈ image height * 0.7
   - Consider the actual character heights you see

2. **fontFamily**: Identify the font. Look for these characteristics:
   - Serif fonts (have small lines at ends): "Times New Roman", "Georgia"
   - Sans-serif fonts (clean edges): "Arial", "Helvetica", "Verdana", "Inter"
   - Monospace fonts (equal width): "Courier New"

3. **bold**: Is the text thicker/heavier than normal? true/false

4. **italic**: Is the text slanted? true/false

RESPOND WITH ONLY A JSON OBJECT, NO OTHER TEXT:
{"fontSize": number, "fontFamily": "string", "bold": boolean, "italic": boolean}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${sharedState.apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: 'image/png', data: base64Image } }
                    ]
                }]
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;
        console.log('AI Style Detection Response:', aiResponse);

        // Try to parse JSON from AI response
        try {
            // Extract JSON from response (handle markdown code blocks)
            let jsonStr = aiResponse;
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
            }

            const styleData = JSON.parse(jsonStr);

            // Apply detected styles to annotation
            if (styleData.fontSize) {
                annotation.fontSize = Math.max(8, Math.min(72, styleData.fontSize));
            }
            if (styleData.fontFamily) {
                annotation.fontFamily = styleData.fontFamily;
            }
            if (styleData.color && styleData.color.startsWith('#')) {
                annotation.color = styleData.color;
            }
            if (typeof styleData.bold === 'boolean') {
                annotation.bold = styleData.bold;
            }
            if (typeof styleData.italic === 'boolean') {
                annotation.italic = styleData.italic;
            }

            console.log('Detected styles:', styleData);

        } catch (parseError) {
            // Fallback: just extract font size
            console.warn('Could not parse full style, extracting font size only');
            const match = aiResponse.match(/\d+/);
            const fontSize = match ? parseInt(match[0]) : 14;
            annotation.fontSize = Math.max(8, Math.min(72, fontSize));
        }

        // Update UI if still editing this annotation
        if (state.currentAnnotation === annotation) {
            fontSizeInput.value = annotation.fontSize || 14;
            fontFamilySelect.value = annotation.fontFamily || 'Inter';
            textColorInput.value = annotation.color || '#000000';
            colorValueLabel.textContent = (annotation.color || '#000000').toUpperCase();
            fontBoldCheckbox.checked = annotation.bold || false;
            fontItalicCheckbox.checked = annotation.italic || false;
        }

        // Reset placeholder
        textInput.setAttribute('placeholder', 'Eklemek istediğiniz metni yazın...');

    } catch (error) {
        console.error('AI enhancement failed:', error);
        textInput.setAttribute('placeholder', 'AI hatası. Lütfen manuel girin.');
    }
}

// Annotations List
function updateAnnotationsList() {
    const totalItems = state.annotations.length + state.imageAnnotations.length;

    if (totalItems === 0) {
        annotationsList.innerHTML = '<p class="empty-state">Henüz düzenleme yok</p>';
        return;
    }

    let html = '';

    // Text annotations
    state.annotations.forEach((ann, index) => {
        html += '<div class="annotation-item" onclick="window.goToAnnotation(' + index + ')">';
        html += '<div>';
        html += '<div class="annotation-text">';

        // Determine badge text and type
        let badgeText = 'Ekle';
        let badgeClass = ann.type;
        if (ann.type === 'replace') {
            badgeText = 'Değiştir';
        } else if (ann.type === 'removeObject') {
            badgeText = 'Kaldır';
        } else if (ann.type === 'add') {
            badgeText = 'Ekle';
        }

        html += '<span class="badge ' + badgeClass + '">' + badgeText + '</span>';

        // Display text or description
        if (ann.type === 'removeObject') {
            html += 'Obje kaldırıldı';
        } else {
            html += (ann.text || 'Boş seçim');
        }

        html += '</div>';

        // Meta info
        if (ann.type === 'removeObject') {
            html += '<div class="annotation-meta">Sayfa ' + ann.page + ' • Arkaplan: ' + (ann.backgroundColor || '#fff') + '</div>';
        } else {
            html += '<div class="annotation-meta">Sayfa ' + ann.page + ' • Boyut: ' + Math.round(ann.fontSize || 14) + 'px</div>';
        }

        html += '</div>';
        html += '<div class="annotation-actions">';

        // Only show edit button for text annotations, not for removeObject
        if (ann.type !== 'removeObject') {
            html += '<button class="edit-btn" onclick="event.stopPropagation(); window.editAnnotation(' + index + ')" title="Düzenle">';
            html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
            html += '</button>';
        }

        html += '<button class="delete-btn" onclick="event.stopPropagation(); window.handleDelete(' + index + ')" title="Sil">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
    });

    // Image annotations
    state.imageAnnotations.forEach((img, index) => {
        html += '<div class="annotation-item" onclick="window.goToImageAnnotation(' + index + ')">';
        html += '<div>';
        html += '<div class="annotation-text">';
        html += '<span class="badge image">Görsel</span>';
        html += 'Görsel #' + (index + 1);
        html += '</div>';
        html += '<div class="annotation-meta">Sayfa ' + img.page + ' • ' + Math.round(img.width) + 'x' + Math.round(img.height) + 'px</div>';
        html += '</div>';
        html += '<div class="annotation-actions">';
        // Crop button
        const isCropping = state.croppingImage === img;
        const cropBtnClass = isCropping ? 'edit-btn active' : 'edit-btn';
        const cropTitle = isCropping ? 'Kırpmayı Tamamla' : 'Kırp';

        html += `<button class="${cropBtnClass}" onclick="event.stopPropagation(); window.startCropImage(${index})" title="${cropTitle}">`;
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">';
        html += '<path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>';
        html += '<path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>';
        html += '</svg>';
        html += '</button>';
        // Delete button
        html += '<button class="delete-btn" onclick="event.stopPropagation(); window.handleDeleteImage(' + index + ')" title="Sil">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
    });

    annotationsList.innerHTML = html;
}

// Delete handler
function handleDelete(index) {
    console.log('handleDelete called with index:', index);
    state.annotations.splice(index, 1);
    updateAnnotationsList();
    redrawAnnotations();
}
window.handleDelete = handleDelete;

// Delete image handler
function handleDeleteImage(index) {
    console.log('handleDeleteImage called with index:', index);
    state.imageAnnotations.splice(index, 1);
    updateAnnotationsList();
    redrawAnnotations();
}
window.handleDeleteImage = handleDeleteImage;

// Navigate to image annotation
function goToImageAnnotation(index) {
    const img = state.imageAnnotations[index];
    if (img && img.page !== state.currentPage) {
        goToPage(img.page);
    }
}
window.goToImageAnnotation = goToImageAnnotation;

// Start crop mode for image
function startCropImage(index) {
    const img = state.imageAnnotations[index];
    if (!img) return;

    // Navigate to image page if needed
    if (img.page !== state.currentPage) {
        goToPage(img.page);
    }

    // Toggle crop mode
    if (state.croppingImage === img) {
        // Exit crop mode
        state.croppingImage = null;
        // alert('Kırpma modu kapatıldı.'); // Removed alert for smoother UX
    } else {
        // Enter crop mode - select image and enable crop
        state.croppingImage = img;
        state.selectedImage = img;

        // Initialize crop region if not set
        if (img.cropLeft === undefined) img.cropLeft = 0;
        if (img.cropTop === undefined) img.cropTop = 0;
        if (img.cropRight === undefined) img.cropRight = 0;
        if (img.cropBottom === undefined) img.cropBottom = 0;

        // alert('...'); // Removed alert
    }

    updateAnnotationsList();
    redrawAnnotations();
}
window.startCropImage = startCropImage;

function editAnnotation(index) {
    state.editingIndex = index;
    const ann = state.annotations[index];

    // Set as current annotation (clone it)
    state.currentAnnotation = { ...ann };

    // Show panel instead of modal
    textEditorPanel.style.display = 'block';

    // Fill inputs
    textInput.value = ann.text || '';
    fontSizeInput.value = ann.fontSize || 14;
    fontFamilySelect.value = ann.fontFamily || 'Inter';
    textColorInput.value = ann.color || '#000000';
    colorValueLabel.textContent = (ann.color || '#000000').toUpperCase();
    fontBoldCheckbox.checked = ann.bold || false;
    fontItalicCheckbox.checked = ann.italic || false;

    // Set text alignment
    const alignment = ann.textAlign || 'left';
    if (alignment === 'center') {
        alignCenterRadio.checked = true;
    } else if (alignment === 'right') {
        alignRightRadio.checked = true;
    } else {
        alignLeftRadio.checked = true;
    }

    textInput.focus();

    // Scroll panel into view
    textEditorPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function goToAnnotation(index) {
    const annotation = state.annotations[index];
    if (annotation.page !== state.currentPage) {
        goToPage(annotation.page);
    }

    // Highlight the annotation briefly
    setTimeout(() => {
        annotationCtx.save();
        annotationCtx.strokeStyle = '#f093fb';
        annotationCtx.lineWidth = 3;
        annotationCtx.strokeRect(annotation.x - 2, annotation.y - 2, annotation.width + 4, annotation.height + 4);
        annotationCtx.restore();

        setTimeout(() => redrawAnnotations(), 1000);
    }, 100);
}

// Download PDF using pdf-lib
downloadBtn.addEventListener('click', async () => {
    if (!state.pdfDoc) return;

    console.log('Download initiated. Original file:', state.originalFile ? 'Present' : 'Missing');

    try {
        // Access PDFLib via window object to ensure it's found
        const PDFLib = window.PDFLib;
        console.log('PDFLib loaded:', !!PDFLib);
        if (!PDFLib) throw new Error('PDF-Lib kütüphanesi yüklenemedi.');

        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        console.log('PDFLib components extracted');

        // Load existing PDF
        const file = state.originalFile;
        if (!file) {
            alert('Lütfen önce bir PDF dosyası yükleyin.');
            return;
        }

        console.log('Loading PDF for editing...');
        const arrayBuffer = await file.arrayBuffer();
        console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);

        const pdfDoc = await PDFDocument.load(arrayBuffer);
        console.log('PDFDocument loaded');

        const pages = pdfDoc.getPages();
        console.log('Pages retrieved:', pages.length);

        // Embed both regular and bold fonts
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        console.log('Fonts embedded (regular + bold)');

        console.log('Processing', state.annotations.length, 'annotations');

        // Iterate through all annotations
        for (const ann of state.annotations) {
            // PDF-lib pages are 0-indexed, our state is 1-indexed
            const pageIndex = ann.page - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) continue;

            const page = pages[pageIndex];
            const { width, height } = page.getSize();

            // Coordinate conversion
            const pdfJsPage = await state.pdfDoc.getPage(ann.page);
            const viewport = pdfJsPage.getViewport({ scale: state.zoom * 1.5 });

            const scaleX = width / viewport.width;
            const scaleY = height / viewport.height;

            const pdfX = ann.x * scaleX;
            // PDF Y is inverted: height - (y * scaleY) - (annotation height * scaleY)
            const pdfY = height - (ann.y * scaleY) - (ann.height * scaleY);

            const pdfWidth = ann.width * scaleX;
            const pdfHeight = ann.height * scaleY;

            const pdfFontSize = (ann.fontSize || 14) * scaleY;

            // Parse hex color to RGB - moved here for reuse
            const hexToRgb = (hex) => {
                if (!hex || hex.length < 7) return { r: 1, g: 1, b: 1 }; // Default white
                const r = parseInt(hex.slice(1, 3), 16) / 255;
                const g = parseInt(hex.slice(3, 5), 16) / 255;
                const b = parseInt(hex.slice(5, 7), 16) / 255;
                return { r, g, b };
            };

            // If removeObject mode, fill with detected background color
            if (ann.type === 'removeObject') {
                const bgColor = hexToRgb(ann.backgroundColor);
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                    color: rgb(bgColor.r, bgColor.g, bgColor.b),
                });
                console.log('Drew removeObject rectangle with color:', ann.backgroundColor);
                continue; // Skip text drawing for removeObject
            }

            // If replace mode, draw background rectangle (detected color or white fallback)
            if (ann.type === 'replace') {
                const bgColor = ann.backgroundColor ? hexToRgb(ann.backgroundColor) : { r: 1, g: 1, b: 1 };
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                    color: rgb(bgColor.r, bgColor.g, bgColor.b),
                });
            }

            // Draw Text
            if (ann.text) {
                // Sanitize Turkish characters for PDF compatibility
                const sanitizeTurkishChars = (text) => {
                    const charMap = {
                        'ı': 'i', 'İ': 'I',
                        'ş': 's', 'Ş': 'S',
                        'ğ': 'g', 'Ğ': 'G',
                        'ü': 'u', 'Ü': 'U',
                        'ö': 'o', 'Ö': 'O',
                        'ç': 'c', 'Ç': 'C'
                    };
                    return text.replace(/[ışğüöçİŞĞÜÖÇ]/g, char => charMap[char] || char);
                };

                const safeText = sanitizeTurkishChars(ann.text);

                // Use hexToRgb defined above
                const color = ann.color ? hexToRgb(ann.color) : { r: 0, g: 0, b: 0 };

                // Check if pixelation is enabled
                if (ann.pixelateLevel && ann.pixelateLevel > 0) {
                    // Capture the exact rendered appearance from annotation canvas
                    // First, we need to render this annotation to a temporary canvas exactly as it appears

                    const pixelScale = pixelateLevels[ann.pixelateLevel].scale;
                    const weight = ann.bold ? 'bold ' : '';
                    const style = ann.italic ? 'italic ' : '';
                    const family = ann.fontFamily || 'Inter';
                    const annFontSize = ann.fontSize || 14;
                    const lineHeight = annFontSize * 1.4;
                    const textAlign = ann.textAlign || 'left';
                    const padding = 5;

                    // Create canvas at annotation size (what user sees on screen)
                    const captureCanvas = document.createElement('canvas');
                    captureCanvas.width = Math.ceil(ann.width);
                    captureCanvas.height = Math.ceil(ann.height);
                    const captureCtx = captureCanvas.getContext('2d');

                    // Fill background if replace mode
                    if (ann.type === 'replace' && ann.backgroundColor) {
                        captureCtx.fillStyle = ann.backgroundColor;
                        captureCtx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
                    } else {
                        // Transparent background for add mode
                        captureCtx.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
                    }

                    // Calculate text position (relative to annotation)
                    let textXRel;
                    if (textAlign === 'center') {
                        textXRel = ann.width / 2;
                    } else if (textAlign === 'right') {
                        textXRel = ann.width - padding;
                    } else {
                        textXRel = padding;
                    }

                    // Calculate lines for word wrap (with newline support)
                    captureCtx.font = `${style}${weight}${annFontSize}px "${family}"`;
                    const lines = wrapTextWithNewlines(captureCtx, ann.text, ann.width - 10);

                    // Calculate vertical centering
                    const totalTextHeight = lines.length * lineHeight;
                    const startYRel = (ann.height - totalTextHeight) / 2 + annFontSize;

                    // Create pixelated version (same logic as canvas rendering)
                    const pixelCanvas = document.createElement('canvas');
                    pixelCanvas.width = Math.ceil(ann.width * pixelScale);
                    pixelCanvas.height = Math.ceil(ann.height * pixelScale);
                    const pixelCtx = pixelCanvas.getContext('2d');
                    pixelCtx.imageSmoothingEnabled = false;

                    // Fill background if needed
                    if (ann.type === 'replace' && ann.backgroundColor) {
                        pixelCtx.fillStyle = ann.backgroundColor;
                        pixelCtx.fillRect(0, 0, pixelCanvas.width, pixelCanvas.height);
                    }

                    // Scale down and draw text
                    pixelCtx.scale(pixelScale, pixelScale);
                    pixelCtx.fillStyle = ann.color || '#000000';
                    pixelCtx.font = `${style}${weight}${annFontSize}px "${family}"`;
                    pixelCtx.textAlign = textAlign;

                    lines.forEach((line, index) => {
                        pixelCtx.fillText(line, textXRel, startYRel + index * lineHeight);
                    });

                    // Scale up to capture canvas (creates pixelated effect)
                    captureCtx.imageSmoothingEnabled = false;
                    captureCtx.drawImage(pixelCanvas, 0, 0, captureCanvas.width, captureCanvas.height);

                    // Embed as PNG in PDF
                    const dataUrl = captureCanvas.toDataURL('image/png');
                    const base64Data = dataUrl.split(',')[1];
                    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    const textImage = await pdfDoc.embedPng(imageBytes);

                    page.drawImage(textImage, {
                        x: pdfX,
                        y: pdfY,
                        width: pdfWidth,
                        height: pdfHeight,
                    });

                    console.log('Drew pixelated text as image on page', ann.page);
                } else {
                    // Normal text rendering with multiline support
                    const textAlign = ann.textAlign || 'left';
                    const padding = 5 * scaleX;
                    const lineHeight = pdfFontSize * 1.4;

                    // Select font based on fontWeight (use bold for semibold, bold, extrabold)
                    const isBold = ann.fontWeight !== undefined ? ann.fontWeight >= 1 : ann.bold;
                    const font = isBold ? fontBold : fontRegular;

                    // Split text by newlines and apply word wrap
                    const textLines = safeText.split('\n');
                    let allLines = [];

                    textLines.forEach(paragraph => {
                        if (paragraph.trim() === '') {
                            allLines.push('');
                            return;
                        }

                        // Simple word wrap for PDF
                        const words = paragraph.split(' ');
                        let currentLine = '';

                        words.forEach(word => {
                            const testLine = currentLine + word + ' ';
                            const testWidth = font.widthOfTextAtSize(testLine, pdfFontSize);

                            if (testWidth > pdfWidth - (10 * scaleX) && currentLine !== '') {
                                allLines.push(currentLine.trim());
                                currentLine = word + ' ';
                            } else {
                                currentLine = testLine;
                            }
                        });

                        if (currentLine.trim()) {
                            allLines.push(currentLine.trim());
                        }
                    });

                    // Calculate vertical centering
                    const totalTextHeight = allLines.length * lineHeight;
                    const startY = pdfY + pdfHeight - ((pdfHeight - totalTextHeight) / 2) - pdfFontSize;

                    // Draw each line
                    allLines.forEach((line, index) => {
                        if (line === '') return; // Skip empty lines but maintain spacing

                        const lineWidth = font.widthOfTextAtSize(line, pdfFontSize);
                        let textX;

                        if (textAlign === 'center') {
                            textX = pdfX + (pdfWidth - lineWidth) / 2;
                        } else if (textAlign === 'right') {
                            textX = pdfX + pdfWidth - lineWidth - padding;
                        } else {
                            textX = pdfX + padding;
                        }

                        page.drawText(line, {
                            x: textX,
                            y: startY - (index * lineHeight),
                            size: pdfFontSize,
                            font: font,
                            color: rgb(color.r, color.g, color.b),
                        });
                    });
                }
            }
        }

        console.log('Text annotations processed. Processing', state.imageAnnotations.length, 'image annotations...');

        // Process image annotations
        for (const img of state.imageAnnotations) {
            const pageIndex = img.page - 1;
            if (pageIndex < 0 || pageIndex >= pages.length) continue;

            const page = pages[pageIndex];
            const { width, height } = page.getSize();

            // Coordinate conversion
            const pdfJsPage = await state.pdfDoc.getPage(img.page);
            const viewport = pdfJsPage.getViewport({ scale: state.zoom * 1.5 });

            const scaleX = width / viewport.width;
            const scaleY = height / viewport.height;

            const pdfX = img.x * scaleX;
            const pdfY = height - (img.y * scaleY) - (img.height * scaleY);
            const pdfWidth = img.width * scaleX;
            const pdfHeight = img.height * scaleY;

            try {
                // Convert Image element to base64
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Check for crop properties
                const hasCrop = (img.cropLeft || img.cropTop || img.cropRight || img.cropBottom);

                if (hasCrop) {
                    // CROP MODE: Draw only the visible part
                    const originalWidth = img.originalWidth || img.element.naturalWidth;
                    const originalHeight = img.originalHeight || img.element.naturalHeight;

                    // Source rectangle (the part of the original image to keep)
                    const srcX = img.cropLeft || 0;
                    const srcY = img.cropTop || 0;
                    const srcWidth = originalWidth - (img.cropLeft || 0) - (img.cropRight || 0);
                    const srcHeight = originalHeight - (img.cropTop || 0) - (img.cropBottom || 0);

                    // Set canvas to the aspect ratio of the VISIBLE part
                    canvas.width = srcWidth;
                    canvas.height = srcHeight;

                    // Draw cropped portion
                    ctx.drawImage(
                        img.element,
                        srcX, srcY, srcWidth, srcHeight,
                        0, 0, srcWidth, srcHeight
                    );

                    console.log(`Exporting cropped image: src=${srcX},${srcY} ${srcWidth}x${srcHeight}`);
                } else {
                    // NORMAL MODE: Draw full image
                    canvas.width = img.element.naturalWidth || img.element.width;
                    canvas.height = img.element.naturalHeight || img.element.height;
                    ctx.drawImage(img.element, 0, 0);
                }

                // Get image data as data URL
                const dataUrl = canvas.toDataURL('image/png');
                const base64Data = dataUrl.split(',')[1];
                const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

                // Embed image in PDF
                let embeddedImage;
                if (img.type === 'image/jpeg' || img.type === 'image/jpg') {
                    embeddedImage = await pdfDoc.embedJpg(imageBytes);
                } else {
                    embeddedImage = await pdfDoc.embedPng(imageBytes);
                }

                // Draw image on page
                page.drawImage(embeddedImage, {
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                });

                console.log('Embedded image on page', img.page, 'at', pdfX, pdfY);
            } catch (imgError) {
                console.error('Error embedding image:', imgError);
                // Continue with other images even if one fails
            }
        }

        console.log('All annotations processed. Saving PDF...');

        // Serialize the PDFDocument to bytes (a Uint8Array)
        const pdfBytes = await pdfDoc.save();
        console.log('PDF saved to bytes, size:', pdfBytes.length);

        // Trigger download - using window.open for file:// protocol compatibility
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(blob);
        console.log('Blob URL created');

        // For file:// protocol, open in new window
        if (window.location.protocol === 'file:') {
            console.log('File protocol detected, opening PDF in new window...');
            window.open(blobUrl, '_blank');
            alert('PDF yeni sekmede açıldı. Kaydetmek için Ctrl+S veya sağ tık > Farklı Kaydet kullanın.');
        } else {
            // Standard download for http/https
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = 'edited_document.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Clean up after delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        console.log('Download process completed!');

    } catch (error) {
        console.error('PDF generation error:', error);
        alert('PDF oluşturulurken bir hata oluştu: ' + error.message);
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '=':
            case '+':
                e.preventDefault();
                setZoom(state.zoom + 0.25);
                break;
            case '-':
                e.preventDefault();
                setZoom(state.zoom - 0.25);
                break;
            case '0':
                e.preventDefault();
                setZoom(1.0);
                break;
        }
    }

    // Arrow keys for page navigation
    if (e.key === 'ArrowLeft' && state.currentPage > 1) {
        goToPage(state.currentPage - 1);
    } else if (e.key === 'ArrowRight' && state.currentPage < state.totalPages) {
        goToPage(state.currentPage + 1);
    }

    // ESC to close modal
    if (e.key === 'Escape') {
        closeTextModal();
    }
});

// Make functions globally accessible for onclick handlers
window.editAnnotation = editAnnotation;
window.goToAnnotation = goToAnnotation;
window.closeTextModal = closeTextModal;
window.applyText = applyText;

// Initialize application
initTabs();
// Double click to confirm crop
annotationCanvas.addEventListener('dblclick', function (e) {
    if (state.croppingImage) {
        state.croppingImage = null;
        updateAnnotationsList();
        redrawAnnotations();
        console.log('Crop confirmed via double click');
    }
});
