/**
 * @file export.js
 * @description Handles all data export functionality for the application, including 
 * formatting and downloading data as raw CSV files and generating complex, 
 * true-vector PDF daily schedules using the jsPDF library.
 */

/**
 * Toggles the UI styling in the export modal to reflect the currently selected 
 * download format (PDF vs CSV).
 * @param {string} format - The selected export format ('pdf' or 'csv').
 * @returns {void}
 */
function selectExportFormat(format) {
    getEl('export-format').value = format;
    const btnPdf = getEl('btn-format-pdf'), btnCsv = getEl('btn-format-csv');
    btnPdf.className = `flex-1 py-2 px-3 border-2 rounded-lg font-bold text-sm transition-colors ${format === 'pdf' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
    btnCsv.className = `flex-1 py-2 px-3 border-2 rounded-lg font-bold text-sm transition-colors ${format === 'csv' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
}

/**
 * Initializes and displays the export settings modal, populating the month and 
 * center dropdown selectors with available options.
 * @returns {void}
 */
function openPrintModal() {
    selectExportFormat('pdf'); 
    let mHtml = '<option value="all">Todos los meses</option>';
    for(let i=0; i<12; i++) mHtml += `<option value="${i}">${MONTHS_ES[i]} 2026</option>`;
    getEl('print-month').innerHTML = mHtml;

    let cHtml = '<option value="all">Todos los centros</option>';
    Object.keys(CENTERS).forEach(k => cHtml += `<option value="${k}">${CENTERS[k].name}</option>`);
    getEl('print-center').innerHTML = cHtml;
    showEl('print-modal');
}

/**
 * Hides the export settings modal.
 * @returns {void}
 */
function closePrintModal() { 
    hideEl('print-modal'); 
}

/**
 * Routing function triggered by the export modal's confirm button.
 * Routes execution to the appropriate specific generator based on user selection.
 * @returns {void}
 */
function executeExport() {
    const format = getEl('export-format').value;
    if (format === 'pdf') executePrintPDF(); else executePrintCSV();
}

/**
 * Filters current allocations based on modal selections, formats the data into a 
 * comma-separated string, and forces the browser to download it as a .csv file.
 * @returns {void}
 */
function executePrintCSV() {
    const monthVal = getEl('print-month').value, centerVal = getEl('print-center').value;
    let targetCenters = centerVal === 'all' ? Object.keys(CENTERS) : [centerVal];
    let filtered = allocations.filter(a => targetCenters.includes(a.center));
    
    if (monthVal !== 'all') {
        filtered = filtered.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === parseInt(monthVal, 10));
    }

    if (filtered.length === 0) { 
        showNotification('Sin Datos', 'No hay reservas para los filtros seleccionados.', true); 
        closePrintModal(); 
        return; 
    }

    try {
        let csv = "Fecha,Centro,Punto,Hora,Plazas\n";
        filtered.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time));
        
        filtered.forEach(a => { 
            csv += `${a.date},${CENTERS[a.center] ? CENTERS[a.center].name : a.center},${a.site},${a.time},${a.pax}\n`; 
        });
        
        // Native DOM anchor trick to force file download in browser
        const l = document.createElement("a"); 
        l.setAttribute("href", "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv)); 
        l.setAttribute("download", `Planificacion_${centerVal}_${monthVal}.csv`); 
        document.body.appendChild(l);
        l.click(); 
        document.body.removeChild(l);
        closePrintModal();
    } catch (error) { 
        showNotification('Error', 'Hubo un problema al exportar el CSV.', true); 
    }
}

/**
 * Creates an immediate, unfiltered CSV dump of the entire database state currently in memory.
 * Primarily used as an automated fail-safe before a user executes a destructive action (like emptying the DB).
 * @returns {void}
 */
function backupAllToCSV() {
    if (!allocations || allocations.length === 0) return;
    try {
        let csv = "Fecha,Centro,Punto,Hora,Plazas\n";
        let sorted = [...allocations].sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time));
        
        sorted.forEach(a => { 
            let cName = CENTERS[a.center] ? CENTERS[a.center].name : a.center;
            csv += `${a.date},${cName},${a.site},${a.time},${a.pax}\n`; 
        });
        
        const l = document.createElement("a"); 
        l.setAttribute("href", "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv)); 
        l.setAttribute("download", `Backup_Completo_${getStrYMD(new Date())}.csv`); 
        document.body.appendChild(l);
        l.click(); 
        document.body.removeChild(l);
    } catch(e) { 
        console.error("Error creating full backup CSV:", e); 
    }
}

/**
 * Orchestrates the generation of a multi-page PDF document representing daily dive schedules.
 * Filters current data, groups it by date, and iteratively calls the drawing sub-routine.
 * Uses a timeout to prevent locking the main thread and freezing the UI during generation.
 * @returns {void}
 */
function executePrintPDF() {
    const monthVal = getEl('print-month').value, centerVal = getEl('print-center').value;
    let targetCenters = centerVal === 'all' ? Object.keys(CENTERS) : [centerVal];
    let filtered = allocations.filter(a => targetCenters.includes(a.center));
    
    if (monthVal !== 'all') {
        filtered = filtered.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === parseInt(monthVal, 10));
    }

    if (filtered.length === 0) { 
        showNotification('Sin Datos', 'No hay reservas para los filtros seleccionados.', true); 
        closePrintModal(); 
        return; 
    }

    // Group allocations linearly by date for sequential page drawing
    const byDate = {};
    filtered.forEach(a => { 
        if (!byDate[a.date]) byDate[a.date] = []; 
        byDate[a.date].push(a); 
    });
    const sortedDates = Object.keys(byDate).sort();

    closePrintModal();
    showNotification('Generando PDF Vectorial', 'Por favor, espera mientras se dibuja el documento...', false);

    // Yield control back to browser to render the loading notification before intensive math begins
    setTimeout(() => {
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'pt', 'a4');
            const startX = 40; 
            let currentY = 40; 

            for (let i = 0; i < sortedDates.length; i++) {
                const date = sortedDates[i];
                const dateItems = byDate[date] || [];
                const centerDailyPax = {}; 
                let totalDailyPax = 0;
                
                dateItems.forEach(item => {
                    if(!centerDailyPax[item.center]) centerDailyPax[item.center] = 0;
                    centerDailyPax[item.center] += item.pax;
                    totalDailyPax += item.pax;
                });

                // Pagination logic: fits exactly 3 daily schedule blocks per A4 page
                if (i > 0 && i % 3 === 0) { 
                    doc.addPage(); 
                    currentY = 40; 
                }
                drawDayBlock(doc, date, dateItems, centerDailyPax, totalDailyPax, startX, currentY);
                currentY += 230; // Spacing offset for the next daily block
            }

            doc.save(`Planificacion_${centerVal}_${monthVal}.pdf`);
            closeNotification();
        } catch (err) {
            console.error("PDF Generation Error: ", err);
            showNotification('Error', 'Hubo un problema al generar el PDF.', true);
        }
    }, 100); 
}

/**
 * A highly specific, low-level drawing routine that uses jsPDF primitive functions 
 * (rect, line, text) to paint a complex, true-vector table representing a single 
 * day's dive schedule on the PDF canvas.
 * @param {jsPDF} doc - The active jsPDF document instance.
 * @param {string} dateStr - The target date (YYYY-MM-DD) being drawn.
 * @param {Array} dateItems - Array of reservation objects occurring on this date.
 * @param {Object} centerDailyPax - Tally of total passengers assigned to each center for this date.
 * @param {number} totalDailyPax - Grand total of passengers across all centers for this date.
 * @param {number} startX - Absolute X coordinate (points) defining the left edge of the block.
 * @param {number} startY - Absolute Y coordinate (points) defining the top edge of the block.
 * @returns {void}
 */
function drawDayBlock(doc, dateStr, dateItems, centerDailyPax, totalDailyPax, startX, startY) {
    const dObj = parseDateT00(dateStr);
    const dayName = DAYS_ES[dObj.getDay()].substring(0,3).toUpperCase();
    const dateTitle = `${dayName}. ${dObj.getDate()}-${MONTHS_SHORT[dObj.getMonth()].toUpperCase()}`;
    
    const timeLabels = ['09:00 - 10:30', '10:30 - 12:00', '12:00 - 13:30', '13:30 - 15:00', '15:00 - 16:30', '16:30 - 18:00', '18:00 - 19:00'];
    const timeKeys = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'];

    let siteColumnTotals = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0 };
    dateItems.forEach(it => { 
        if (siteColumnTotals[it.site] !== undefined) siteColumnTotals[it.site] += it.pax; 
    });

    // Brand-compliant PDF HEX colors
    const colorPink = '#f20884', colorYellow = '#ffff00', colorLightGray = '#f8fafc';
    const rowH = 14, subH = 12, restH = 12;

    // Helper closure to abstract repetitive jsPDF fill/stroke/text boilerplate
    const drawBox = (x, y, w, h, bg, text, textColor, fontStyle, fontSize) => {
        if (bg) { 
            doc.setFillColor(bg); 
            doc.rect(x, y, w, h, 'F'); 
        }
        doc.setDrawColor(0, 0, 0); 
        doc.setLineWidth(0.5); 
        doc.rect(x, y, w, h, 'S');
        
        if (text !== undefined && text !== null && text !== '') {
            doc.setTextColor(textColor); 
            doc.setFont('helvetica', fontStyle); 
            doc.setFontSize(fontSize);
            // Vertically centers text based on font size ratio offset
            doc.text(text.toString(), x + (w / 2), y + (h / 2) + (fontSize * 0.35), { align: 'center' });
        }
    };

    let currentY = startY;
    const dayTotalCap = SITES.reduce((sum, s) => sum + getDailyCapacity(dateStr, s), 0) + 20;
    // Render Table Header (Date and Global Capacity)
    drawBox(startX, currentY, 80, rowH, colorLightGray, dateTitle, '#000', 'bold', 8);
    drawBox(startX + 80, currentY, 360, rowH, colorPink, `${dayTotalCap} PLAZAS`, '#fff', 'bold', 10);
    currentY += rowH;

    drawBox(startX, currentY, 55, rowH, colorYellow, dayTotalCap.toString(), '#000', 'bold', 8);
    drawBox(startX + 55, currentY, 25, rowH, colorYellow, 'S4', '#000', 'bold', 8);
    
    let currentX = startX + 80;
    SITES.forEach(s => {
        let cleanName = s === 'Bajo de Dentro' ? 'DENTRO' : (s === 'Piles II' ? 'PILES 2' : (s === 'Piles I' ? 'PILES 1' : s.toUpperCase()));
        drawBox(currentX, currentY, 72, rowH, colorLightGray, cleanName, '#000', 'bold', 8);
        currentX += 72;
    });
    currentY += rowH;

    drawBox(startX, currentY, 80, rowH, colorPink, '', '#fff', 'bold', 8);
    currentX = startX + 80;
    
    // Render Site Specific Totals vs Assigned
    SITES.forEach(s => {
        const cap = getDailyCapacity(dateStr, s);
        drawBox(currentX, currentY, 36, rowH, colorPink, cap, '#000', 'bold', 8); 
        drawBox(currentX + 36, currentY, 36, rowH, colorPink, siteColumnTotals[s], '#000', 'bold', 8); 
        currentX += 72;
    });
    currentY += rowH;

    // Iterate through time slots and render individual boat sub-blocks
    timeKeys.forEach((tm, idx) => {
        if (tm === '13:30') {
            // Render resting period block
            drawBox(startX, currentY, 55, restH, '#e2e8f0', timeLabels[idx], '#000', 'normal', 7); 
            drawBox(startX + 55, currentY, 25, restH, colorYellow, '', '#000', 'normal', 7);
            drawBox(startX + 80, currentY, 360, restH, '#000000', '', '#fff', 'normal', 7);
            currentY += restH; 
            return;
        }

        const timeRowH = subH * 2; 
        drawBox(startX, currentY, 55, timeRowH, colorLightGray, timeLabels[idx], '#000', 'normal', 7); 
        drawBox(startX + 55, currentY, 25, timeRowH, colorYellow, '', '#000', 'normal', 7);

        currentX = startX + 80;
        SITES.forEach(s => {
            const items = dateItems.filter(i => i.time === tm && i.site === s);
            let it1 = items.find(i => i.subslot === 1) || items[0];
            let it2 = items.find(i => i.subslot === 2) || (items.length > 1 ? items[1] : null);
            
            if(items.length === 1) { 
                it1 = items[0]; 
                it2 = null; 
            }

            // Outline the master slot cell
            doc.setDrawColor(0); 
            doc.setLineWidth(0.5); 
            doc.rect(currentX, currentY, 72, timeRowH, 'S');

            // Draw up to two center-specific mini-blocks per site/time slot
            const drawSub = (it, subY) => {
                if (!it) return;
                const cInfo = CENTERS[it.center];
                doc.setFillColor(cInfo.pdfBg); 
                doc.rect(currentX, subY, 28, subH, 'F');
                doc.setDrawColor(0); 
                doc.line(currentX + 28, subY, currentX + 28, subY + subH);
                
                doc.setTextColor(cInfo.pdfText); 
                doc.setFont('helvetica', 'bold'); 
                doc.setFontSize(8);
                doc.text(it.center, currentX + 14, subY + (subH / 2) + (8 * 0.35), { align: 'center' });
                
                doc.setTextColor('#000'); 
                doc.setFont('helvetica', 'normal'); 
                doc.setFontSize(8);
                doc.text(it.pax.toString(), currentX + 50, subY + (subH / 2) + (8 * 0.35), { align: 'center' });
            };

            drawSub(it1, currentY); 
            drawSub(it2, currentY + subH);
            currentX += 72;
        });
        currentY += timeRowH;
    });

    // Render footer capacity differentials
    drawBox(startX, currentY, 80, rowH, colorYellow, '', '#000', 'bold', 8);
    currentX = startX + 80;
    SITES.forEach(s => {
        const cap = getDailyCapacity(dateStr, s);
        const diff = cap - siteColumnTotals[s];
        const diffText = cap === 0 ? '-' : (diff >= 0 ? `+${diff}` : diff.toString());
        const diffColor = cap === 0 ? '#94a3b8' : (diff >= 0 ? '#2563eb' : '#dc2626');
        
        drawBox(currentX, currentY, 72, rowH, '#ffffff', diffText, diffColor, 'normal', 8);
        currentX += 72;
    });

    // Render center-specific totals legend at the far right of the row block
    const legendX = startX + 455; 
    let legendY = startY;
    
    ['B', 'D', 'H', 'M', 'N', 'P', 'X', 'C'].forEach(k => {
        if(!CENTERS[k]) return; 
        const cInfo = CENTERS[k];
        const paxCount = centerDailyPax[k] || 0; 
        
        drawBox(legendX, legendY, 25, subH, cInfo.pdfBg, k, cInfo.pdfText, 'bold', 8);
        drawBox(legendX + 25, legendY, 35, subH, '#ffffff', paxCount.toString(), '#000', 'normal', 8); 
        legendY += subH;
    });
    
    drawBox(legendX, legendY, 25, subH, '#94a3b8', '', '#fff', 'normal', 8);
    drawBox(legendX + 25, legendY, 35, subH, colorLightGray, totalDailyPax.toString(), '#000', 'normal', 8);
}