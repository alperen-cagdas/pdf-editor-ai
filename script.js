// PDF.js Configuration - Local worker for Electron
pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';

// State Management
const state = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 0,
    zoom: 1.0,
    activeTool: 'replace',
    annotations: [],
    imageAnnotations: [], // For image overlays
    currentAnnotation: null,
    isDrawing: false,
    draggedAnnotation: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    startX: 0,
    startY: 0,
    editingIndex: null,
    apiKey: '', // User must enter their own key
    originalFile: null,
    pendingImage: null, // For image being placed
    // Resize state
    resizingAnnotation: null,
    resizeEdge: null, // 'left', 'right', 'top', 'bottom', or corner combinations
    selectedAnnotation: null // For showing resize handles
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
const pageInfo = document.getElementById('pageInfo');
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
const eyedropperBtn = document.getElementById('eyedropperBtn');
const applyTextBtn = document.getElementById('applyTextBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const apiKeyInput = document.getElementById('apiKey');
const annotationsList = document.getElementById('annotationsList');
const downloadBtn = document.getElementById('downloadBtn');

// Event Listeners
fileInput.addEventListener('change', handleFileSelect);
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);

zoomInBtn.addEventListener('click', () => setZoom(state.zoom + 0.25));
zoomOutBtn.addEventListener('click', () => setZoom(state.zoom - 0.25));
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
fontItalicCheckbox.addEventListener('change', updateLivePreview);
alignLeftRadio.addEventListener('change', updateLivePreview);
alignCenterRadio.addEventListener('change', updateLivePreview);
alignRightRadio.addEventListener('change', updateLivePreview);

// Live preview function - updates annotation on canvas in real-time
function updateLivePreview() {
    if (!state.currentAnnotation) return;

    // Update current annotation with form values
    state.currentAnnotation.text = textInput.value;
    state.currentAnnotation.fontSize = parseInt(fontSizeInput.value) || 14;
    state.currentAnnotation.fontFamily = fontFamilySelect.value;
    state.currentAnnotation.color = textColorInput.value;
    state.currentAnnotation.bold = fontBoldCheckbox.checked;
    state.currentAnnotation.italic = fontItalicCheckbox.checked;
    state.currentAnnotation.textAlign = document.querySelector('input[name="textAlign"]:checked')?.value || 'left';

    // Redraw to show live preview
    redrawAnnotations();

    // Draw current annotation being edited
    drawAnnotationPreview(state.currentAnnotation);
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
        annotationCtx.fillStyle = ann.color || '#000000';
        const weight = ann.bold ? 'bold ' : '';
        const style = ann.italic ? 'italic ' : '';
        const family = ann.fontFamily || 'Inter';
        annotationCtx.font = `${style}${weight}${ann.fontSize || 14}px "${family}"`;

        const textAlign = ann.textAlign || 'left';
        annotationCtx.textAlign = textAlign;

        const padding = 5;
        let textX;
        if (textAlign === 'center') {
            textX = ann.x + ann.width / 2;
        } else if (textAlign === 'right') {
            textX = ann.x + ann.width - padding;
        } else {
            textX = ann.x + padding;
        }

        const words = ann.text.split(' ');
        let line = '';
        let y = ann.y + 20;

        words.forEach(word => {
            const testLine = line + word + ' ';
            const metrics = annotationCtx.measureText(testLine);

            if (metrics.width > ann.width - 10 && line !== '') {
                annotationCtx.fillText(line.trim(), textX, y);
                line = word + ' ';
                y += 20;
            } else {
                line = testLine;
            }
        });
        annotationCtx.fillText(line.trim(), textX, y);
        annotationCtx.textAlign = 'left';
    }
}

// Resize edge detection threshold
const RESIZE_HANDLE_SIZE = 8;

// Helper function to detect which resize edge/corner is being hovered
function getResizeEdge(x, y, ann) {
    if (!ann) return null;

    const handles = RESIZE_HANDLE_SIZE;
    const onLeft = Math.abs(x - ann.x) <= handles;
    const onRight = Math.abs(x - (ann.x + ann.width)) <= handles;
    const onTop = Math.abs(y - ann.y) <= handles;
    const onBottom = Math.abs(y - (ann.y + ann.height)) <= handles;
    const inHorizontalRange = x >= ann.x - handles && x <= ann.x + ann.width + handles;
    const inVerticalRange = y >= ann.y - handles && y <= ann.y + ann.height + handles;

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

    // Find clicked annotation
    const clickedAnnotation = state.annotations
        .filter(ann => ann.page === state.currentPage)
        .slice().reverse()
        .find(ann =>
            x >= ann.x && x <= ann.x + ann.width &&
            y >= ann.y && y <= ann.y + ann.height
        );

    if (clickedAnnotation) {
        // Toggle selection
        if (state.selectedAnnotation === clickedAnnotation) {
            state.selectedAnnotation = null;
        } else {
            state.selectedAnnotation = clickedAnnotation;
        }
        redrawAnnotations();
        console.log('Annotation selected for resize:', state.selectedAnnotation ? 'yes' : 'no');
    } else {
        // Clicked outside - deselect
        state.selectedAnnotation = null;
        redrawAnnotations();
    }
}

textColorInput.addEventListener('input', (e) => {
    colorValueLabel.textContent = e.target.value.toUpperCase();
});

apiKeyInput.addEventListener('change', (e) => {
    state.apiKey = e.target.value;
    localStorage.setItem('pdfEditorApiKey', e.target.value);
    updateApiStatus();
});

apiKeyInput.addEventListener('input', (e) => {
    state.apiKey = e.target.value;
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
        if (state.apiKey && state.apiKey.length > 10) {
            dot.className = 'status-dot inactive';
            text.textContent = 'API anahtarı girildi (test edilmedi)';
        } else {
            dot.className = 'status-dot inactive';
            text.textContent = 'API anahtarı girilmedi';
        }
    }
}

testApiBtn.addEventListener('click', async () => {
    if (!state.apiKey || state.apiKey.length < 10) {
        updateApiStatus('error', 'Lütfen önce bir API anahtarı girin');
        return;
    }

    updateApiStatus('testing', 'Test ediliyor...');

    try {
        // Use gemini-2.0-flash model
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
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
                localStorage.setItem('pdfEditorApiKey', state.apiKey);
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

// Load saved API key
const savedApiKey = localStorage.getItem('pdfEditorApiKey');
if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
    state.apiKey = savedApiKey;
    updateApiStatus();
}

console.log('PDF Editor Ready. API Key status:', state.apiKey ? 'Set' : 'Missing');



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
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// Zoom Control
function setZoom(newZoom) {
    if (newZoom >= 0.5 && newZoom <= 3.0) {
        state.zoom = newZoom;
        zoomLevel.textContent = Math.round(newZoom * 100) + '%';
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
    pageInfo.textContent = `Sayfa ${state.currentPage} / ${state.totalPages}`;
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

        // Check if clicked on an existing annotation
        const clickedAnnotation = state.annotations
            .filter(ann => ann.page === state.currentPage)
            .slice().reverse() // Check top-most first
            .find(ann =>
                state.startX >= ann.x &&
                state.startX <= ann.x + ann.width &&
                state.startY >= ann.y &&
                state.startY <= ann.y + ann.height
            );

        if (clickedAnnotation) {
            state.draggedAnnotation = clickedAnnotation;
            state.dragOffsetX = state.startX - clickedAnnotation.x;
            state.dragOffsetY = state.startY - clickedAnnotation.y;
            annotationCanvas.style.cursor = 'grabbing';
            return;
        }
    }

    if (state.activeTool === 'replace' || state.activeTool === 'add') {
        state.currentAnnotation = {
            x: state.startX,
            y: state.startY,
            width: 0,
            height: 0,
            page: state.currentPage,
            text: '',
            type: state.activeTool // 'replace' or 'add'
        };
    }

    // Image placement mode
    if (state.activeTool === 'placeImage' && state.pendingImage) {
        state.currentAnnotation = {
            x: state.startX,
            y: state.startY,
            width: 0,
            height: 0,
            page: state.currentPage,
            type: 'image'
        };
    }

    // Remove object mode
    if (state.activeTool === 'removeObject') {
        state.currentAnnotation = {
            x: state.startX,
            y: state.startY,
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

    // Handle Resizing
    if (state.resizingAnnotation) {
        const ann = state.resizingAnnotation;
        const edge = state.resizeEdge;
        const minSize = 20; // Minimum width/height

        // Calculate new dimensions based on which edge is being dragged
        if (edge.includes('n')) {
            const newHeight = ann.y + ann.height - currentY;
            if (newHeight >= minSize) {
                ann.y = currentY;
                ann.height = newHeight;
            }
        }
        if (edge.includes('s')) {
            const newHeight = currentY - ann.y;
            if (newHeight >= minSize) {
                ann.height = newHeight;
            }
        }
        if (edge.includes('w')) {
            const newWidth = ann.x + ann.width - currentX;
            if (newWidth >= minSize) {
                ann.x = currentX;
                ann.width = newWidth;
            }
        }
        if (edge.includes('e')) {
            const newWidth = currentX - ann.x;
            if (newWidth >= minSize) {
                ann.width = newWidth;
            }
        }

        redrawAnnotations();
        return;
    }

    // Handle Dragging
    if (state.draggedAnnotation) {
        state.draggedAnnotation.x = currentX - state.dragOffsetX;
        state.draggedAnnotation.y = currentY - state.dragOffsetY;
        redrawAnnotations();
        return;
    }

    // Hover effect for move tool - show resize cursors when hovering edges of selected annotation
    if (state.activeTool === 'move' && !state.draggedAnnotation && !state.resizingAnnotation) {
        // Check resize cursor for selected annotation
        if (state.selectedAnnotation && state.selectedAnnotation.page === state.currentPage) {
            const edge = getResizeEdge(currentX, currentY, state.selectedAnnotation);
            if (edge) {
                annotationCanvas.style.cursor = getResizeCursor(edge);
                return;
            }
        }

        // Check for regular hover on any annotation
        const hovering = state.annotations.some(ann =>
            ann.page === state.currentPage &&
            currentX >= ann.x &&
            currentX <= ann.x + ann.width &&
            currentY >= ann.y &&
            currentY <= ann.y + ann.height
        );
        annotationCanvas.style.cursor = hovering ? 'grab' : 'default';
        return;
    }

    if (!state.isDrawing) return;

    // Handle image placement drawing
    if (state.activeTool === 'placeImage' && state.currentAnnotation) {
        state.currentAnnotation.width = currentX - state.startX;
        state.currentAnnotation.height = currentY - state.startY;

        redrawAnnotations();
        // Draw image preview rectangle
        annotationCtx.strokeStyle = '#48bb78'; // Green for images
        annotationCtx.lineWidth = 2;
        annotationCtx.setLineDash([5, 5]);
        annotationCtx.strokeRect(
            state.currentAnnotation.x,
            state.currentAnnotation.y,
            state.currentAnnotation.width,
            state.currentAnnotation.height
        );
        annotationCtx.setLineDash([]);
        return;
    }

    // Handle removeObject drawing
    if (state.activeTool === 'removeObject' && state.currentAnnotation) {
        state.currentAnnotation.width = currentX - state.startX;
        state.currentAnnotation.height = currentY - state.startY;

        redrawAnnotations();
        // Draw red dashed rectangle for removal
        annotationCtx.strokeStyle = '#f56565'; // Red for removal
        annotationCtx.lineWidth = 2;
        annotationCtx.setLineDash([5, 5]);
        annotationCtx.strokeRect(
            state.currentAnnotation.x,
            state.currentAnnotation.y,
            state.currentAnnotation.width,
            state.currentAnnotation.height
        );
        annotationCtx.setLineDash([]);

        // Fill with semi-transparent red
        annotationCtx.fillStyle = 'rgba(245, 101, 101, 0.2)';
        annotationCtx.fillRect(
            state.currentAnnotation.x,
            state.currentAnnotation.y,
            state.currentAnnotation.width,
            state.currentAnnotation.height
        );
        return;
    }

    if (state.activeTool !== 'replace' && state.activeTool !== 'add') return;
    if (!state.currentAnnotation) return;

    state.currentAnnotation.width = currentX - state.startX;
    state.currentAnnotation.height = currentY - state.startY;

    redrawAnnotations();
    drawDashedRect(
        state.currentAnnotation.x,
        state.currentAnnotation.y,
        state.currentAnnotation.width,
        state.currentAnnotation.height
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

    if (state.draggedAnnotation) {
        state.draggedAnnotation = null;
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
            const imageAnnotation = {
                type: 'image',
                page: state.currentPage,
                x: state.currentAnnotation.x,
                y: state.currentAnnotation.y,
                width: state.currentAnnotation.width,
                height: state.currentAnnotation.height,
                src: state.pendingImage.src,
                element: state.pendingImage.element
            };

            state.imageAnnotations.push(imageAnnotation);
            console.log('Image placed:', imageAnnotation);

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

    // Draw semi-transparent fill
    annotationCtx.fillStyle = 'rgba(102, 126, 234, 0.1)';
    annotationCtx.fillRect(x, y, width, height);
}

function redrawAnnotations() {
    annotationCtx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);

    // Draw saved annotations for current page
    state.annotations
        .filter(ann => ann.page === state.currentPage)
        .forEach(ann => {
            // If removeObject mode, fill with detected background color
            if (ann.type === 'removeObject') {
                annotationCtx.fillStyle = ann.backgroundColor || '#ffffff';
                annotationCtx.fillRect(ann.x, ann.y, ann.width, ann.height);
                // Draw subtle border to indicate it's an edit
                annotationCtx.strokeStyle = 'rgba(245, 101, 101, 0.3)';
                annotationCtx.lineWidth = 1;
                annotationCtx.setLineDash([3, 3]);
                annotationCtx.strokeRect(ann.x, ann.y, ann.width, ann.height);
                annotationCtx.setLineDash([]);
                return; // Don't draw anything else for removeObject
            }

            // If replace mode, draw background first (detected or white fallback)
            if (ann.type === 'replace') {
                annotationCtx.fillStyle = ann.backgroundColor || '#ffffff';
                annotationCtx.fillRect(ann.x, ann.y, ann.width, ann.height);
            }

            drawDashedRect(ann.x, ann.y, ann.width, ann.height);

            // Draw text if exists
            if (ann.text) {
                annotationCtx.fillStyle = ann.color || '#000000';
                const weight = ann.bold ? 'bold ' : '';
                const style = ann.italic ? 'italic ' : '';
                const family = ann.fontFamily || 'Inter';
                annotationCtx.font = `${style}${weight}${ann.fontSize || 14}px "${family}"`;

                // Set text alignment
                const textAlign = ann.textAlign || 'left';
                annotationCtx.textAlign = textAlign;

                // Word wrap text
                const words = ann.text.split(' ');
                let line = '';
                let y = ann.y + 20;
                const padding = 5;

                // Calculate x position based on alignment
                let textX;
                if (textAlign === 'center') {
                    textX = ann.x + ann.width / 2;
                } else if (textAlign === 'right') {
                    textX = ann.x + ann.width - padding;
                } else {
                    textX = ann.x + padding;
                }

                words.forEach(word => {
                    const testLine = line + word + ' ';
                    const metrics = annotationCtx.measureText(testLine);

                    if (metrics.width > ann.width - 10 && line !== '') {
                        annotationCtx.fillText(line.trim(), textX, y);
                        line = word + ' ';
                        y += 20;
                    } else {
                        line = testLine;
                    }
                });
                annotationCtx.fillText(line.trim(), textX, y);

                // Reset text alignment to default
                annotationCtx.textAlign = 'left';
            }
        });

    // Draw image annotations for current page
    state.imageAnnotations
        .filter(img => img.page === state.currentPage)
        .forEach(img => {
            // Draw the image
            annotationCtx.drawImage(img.element, img.x, img.y, img.width, img.height);

            // Draw green border around image
            annotationCtx.strokeStyle = '#48bb78';
            annotationCtx.lineWidth = 2;
            annotationCtx.setLineDash([]);
            annotationCtx.strokeRect(img.x, img.y, img.width, img.height);
        });

    // Draw resize handles for selected annotation
    if (state.selectedAnnotation && state.selectedAnnotation.page === state.currentPage) {
        const ann = state.selectedAnnotation;
        const handleSize = RESIZE_HANDLE_SIZE;
        const halfHandle = handleSize / 2;

        // Highlight selected annotation with thicker border
        annotationCtx.strokeStyle = '#667eea';
        annotationCtx.lineWidth = 3;
        annotationCtx.setLineDash([]);
        annotationCtx.strokeRect(ann.x, ann.y, ann.width, ann.height);

        // Draw resize handles (small squares at corners and edges)
        annotationCtx.fillStyle = '#667eea';

        // Corner handles
        // Top-left
        annotationCtx.fillRect(ann.x - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        // Top-right
        annotationCtx.fillRect(ann.x + ann.width - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        // Bottom-left
        annotationCtx.fillRect(ann.x - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);
        // Bottom-right
        annotationCtx.fillRect(ann.x + ann.width - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);

        // Edge handles (middle of each edge)
        // Top
        annotationCtx.fillRect(ann.x + ann.width / 2 - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        // Bottom
        annotationCtx.fillRect(ann.x + ann.width / 2 - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);
        // Left
        annotationCtx.fillRect(ann.x - halfHandle, ann.y + ann.height / 2 - halfHandle, handleSize, handleSize);
        // Right
        annotationCtx.fillRect(ann.x + ann.width - halfHandle, ann.y + ann.height / 2 - halfHandle, handleSize, handleSize);

        // Add white border to handles for visibility
        annotationCtx.strokeStyle = '#ffffff';
        annotationCtx.lineWidth = 1;

        // Corner handle borders
        annotationCtx.strokeRect(ann.x - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x + ann.width - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x + ann.width - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);

        // Edge handle borders
        annotationCtx.strokeRect(ann.x + ann.width / 2 - halfHandle, ann.y - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x + ann.width / 2 - halfHandle, ann.y + ann.height - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x - halfHandle, ann.y + ann.height / 2 - halfHandle, handleSize, handleSize);
        annotationCtx.strokeRect(ann.x + ann.width - halfHandle, ann.y + ann.height / 2 - halfHandle, handleSize, handleSize);
    }
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
    fontItalicCheckbox.checked = false;
    alignLeftRadio.checked = true; // Default to left alignment

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
    state.currentAnnotation.bold = fontBoldCheckbox.checked;
    state.currentAnnotation.italic = fontItalicCheckbox.checked;
    // Save text alignment
    state.currentAnnotation.textAlign = document.querySelector('input[name="textAlign"]:checked')?.value || 'left';

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
    if (!state.apiKey) return;

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

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${state.apiKey}`, {
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

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        console.log('Font embedded');

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

                // Calculate text X position based on alignment
                const textWidth = font.widthOfTextAtSize(safeText, pdfFontSize);
                const textAlign = ann.textAlign || 'left';
                let textX;
                const padding = 5 * scaleX;

                if (textAlign === 'center') {
                    textX = pdfX + (pdfWidth - textWidth) / 2;
                } else if (textAlign === 'right') {
                    textX = pdfX + pdfWidth - textWidth - padding;
                } else {
                    textX = pdfX + padding;
                }

                // Draw text with sanitized characters
                page.drawText(safeText, {
                    x: textX,
                    y: pdfY + pdfHeight - pdfFontSize - (5 * scaleY),
                    size: pdfFontSize,
                    font: font,
                    color: rgb(color.r, color.g, color.b),
                    maxWidth: pdfWidth - (10 * scaleX)
                });
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
                canvas.width = img.element.naturalWidth || img.element.width;
                canvas.height = img.element.naturalHeight || img.element.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img.element, 0, 0);

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
