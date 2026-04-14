/**
 * @file ui.js
 * @description The View Layer. Responsible strictly for DOM manipulation, repainting grids,
 * toggling modals, and updating visual filters based on the current state of the application.
 */

/* =========================================================================
   1. CORE RENDERERS (THE MAIN VIEWPORTS)
   ========================================================================= */

/**
 * Renders the Primary Daily View (Diario). Calculates capacities for the active date
 * and constructs the interactive 2-column drag-and-drop grid for each site.
 * @returns {void}
 */
function renderDaily() {
    if(activeViewMode !== 'diario') return;
    const ds = getStrYMD(currentDate);
    const activeSites = getDailySites(ds);
    
    getEl('daily-date-header').textContent = `${DAYS_ES[currentDate.getDay()]}, ${currentDate.getDate()} DE ${MONTHS_ES[currentDate.getMonth()]} DE ${currentDate.getFullYear()}`;
    
    let maxDailyCap = activeSites.reduce((sum, s) => sum + getDailyCapacity(ds, s), 0) + 20; // +20 from Palomas
    getEl('daily-max-header').textContent = maxDailyCap;

    const gridColsClass = `grid-cols-[76px_28px_repeat(${activeSites.length},1fr)]`;
    const footerColsClass = `grid-cols-[104px_repeat(${activeSites.length},1fr)]`;

    let headerHtml = `<div class="grid ${gridColsClass} border-b-2 border-slate-200 bg-slate-50 text-[9px] font-bold text-blue-700 text-center uppercase tracking-wider sticky top-0 z-10 shadow-sm">
        <div class="p-3 text-slate-500 border-r border-slate-100 flex items-center justify-center">Hora</div>
        <div class="p-3 text-slate-400 border-r border-slate-200 flex items-center justify-center" title="Posición">P.</div>`;
    
    activeSites.forEach(s => {
        let cleanName = s === 'Bajo de Dentro' ? 'Bajo de Dentro' : s;
        headerHtml += `<div class="p-3 border-r border-slate-200 flex items-center justify-center gap-1">${cleanName}</div>`;
    });
    headerHtml += `</div>`;

    let gridBodyHtml = '';
    const t = {};
    activeSites.forEach(s => t[s] = 0);
    let totalFilteredPax = 0;

    TIMES.forEach(time => {
        if (time === '13:30') {
            gridBodyHtml += `<div class="grid ${gridColsClass} border-b border-slate-200 bg-red-50/60 min-h-[40px]"><div class="flex items-center justify-center border-r border-slate-200 font-black text-red-400 text-[10px] col-span-2">13:30</div><div class="col-span-${activeSites.length} flex items-center justify-center text-red-500 font-black italic text-[10px] tracking-[0.5em] opacity-80 uppercase">Descanso</div></div>`;
            return;
        }

        let subRow1 = ''; let subRow2 = '';

        activeSites.forEach(site => {
            const siteItems = allocations.filter(a => a.date === ds && a.time === time && a.site === site);
            const renderedItems = siteItems.filter(item => selectedCenters.includes(item.center));
            
            let item1 = renderedItems.find(i => i.subslot === 1), item2 = renderedItems.find(i => i.subslot === 2);

            if (renderedItems.length === 1) { item1 = renderedItems[0]; item2 = null; } 
            else if (renderedItems.length === 2) {
                if (!item1 && !item2) { item1 = renderedItems[0]; item2 = renderedItems[1]; } 
                else if (item1 && !item2) { item2 = renderedItems.find(i => String(i.id) !== String(item1.id)); } 
                else if (!item1 && item2) { item1 = renderedItems.find(i => String(i.id) !== String(item2.id)); }
            }

            const createBlockHTML = (item) => {
                t[site] += item.pax; totalFilteredPax += item.pax;
                const c = CENTERS[item.center];
                const isPending = swapRequests.some(s => String(s.initiatorId) === String(item.id) || String(s.targetId) === String(item.id));
                const ghostClass = isPending ? 'pending-swap-ghost' : '';
                const canDragBlock = !isPending && !isGuestMode && (currentUserKey === 'admin' || item.center === USER_CENTER_KEYS[currentUserKey]);
                
                const dragAttrs = canDragBlock ? `draggable="true" data-drag-id="${item.id}"` : `draggable="false" data-drag-id="${item.id}"`;
                const cursorClass = canDragBlock ? `cursor-grab active:cursor-grabbing hover:opacity-90 draggable-item` : `cursor-default opacity-90`;

                const hasNote = item.note && item.note.trim() !== '';
                const safeNote = hasNote ? item.note.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
                
                const noteIndicator = hasNote 
                    ? `<span class="absolute -top-1 -right-1 flex h-3 w-3 z-10"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-yellow-500 border border-white shadow-sm"></span></span>` 
                    : '';
                
                // Uses our new native CSS classes instead of Tailwind group-hover
                const customTooltip = hasNote
                    ? `<div class="custom-tooltip note-tooltip">
                        <div class="note-title">Nota adjunta</div>
                        <div class="note-body">${safeNote}</div>
                       </div>`
                    : `<div class="custom-tooltip">
                        ${c.name} - ${item.pax} plazas
                       </div>`;

                return `<div ${dragAttrs} ondblclick="handleBoatDoubleClick(event, '${item.id}')" class="boat-block w-full h-[34px] rounded-[4px] px-2 py-1.5 flex justify-between items-center text-[10px] font-bold shadow-sm ${c.color} ${c.text} ${ghostClass} ${cursorClass}">
                    ${customTooltip}
                    ${noteIndicator}
                    <div class="truncate flex items-center gap-1.5 pointer-events-none"><span class="bg-black/20 px-1.5 rounded-sm">${item.center}</span><span>${c.name} ${isPending ? '🔄' : ''}</span></div>
                    <span class="bg-black/20 px-1.5 py-0.5 rounded-sm pointer-events-none">${item.pax}</span>
                </div>`;
            };

            let html1 = item1 ? createBlockHTML(item1) : '', html2 = item2 ? createBlockHTML(item2) : '';
            subRow1 += `<div class="border-r border-b border-slate-100 p-0.5 flex flex-col justify-start dropzone bg-white" data-time="${time}" data-site="${site}" ondblclick="handleSlotDoubleClick('${time}', '${site}')">${html1}</div>`;
            subRow2 += `<div class="border-r border-slate-100 p-0.5 flex flex-col justify-start dropzone bg-white" data-time="${time}" data-site="${site}" ondblclick="handleSlotDoubleClick('${time}', '${site}')">${html2}</div>`;
        });

        gridBodyHtml += `<div class="grid ${gridColsClass} border-b border-slate-200">
            <div class="row-span-2 flex items-center justify-center border-r border-slate-200 font-black italic text-slate-500 text-sm bg-slate-50/20">${time}</div>
            <div class="flex items-center justify-center border-r border-b border-slate-100 text-[8px] font-bold text-slate-400 bg-slate-50/50">1</div>${subRow1}
            <div class="flex items-center justify-center border-r border-slate-100 text-[8px] font-bold text-slate-400 bg-slate-50/50">2</div>${subRow2}</div>`;
    });
    
    getEl('total-pax-header').textContent = totalFilteredPax;

    let footerHtml = `<div class="grid ${footerColsClass} bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-500 text-center items-center shrink-0">
        <div class="p-4 flex justify-start border-r border-slate-200 italic pl-6 tracking-widest text-[10px]">OCUPACIÓN:</div>`;
    
    activeSites.forEach(s => {
        const cap = getDailyCapacity(ds, s);
        const assigned = t[s];
        const color = assigned > cap ? 'text-red-600' : 'text-green-600';
        const icon = assigned > cap ? '❌' : '✅';
        footerHtml += `<div class="p-4 border-r border-slate-200"><div class="flex flex-col items-center"><span class="${color} font-black text-lg leading-none">${assigned}</span><div class="w-8 border-t border-slate-300 my-0.5"></div><span class="text-slate-500 font-bold leading-none">${cap} ${icon}</span></div></div>`;
    });
    footerHtml += `</div>`;

    getEl('daily-grid-container').innerHTML = headerHtml + `<div id="schedule-grid">${gridBodyHtml}</div>`;
    getEl('daily-footer-container').innerHTML = footerHtml;
}

function renderMega() {
    if(activeViewMode !== 'semanal' && activeViewMode !== 'mensual') return;
    const isW = activeViewMode === 'semanal';
    const start = isW ? getMonday(currentDate) : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const num = isW ? 7 : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    getEl('mega-date-header').textContent = isW ? `Semana ${getWeekNumber(currentDate)} - ${currentDate.getFullYear()}` : `${MONTHS_ES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    const anchor = `<svg class="w-3 h-3 inline mr-1 text-blue-500" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg>`;
    let h = `<div class="mega-grid text-[10px] text-center"><div class="sticky top-0 left-0 bg-slate-100 border-r-2 border-b-2 border-slate-300 z-50 flex items-center justify-center font-bold text-slate-500 h-[72px]" style="grid-row: span 2;">FECHA</div>`;
    SITES.forEach(s => h += `<div class="sticky top-0 z-40 bg-white text-blue-700 border-r-2 border-b-2 border-slate-200 h-10 flex items-center justify-center font-black uppercase tracking-widest" style="grid-column: span 7;">${anchor} ${s}</div>`);
    SITES.forEach(() => TIMES.forEach(tm => h += `<div class="sticky top-[40px] z-30 border-r border-b-2 border-slate-300 h-8 flex items-center justify-center font-bold ${tm === '13:30' ? 'bg-red-50 text-red-400' : 'bg-slate-50 text-slate-500'}">${tm}</div>`));
    
    for (let i = 0; i < num; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i); const ds = getStrYMD(d);
        const isD = isRedCalendarDay(ds);
        h += `<div class="sticky left-0 bg-white border-r-2 border-b border-slate-200 flex flex-col justify-center items-center z-10 py-1 shadow-sm cursor-pointer hover:bg-blue-50" onclick="setDate('${ds}'); switchView('diario');">
            <span class="font-bold text-[8px] ${isD ? 'text-red-400' : 'text-slate-400'}">${DAYS_ES[d.getDay()].substring(0,3)}</span><span class="text-xs font-black ${isD ? 'text-red-600' : 'text-slate-800'}">${d.getDate()}</span></div>`;
        SITES.forEach(s => TIMES.forEach(tm => {
            const its = allocations.filter(a => a.date === ds && a.site === s && a.time === tm && selectedCenters.includes(a.center));
            h += `<div class="border-r border-b border-slate-200 ${tm === '13:30' ? 'bg-red-50/20' : 'bg-white'} p-[2px] flex flex-col gap-[2px] min-h-[44px]">`;
            its.forEach(it => { 
                const c = CENTERS[it.center]; 
                const ghostClass = swapRequests.some(sw => String(sw.initiatorId) === String(it.id) || String(sw.targetId) === String(it.id)) ? 'opacity-40 grayscale border border-slate-400' : '';
                h += `<span class="${c.color} ${c.text} ${ghostClass} w-full py-[2px] rounded-[3px] font-bold text-[8px] leading-none shadow-sm">${it.center}${it.pax}</span>`; 
            });
            h += `</div>`;
        }));
    }
    getEl('mega-grid-container').innerHTML = h + `</div>`;
}

function renderStats() {
    if(activeViewMode !== 'estadisticas') return;
    const anchor = `<svg class="w-3.5 h-3.5 inline mr-1.5 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/></svg>`;
    const isBarcos = statsUnit === 'barcos';
    const filteredAllocations = allocations.filter(a => selectedCenters.includes(a.center));
    
    // 1. Core Mathematical Aggregation
    const cStats = {}; 
    const gTot = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 };
    
    Object.keys(CENTERS).forEach(k => { cStats[k] = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 }; });
    filteredAllocations.forEach(a => { 
        const val = isBarcos ? 1 : a.pax; 
        cStats[a.center][a.site] += val; 
        cStats[a.center].total += val; 
        gTot[a.site] += val; 
        gTot.total += val; 
    });

    // 2. Build the Global Table
    let tableHtml = `<div class="w-full overflow-x-auto rounded-xl border border-slate-200 shadow-sm mb-12 bg-white"><table class="w-full text-left min-w-[900px] stats-table"><thead><tr class="border-b border-slate-200 bg-white"><th class="px-5 py-4 align-bottom border-r border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500 w-56" rowspan="2">Centro</th>`;
    SITES.forEach(s => tableHtml += `<th class="pt-5 pb-3 px-2 text-center border-r border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600" colspan="2"><div class="flex items-center justify-center gap-1.5">${anchor}<span>${s}</span></div></th>`);
    tableHtml += `<th class="px-5 py-4 text-center align-middle bg-[#111827] text-white text-[10px] font-black uppercase tracking-widest" rowspan="2">Total Real</th></tr><tr class="border-b border-slate-200 bg-white">`;
    SITES.forEach(() => tableHtml += `<th class="py-2.5 px-1 text-center border-r border-slate-100 text-[9px] font-bold uppercase text-slate-400">Cant.</th><th class="py-2.5 px-1 text-center border-r border-slate-100 text-[9px] font-bold uppercase text-blue-500">% P.</th>`);
    tableHtml += `</tr></thead><tbody>`;

    Object.keys(CENTERS).forEach(k => {
        const c = CENTERS[k], s = cStats[k];
        if(s.total === 0) return; 
        tableHtml += `<tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-white"><td class="px-5 py-4 border-r border-slate-100"><div class="flex items-center gap-4"><span class="w-7 h-7 rounded ${c.color} ${c.text} flex items-center justify-center text-[11px] font-black shadow-sm shrink-0">${k}</span><span class="font-bold text-slate-800 text-sm whitespace-nowrap">${c.name}</span></div></td>`;
        SITES.forEach(site => {
            const count = s[site], percent = gTot[site] > 0 ? ((count / gTot[site]) * 100).toFixed(1) : '0.0';
            tableHtml += `<td class="py-4 px-2 text-center text-slate-700 font-semibold text-[13px] border-r border-slate-100">${count.toLocaleString('en-US')}</td><td class="py-4 px-2 text-center text-blue-500 font-semibold text-[11px] border-r border-slate-100">${percent}%</td>`;
        });
        tableHtml += `<td class="px-5 py-4 text-center font-black text-slate-900 text-[14px] tracking-wide border-l border-slate-200 bg-white">${s.total.toLocaleString('en-US')}</td></tr>`;
    });

    tableHtml += `</tbody><tfoot><tr><td class="px-5 py-4 text-[10px] font-black uppercase tracking-widest bg-[#1f2937] text-white border-r border-slate-700">Totales Por Punto</td>`;
    SITES.forEach(s => tableHtml += `<td class="py-4 px-2 text-center bg-[#111827] border-r border-slate-700 font-bold text-blue-400 text-[15px]">${gTot[s].toLocaleString('en-US')}</td><td class="py-4 px-2 text-center bg-[#111827] border-r border-slate-700 font-medium text-slate-500 text-[11px]">100%</td>`);
    tableHtml += `<td class="px-5 py-4 text-center bg-[#3b82f6] text-white font-bold text-lg tracking-wide italic">${gTot.total.toLocaleString('en-US')} <span class="not-italic text-[10px] font-normal tracking-widest ml-1 opacity-90">${isBarcos ? 'SAL.' : 'BUC.'}</span></td></tr></tfoot></table></div>`;

    getEl('safe-main-table-container').innerHTML = tableHtml;

    // 3. Render the Specific Selected Month
    const mGrid = getEl('stats-monthly-grid'); 
    mGrid.innerHTML = '';
    
    const monthSelector = getEl('stats-month-selector');
    if (!monthSelector) return;
    
    const m = parseInt(monthSelector.value, 10);
    const mAlloc = filteredAllocations.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === m);
    
    if (mAlloc.length === 0) {
        mGrid.innerHTML = `<div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center text-slate-500 italic">No hay datos para ${MONTHS_ES[m]}.</div>`;
        return;
    }
    
    const mStats = {}; 
    Object.keys(CENTERS).forEach(k => mStats[k] = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 });
    mAlloc.forEach(a => { const val = isBarcos ? 1 : a.pax; mStats[a.center][a.site] += val; mStats[a.center].total += val; });

    let cHtml = `<div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-7 hover:shadow-md transition-shadow"><div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-3"><h4 class="font-black italic text-lg md:text-xl uppercase tracking-tight text-slate-900">${MONTHS_ES[m]} 2026</h4><span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded tracking-widest uppercase border border-emerald-100">${statsUnit}</span></div><div class="overflow-x-auto"><table class="w-full text-left text-xs min-w-[400px]"><thead><tr class="text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 text-[9px]"><th class="pb-2 font-bold">Centro</th><th class="pb-2 text-center">Bajo</th><th class="pb-2 text-center">Piles</th><th class="pb-2 text-center">Piles</th><th class="pb-2 text-center">Testa</th><th class="pb-2 text-center">Morra</th><th class="pb-2 text-center font-black text-slate-800 bg-slate-50 px-2 rounded-t-lg">Total</th></tr></thead><tbody>`;
    Object.keys(CENTERS).forEach(k => {
        const st = mStats[k]; if(st.total === 0) return; const c = CENTERS[k];
        cHtml += `<tr class="border-b border-slate-50 hover:bg-slate-50/50"><td class="py-2.5 font-bold flex items-center gap-2 text-slate-700 text-[10px]"><span class="w-3.5 h-3.5 rounded-sm ${c.color} ${c.text} flex items-center justify-center text-[7px] font-black">${k}</span> ${c.name}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Bajo de Dentro'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Piles II'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Piles I'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Testa'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Morra'].toLocaleString('en-US')}</td><td class="py-2.5 text-center font-black text-slate-900 bg-slate-50 px-2">${st.total.toLocaleString('en-US')}</td></tr>`;
    });
    cHtml += `</tbody></table></div></div>`;
    
    mGrid.innerHTML = cHtml;
}

function renderCalendar() {
    const grid = getEl('calendar-grid'); grid.innerHTML = '';
    const y = currentDate.getFullYear(), m = currentDate.getMonth(), dsToday = getStrYMD(currentDate);
    
    const selSidebar = getEl('month-selector-sidebar');
    if (selSidebar) selSidebar.value = m;
    
    const selMain = getEl('month-selector-main');
    if (selMain) selMain.value = m;
    
    const selWeek = getEl('week-selector');
    if (selWeek) selWeek.value = getWeekNumber(currentDate);
    
    const first = new Date(y, m, 1).getDay(), off = first === 0 ? 6 : first - 1;
    for (let i = 0; i < off; i++) grid.appendChild(document.createElement('div'));
    
    for (let d = 1; d <= new Date(y, m+1, 0).getDate(); d++) {
        const dt = new Date(y, m, d), ds = getStrYMD(dt);
        const isD = isRedCalendarDay(ds);
        const el = document.createElement('div'); el.textContent = d; el.onclick = () => setDate(ds);
        el.className = `py-1.5 transition-colors text-xs ${ds === dsToday ? 'calendar-day-active shadow-md' : 'calendar-day-inactive ' + (isD ? 'text-red-500 font-bold' : 'text-slate-600')}`;
        grid.appendChild(el);
    }
}

function renderHistory() {
    if (activeViewMode !== 'historial') return;
    const listEl = getEl('history-list');
    const paginationEl = getEl('history-pagination');
    if (!listEl) return;
    listEl.innerHTML = '';

    const sortedLogs = [...historyLogs].sort((a, b) => (b.timestamp?.toMillis() || Date.now()) - (a.timestamp?.toMillis() || Date.now()));
    const filteredLogs = sortedLogs.filter(log => {
        const codeKey = USER_CENTER_KEYS[log.centerKey];
        const isCenterSelected = selectedCenters.includes(codeKey);
        let isMonthSelected = true;
        if (selectedHistoryMonth !== 'all') isMonthSelected = parseDateT00(log.details.date).getMonth() === parseInt(selectedHistoryMonth);
        return isCenterSelected && isMonthSelected;
    });

    if (filteredLogs.length === 0) {
        listEl.innerHTML = `<p class="text-sm text-slate-500 italic text-center py-10">No hay registros para mostrar con los filtros seleccionados.</p>`;
        if (paginationEl) hideEl('history-pagination');
        return;
    }

    const totalPages = Math.ceil(filteredLogs.length / historyItemsPerPage);
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    if (historyCurrentPage < 1) historyCurrentPage = 1;

    const startIndex = (historyCurrentPage - 1) * historyItemsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + historyItemsPerPage);

    paginatedLogs.forEach(log => {
        let icon = ''; let text = ''; let headerPills = '';
        let logDateStr = 'Ahora mismo';
        if (log.timestamp) {
            const d = log.timestamp.toDate();
            logDateStr = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
        }
        const targetDObj = parseDateT00(log.details.date);
        const targetDateStr = `${targetDObj.getDate()} de ${MONTHS_SHORT[targetDObj.getMonth()]}`;

        // Render logic mapped to the 5 possible action types
        if (log.actionType === 'donation') {
            icon = '🤲';
            const targetInfo = getCenterInfoSafe(log.centerKey), initInfo = getCenterInfoSafe(log.details.targetCenter);
            headerPills = `<span class="px-2.5 py-1.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-sm ${targetInfo.color} ${targetInfo.text}">${targetInfo.name}</span><span class="text-slate-400 text-xs mx-1">➡️</span><span class="px-2.5 py-1.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-sm ${initInfo.color} ${initInfo.text}">${initInfo.name}</span>`;
            text = `Cedió ${log.details.pax} plazas en <b>${log.details.site} (${log.details.time})</b> el ${targetDateStr}.`;
        } else if (log.actionType === 'swap') {
            icon = '🔀';
            const initInfo = getCenterInfoSafe(log.details.initCenter || log.centerKey), targetInfo = getCenterInfoSafe(log.details.targetCenter);
            headerPills = `<span class="px-2.5 py-1.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-sm ${initInfo.color} ${initInfo.text}">${initInfo.name}</span><span class="text-slate-400 text-xs mx-1">🤝</span><span class="px-2.5 py-1.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-sm ${targetInfo.color} ${targetInfo.text}">${targetInfo.name}</span>`;
            const initPax = log.details.initPax ? ` de ${log.details.initPax} plazas` : '', targetPax = log.details.targetPax ? ` de ${log.details.targetPax} plazas` : '';
            text = `Para el <b>${targetDateStr}</b>, <b>${initInfo.name}</b> intercambió su salida en <b>${log.details.initSite} (${log.details.initTime})${initPax}</b> por la salida en <b>${log.details.targetSite} (${log.details.targetTime})${targetPax}</b> de <b>${targetInfo.name}</b>.`;
        } else {
            const cInfo = getCenterInfoSafe(log.centerKey);
            headerPills = `<span class="px-2.5 py-1.5 rounded-[4px] text-[10px] font-black uppercase tracking-widest shadow-sm ${cInfo.color} ${cInfo.text}">${cInfo.name}</span>`;
            
            if (log.actionType === 'add') {
                icon = '➕'; text = `Añadió una salida a <b>${log.details.site}</b> a las <b>${log.details.time}</b> el ${targetDateStr} (${log.details.pax} plazas).`;
            } else if (log.actionType === 'move') {
                icon = '➡️'; text = `Movió su barco del ${targetDateStr} de <b>${log.details.oldSite} (${log.details.oldTime})</b> a <b>${log.details.newSite} (${log.details.newTime})</b>.`;
            } else if (log.actionType === 'edit') {
                icon = '✏️'; text = `Modificó las plazas de su salida en <b>${log.details.site} (${log.details.time})</b> el ${targetDateStr} (de ${log.details.oldPax} a ${log.details.newPax} plazas).`;
            } else if (log.actionType === 'delete') {
                icon = '🗑️'; text = `Eliminó su salida en <b>${log.details.site} (${log.details.time})</b> el ${targetDateStr} (${log.details.pax} plazas).`;
            }
        }

        listEl.innerHTML += `
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm flex gap-4 hover:shadow-md transition-shadow">
                <div class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-lg shrink-0 shadow-sm">${icon}</div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2"><div class="flex items-center">${headerPills}</div><span class="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-md border border-slate-100 flex items-center gap-1.5"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${logDateStr}</span></div>
                    <p class="text-sm text-slate-600 leading-relaxed">${text}</p>
                </div>
            </div>`;
    });

    if (paginationEl) {
        showEl('history-pagination');
        getEl('hist-page-info').textContent = `Pág ${historyCurrentPage} de ${totalPages}`;
        getEl('btn-hist-prev').disabled = historyCurrentPage === 1;
        getEl('btn-hist-next').disabled = historyCurrentPage === totalPages;
    }
}

function renderAll() { 
    renderCalendar(); 
    renderDaily(); 
    renderMega(); 
    renderStats(); 
    renderHistory(); 
}

function switchView(v) {
    activeViewMode = v;
    ['diario', 'mega', 'estadisticas', 'historial'].forEach(id => {
        const el = getEl(`view-${id}`);
        if(el) {
            const isActive = id === v || (id === 'mega' && (v === 'semanal' || v === 'mensual'));
            el.classList.toggle('flex', isActive);
            el.classList.toggle('hidden', !isActive);
        }
    });
    
    ['diario', 'semanal', 'mensual', 'estadisticas'].forEach(id => {
        const tab = getEl(`tab-${id}`);
        if(tab) tab.className = `px-5 py-2.5 flex items-center gap-2 transition-all ${id === v ? 'tab-active' : 'tab-inactive'}`;
    });

    const sidebar = getEl('sidebar-calendario');
    const periodSelectors = getEl('toolbar-period-selectors');
    const gBar = getEl('global-filter-bar');
    
    if (gBar) gBar.classList.toggle('hidden', v === 'estadisticas');
    
    const mainCont = getEl('main-content-area');
    if (mainCont) mainCont.classList.toggle('hidden', v === 'estadisticas' || v === 'historial');
    
    const histWrap = getEl('history-month-filter-wrapper');
    if (histWrap) { 
        histWrap.classList.toggle('hidden', v !== 'historial'); 
        histWrap.classList.toggle('flex', v === 'historial'); 
    }

    if (sidebar) {
        sidebar.classList.toggle('hidden', v !== 'diario');
        sidebar.classList.toggle('flex', v === 'diario');
        sidebar.classList.toggle('lg:flex', v === 'diario');
    }
    
    if (periodSelectors) periodSelectors.classList.toggle('hidden', v === 'diario' || v === 'estadisticas' || v === 'historial');
    
    const tWeek = getEl('toolbar-week');
    if (tWeek) tWeek.classList.toggle('hidden', v !== 'semanal');
    
    const tMonth = getEl('toolbar-month');
    if (tMonth) tMonth.classList.toggle('hidden', v !== 'mensual');

    renderAll();
}

function setStatsUnit(unit) { 
    statsUnit = unit; 
    const udTxt = getEl('unit-dropdown-text'); 
    if(udTxt) udTxt.textContent = unit === 'barcos' ? 'Barcos (Salidas)' : 'Plazas (Buceadores)'; 
    renderStats(); 
}

function initFilters() {
    const c = getEl('filter-container'); 
    if (!c) return;
    c.innerHTML = '';
    
    Object.keys(CENTERS).forEach(k => {
        const cn = CENTERS[k], ck = selectedCenters.includes(k);
        const l = document.createElement('label'); l.className = 'flex items-center gap-3 p-2 hover:bg-slate-50 rounded-md transition-colors cursor-pointer';
        l.innerHTML = `<input type="checkbox" ${ck ? 'checked' : ''} onchange="toggleCenter('${k}')" class="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"><span class="w-6 h-6 rounded ${cn.color} ${cn.text} flex items-center justify-center text-[10px] font-black">${k}</span><span class="text-sm font-semibold text-slate-700">${cn.name}</span>`;
        c.appendChild(l);
    });
    
    const fbText = getEl('filter-button-text');
    if (fbText) fbText.textContent = selectedCenters.length === Object.keys(CENTERS).length ? 'TODOS LOS CENTROS' : `${selectedCenters.length} SELECCIONADOS`;
}

function initSelectors() {
    let mH = ''; 
    for(let i=0; i<12; i++) mH += `<option value="${i}">${MONTHS_ES[i]} 2026</option>`;
    
    const msSidebar = getEl('month-selector-sidebar');
    if (msSidebar) msSidebar.innerHTML = mH;
    
    const msMain = getEl('month-selector-main');
    if (msMain) msMain.innerHTML = mH;
    
    const mContainer = getEl('month-filter-container');
    if (mContainer) {
        mContainer.innerHTML = '';
        const createOption = (val, text) => {
            const isSelected = selectedHistoryMonth === String(val);
            const btn = document.createElement('button');
            btn.className = `w-full text-left p-2 transition-colors flex items-center gap-3 rounded-md hover:bg-slate-50 cursor-pointer`;
            btn.innerHTML = `<div class="w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}">${isSelected ? '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>' : ''}</div> <span class="text-sm font-semibold text-slate-700">${text}</span>`;
            btn.onclick = () => selectHistoryMonth(String(val), text);
            mContainer.appendChild(btn);
        };
        createOption('all', 'TODOS LOS MESES');
        for(let i=0; i<12; i++) createOption(i, `${MONTHS_ES[i]} 2026`);
    }

    const w = getEl('week-selector'); 
    if (w) {
        w.innerHTML = '';
        for(let i=1; i<=52; i++) {
            const s = getDateOfISOWeek(i, 2026), e = new Date(s); e.setDate(s.getDate() + 6);
            w.innerHTML += `<option value="${i}">Semana ${i} (${s.getDate()} ${MONTHS_SHORT[s.getMonth()]} - ${e.getDate()} ${MONTHS_SHORT[e.getMonth()]})</option>`;
        }
    }

    const msStats = getEl('stats-month-selector');
    if (msStats) {
        let statsH = '';
        for(let i=2; i<12; i++) statsH += `<option value="${i}">${MONTHS_ES[i]} 2026</option>`;
        msStats.innerHTML = statsH;
        msStats.value = '2'; // Sets default to March
    }
}

function toggleCenter(k) { selectedCenters = selectedCenters.includes(k) ? selectedCenters.filter(x => x !== k) : [...selectedCenters, k]; historyCurrentPage = 1; initFilters(); renderAll(); }
function setAllFilters(s) { selectedCenters = s ? Object.keys(CENTERS) : []; historyCurrentPage = 1; initFilters(); renderAll(); }
function changeMonth(i) { currentDate.setMonth(parseInt(i)); currentDate.setDate(1); renderAll(); }
function changeWeek(n) { currentDate = getDateOfISOWeek(parseInt(n), 2026); renderAll(); }
function setDate(s) { const p = s.split('-'); currentDate = new Date(p[0], p[1]-1, p[2]); renderAll(); }
function setToday() { currentDate = new Date(); renderAll(); }
function changeDay(delta) { currentDate.setDate(currentDate.getDate() + delta); renderAll(); }
function toggleFilterDropdown() { toggleVis('filter-dropdown-panel'); }
function toggleMonthDropdown() { toggleVis('month-dropdown-panel'); }

function selectHistoryMonth(val, text) {
    selectedHistoryMonth = val;
    historyCurrentPage = 1;
    const mfBtn = getEl('month-filter-button-text');
    if (mfBtn) mfBtn.textContent = text;
    hideEl('month-dropdown-panel');
    initSelectors(); 
    renderHistory();
}

function showNotification(title, message, isError = false) {
    const iconEl = getEl('notification-icon'), titleEl = getEl('notification-title');
    if(isError) {
        iconEl.className = 'mx-auto w-16 h-16 rounded-full mb-4 flex items-center justify-center bg-red-100 text-red-600';
        iconEl.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
        titleEl.className = 'text-xl font-black mb-2 text-red-600';
    } else {
        iconEl.className = 'mx-auto w-16 h-16 rounded-full mb-4 flex items-center justify-center bg-emerald-100 text-emerald-600';
        iconEl.innerHTML = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        titleEl.className = 'text-xl font-black mb-2 text-emerald-600';
    }
    titleEl.textContent = title; 
    getEl('notification-message').textContent = message; 
    showEl('notification-modal');
}

function closeNotification() { hideEl('notification-modal'); }
function openLoginModal() { showEl('password-modal'); }
function closeLoginModal() { hideEl('password-modal'); }
function openHelpModal() { showEl('help-modal'); }

/**
 * Builds and renders the active swap requests UI list targeted at the current user.
 * @returns {void}
 */
function openNotificationsModal() {
    const myCode = USER_CENTER_KEYS[currentUserKey];
    const pendingForMe = swapRequests.filter(s => s.targetCenter === myCode);
    const listEl = getEl('notifications-list'); 
    listEl.innerHTML = '';
    
    if (pendingForMe.length === 0) {
        listEl.innerHTML = `<p class="text-sm text-slate-500 italic text-center py-6">No tienes solicitudes pendientes.</p>`;
    } else {
        pendingForMe.forEach(req => {
            const initName = CENTERS[req.initiatorCenter].name, d = parseDateT00(req.targetData ? req.targetData.date : req.initiatorData.date);
            const dStr = `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
            
            if (req.type === 'donation') {
                const reqText = req.isFull ? 'el barco completo' : `${req.requestedPax} plazas`;
                listEl.innerHTML += `
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div class="flex gap-3 mb-3">
                        <span class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0 text-xs">🤲</span>
                        <div>
                            <p class="text-sm font-bold text-slate-800"><span class="text-emerald-600">${initName}</span> te pide una donación para el <span class="uppercase border-b border-slate-300 pb-0.5">${dStr}</span>:</p>
                            <p class="text-xs text-slate-600 mt-1">Petición: <b>${reqText}</b> de tu salida en <b>${req.targetData.site} (${req.targetData.time})</b>.</p>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="rejectSwap('${req.id}')" class="flex-1 px-3 py-2 bg-white border border-slate-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg transition-colors">Denegar</button>
                        <button onclick="acceptDonation('${req.id}')" class="flex-1 px-3 py-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm">Ceder Plazas</button>
                    </div>
                </div>`;
            } else {
                const initPaxStr = req.initiatorData.originalPax && req.initiatorData.originalPax > req.initiatorData.pax ? `<span class="text-amber-600 font-bold bg-amber-50 px-1 rounded ml-1">(reducido a ${req.initiatorData.pax} pax)</span>` : `(${req.initiatorData.pax} pax)`;
                const targetPaxStr = req.targetData.originalPax && req.targetData.originalPax > req.targetData.pax ? `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-1">(Se reducirá a ${req.targetData.pax} pax)</span>` : `(${req.targetData.pax} pax)`;
                listEl.innerHTML += `
                <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div class="flex gap-3 mb-3">
                        <span class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold shrink-0 text-xs">🔄</span>
                        <div>
                            <p class="text-sm font-bold text-slate-800"><span class="text-blue-600">${initName}</span> te propone un cambio para el <span class="uppercase border-b border-slate-300 pb-0.5">${dStr}</span>:</p>
                            <p class="text-xs text-slate-600 mt-1">Te ofrecen: <b>${req.initiatorData.site} a las ${req.initiatorData.time}</b> ${initPaxStr}.</p>
                            <p class="text-xs text-slate-600">A cambio de tu: <b>${req.targetData.site} a las ${req.targetData.time}</b> ${targetPaxStr}.</p>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-3">
                        <button onclick="rejectSwap('${req.id}')" class="flex-1 px-3 py-2 bg-white border border-slate-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-lg transition-colors">Rechazar</button>
                        <button onclick="acceptSwap('${req.id}')" class="flex-1 px-3 py-2 bg-[#25D366] hover:bg-[#1ebd5a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm">Aceptar Cambio</button>
                    </div>
                </div>`;
            }
        });
    }
    showEl('notifications-modal');
}

function togglePassword() {
    const pwdInput = getEl('login-password');
    const eyeIcon = getEl('eye-icon');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
    } else {
        pwdInput.type = 'password';
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
    }
}

function buildUserMenu() {
    let html = '';
    const myCode = USER_CENTER_KEYS[currentUserKey];
    const pendingForMe = swapRequests.filter(s => s.targetCenter === myCode);
    
    if (pendingForMe.length > 0 && !isGuestMode && currentUserKey !== 'admin') {
        html += `<button onclick="openNotificationsModal(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-between"><div class="flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg> Notificaciones</div> <span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">${pendingForMe.length}</span></button><div class="h-px bg-slate-100 my-1"></div>`;
    }
    
    if (currentUserKey === 'admin') {
        html += `<button onclick="triggerImport(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> Importar CSV</button>`;
        html += `<button onclick="promptEmptyData(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Vaciar Datos</button><div class="h-px bg-slate-100 my-1"></div>`;
    }

    if (!isGuestMode) {
        html += `<button onclick="openChangePasswordModal(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4v-3.252a1 1 0 01.293-.707l8.96-8.96A6 6 0 0115 7z"></path></svg> Cambiar contraseña</button>`;
    }
    
    html += `<button onclick="logout(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">Cerrar sesión</button>`;

    const ud = getEl('user-dropdown');
    if (ud) ud.innerHTML = html;
}

function updateNotificationsMenu() {
    const myCode = USER_CENTER_KEYS[currentUserKey];
    const pendingForMe = swapRequests.filter(s => s.targetCenter === myCode);
    const notifBubble = getEl('notif-bubble');
    const notifCount = getEl('notif-count');
    
    if (pendingForMe.length > 0 && !isGuestMode && currentUserKey !== 'admin') {
        if (notifBubble) showEl('notif-bubble');
        if (notifCount) notifCount.innerText = pendingForMe.length;
    } else { 
        if (notifBubble) hideEl('notif-bubble'); 
    }
    buildUserMenu();
}

function toggleUserMenu() { 
    toggleVis('user-dropdown'); 
}

function openChangePasswordModal() {
    getEl('new-password-input').value = '';
    showEl('change-password-modal');
}

function closeChangePasswordModal() {
    hideEl('change-password-modal');
}

function toggleNewPassword() {
    const pwdInput = getEl('new-password-input');
    const eyeIcon = getEl('new-eye-icon');
    if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />`;
    } else {
        pwdInput.type = 'password';
        eyeIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />`;
    }
}

let pendingDonationFixRequest = null;
let pendingDonationFixMaxPax = 0;

function showDonationFixModal(requestId, maxPax) {
    pendingDonationFixRequest = requestId;
    pendingDonationFixMaxPax = maxPax;
    getEl('donation-fix-max-pax').innerText = maxPax;
    showEl('donation-fix-modal');
}

async function executeDonationFix(choice) {
    hideEl('donation-fix-modal');
    if (!pendingDonationFixRequest) return;
    
    // We modify the swapRequests object directly, then call acceptDonation natively
    const req = swapRequests.find(s => s.id === pendingDonationFixRequest);
    if (!req) return;
    
    if (choice === 'full') {
        req.isFull = true;
    } else if (choice === 'reduce') {
        req.requestedPax = pendingDonationFixMaxPax;
        req.isFull = false;
        req.wasForcedReduced = true; 
    }
    
    await acceptDonation(pendingDonationFixRequest);
    
    pendingDonationFixRequest = null;
    pendingDonationFixMaxPax = 0;
}