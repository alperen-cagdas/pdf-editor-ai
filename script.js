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
    currentAnnotation: null,
    isDrawing: false,
    draggedAnnotation: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    startX: 0,
    startY: 0,
    editingIndex: null,
    apiKey: '', // User must enter their own key
    originalFile: null
};

// DOM Elements
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
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
const textModal = document.getElementById('textModal');
const textInput = document.getElementById('textInput');
const fontFamilySelect = document.getElementById('fontFamily');
const fontSizeInput = document.getElementById('fontSize');
const textColorInput = document.getElementById('textColor');
const colorValueLabel = document.getElementById('colorValue');
const fontBoldCheckbox = document.getElementById('fontBold');
const fontItalicCheckbox = document.getElementById('fontItalic');
const apiKeyInput = document.getElementById('apiKey');
const annotationsList = document.getElementById('annotationsList');
const downloadBtn = document.getElementById('downloadBtn');

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
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

annotationCanvas.addEventListener('mousedown', handleMouseDown);
annotationCanvas.addEventListener('mousemove', handleMouseMove);
annotationCanvas.addEventListener('mouseup', handleMouseUp);

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

    annotationCanvas.style.cursor = tool === 'move' ? 'default' : 'crosshair';
}

// Mouse Event Handlers
function handleMouseDown(e) {
    if (!state.pdfDoc) return;

    const rect = annotationCanvas.getBoundingClientRect();
    state.startX = (e.clientX - rect.left);
    state.startY = (e.clientY - rect.top);
    state.isDrawing = true;

    if (state.activeTool === 'move') {
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
}

function handleMouseMove(e) {
    const rect = annotationCanvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left);
    const currentY = (e.clientY - rect.top);

    // Handle Dragging
    if (state.draggedAnnotation) {
        state.draggedAnnotation.x = currentX - state.dragOffsetX;
        state.draggedAnnotation.y = currentY - state.dragOffsetY;
        redrawAnnotations();
        return;
    }

    // Hover effect for move tool
    if (state.activeTool === 'move' && !state.draggedAnnotation) {
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

    if (!state.isDrawing || (state.activeTool !== 'replace' && state.activeTool !== 'add')) return;

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

    if (state.draggedAnnotation) {
        state.draggedAnnotation = null;
        annotationCanvas.style.cursor = 'grab';
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
            showTextModal();
        } else {
            state.currentAnnotation = null;
            redrawAnnotations();
        }
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
            // If replace mode, draw white background first
            if (ann.type === 'replace') {
                annotationCtx.fillStyle = '#ffffff';
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

                // Word wrap text
                const words = ann.text.split(' ');
                let line = '';
                let y = ann.y + 20;

                words.forEach(word => {
                    const testLine = line + word + ' ';
                    const metrics = annotationCtx.measureText(testLine);

                    if (metrics.width > ann.width - 10 && line !== '') {
                        annotationCtx.fillText(line, ann.x + 5, y);
                        line = word + ' ';
                        y += 20;
                    } else {
                        line = testLine;
                    }
                });
                annotationCtx.fillText(line, ann.x + 5, y);
            }
        });
}

// Modal Functions
function showTextModal() {
    textModal.classList.add('show');
    textInput.value = '';

    // Reset defaults
    fontFamilySelect.value = 'Inter';
    fontSizeInput.value = '14';
    textColorInput.value = '#000000';
    colorValueLabel.textContent = '#000000';
    fontBoldCheckbox.checked = false;
    fontItalicCheckbox.checked = false;

    textInput.focus();
}

function closeTextModal() {
    textModal.classList.remove('show');
    if (state.currentAnnotation && !state.currentAnnotation.text && state.editingIndex === null) {
        state.currentAnnotation = null;
        redrawAnnotations();
    }
}

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
    if (state.annotations.length === 0) {
        annotationsList.innerHTML = '<p class="empty-state">Henüz düzenleme yok</p>';
        return;
    }

    let html = '';
    state.annotations.forEach((ann, index) => {
        html += '<div class="annotation-item" onclick="window.goToAnnotation(' + index + ')">';
        html += '<div>';
        html += '<div class="annotation-text">';
        html += '<span class="badge ' + ann.type + '">' + (ann.type === 'replace' ? 'Değiştir' : 'Ekle') + '</span>';
        html += (ann.text || 'Boş seçim');
        html += '</div>';
        html += '<div class="annotation-meta">Sayfa ' + ann.page + ' • Boyut: ' + Math.round(ann.fontSize || 14) + 'px</div>';
        html += '</div>';
        html += '<div class="annotation-actions">';
        html += '<button class="edit-btn" onclick="event.stopPropagation(); window.editAnnotation(' + index + ')" title="Düzenle">';
        html += '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>';
        html += '</button>';
        html += '<button class="delete-btn" onclick="event.stopPropagation(); window.handleDelete(' + index + ')" title="Sil">';
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
    console.log('Current annotations count:', state.annotations.length);

    // Directly delete without confirm for testing
    state.annotations.splice(index, 1);
    console.log('After splice, annotations count:', state.annotations.length);

    updateAnnotationsList();
    redrawAnnotations();
    console.log('Annotation deleted successfully');
}
window.handleDelete = handleDelete;
console.log('handleDelete registered on window:', typeof window.handleDelete);

function editAnnotation(index) {
    state.editingIndex = index;
    const ann = state.annotations[index];

    // Set as current annotation (clone it)
    state.currentAnnotation = { ...ann };

    // Show modal
    textModal.classList.add('show');

    // Fill inputs
    textInput.value = ann.text || '';
    fontSizeInput.value = ann.fontSize || 14;
    fontFamilySelect.value = ann.fontFamily || 'Inter';
    textColorInput.value = ann.color || '#000000';
    colorValueLabel.textContent = (ann.color || '#000000').toUpperCase();
    fontBoldCheckbox.checked = ann.bold || false;
    fontItalicCheckbox.checked = ann.italic || false;

    textInput.focus();
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

            // If replace mode, draw white rectangle
            if (ann.type === 'replace') {
                page.drawRectangle({
                    x: pdfX,
                    y: pdfY,
                    width: pdfWidth,
                    height: pdfHeight,
                    color: rgb(1, 1, 1), // White
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

                // Parse hex color to RGB
                const hexToRgb = (hex) => {
                    const r = parseInt(hex.slice(1, 3), 16) / 255;
                    const g = parseInt(hex.slice(3, 5), 16) / 255;
                    const b = parseInt(hex.slice(5, 7), 16) / 255;
                    return { r, g, b };
                };
                const color = ann.color ? hexToRgb(ann.color) : { r: 0, g: 0, b: 0 };

                // Draw text with sanitized characters
                page.drawText(safeText, {
                    x: pdfX + (5 * scaleX),
                    y: pdfY + pdfHeight - pdfFontSize - (5 * scaleY),
                    size: pdfFontSize,
                    font: font,
                    color: rgb(color.r, color.g, color.b),
                    maxWidth: pdfWidth - (10 * scaleX)
                });
            }
        }

        console.log('Annotations processed. Saving PDF...');

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
