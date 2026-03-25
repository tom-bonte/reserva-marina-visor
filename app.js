/**
 * @file app.js
 * @description The Core App Controller. This file acts as the primary traffic cop 
 * for the application, connecting the UI (Views), the Database (Model), and external 
 * services (Make.com webhook). It handles user authentication, Drag and Drop events,
 * and high-level interaction logic (swaps, moves, double-clicks).
 */

/* =========================================================================
   1. EXTERNAL SERVICES
   ========================================================================= */

async function sendSilentWebhook(msg) {
    if (!WHATSAPP_WEBHOOK_URL || !msg || msg.trim() === "") return;
    try {
        await fetch(WHATSAPP_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, 
            body: JSON.stringify({ message: msg })
        });
    } catch(e) { 
        console.error("Webhook Error:", e); 
    }
}

/* =========================================================================
   2. AUTHENTICATION & UI MENU
   ========================================================================= */

function verifyLogin() {
    const userKey = getEl('login-user').value;
    const password = getEl('login-password').value;
    
    auth.signInWithEmailAndPassword(EMAIL_MAP[userKey], password)
        .then(() => {
            hideEl('password-modal'); 
            hideEl('password-error'); 
            getEl('login-password').value = ''; 
        })
        .catch(() => showEl('password-error'));
}

function logout() { 
    auth.signOut(); 
}

document.addEventListener('click', function(e) {
    // Optimization: Skip checks if interacting with a high-priority modal
    if (e.target.closest('#password-modal')) return;

    const checks = [
        { wrap: 'user-menu-wrapper', panel: 'user-dropdown' },
        { wrap: 'center-filter-dropdown-wrapper', panel: 'filter-dropdown-panel' },
        { wrap: 'history-month-filter-wrapper', panel: 'month-dropdown-panel' }
    ];
    
    checks.forEach(c => {
        const w = getEl(c.wrap), p = getEl(c.panel);
        // If the wrapper exists, the click was outside the wrapper, and the panel exists
        if (w && !w.contains(e.target) && p) hideEl(c.panel);
    });
});

auth.onAuthStateChanged((user) => {
    isGuestMode = !user;
    currentUserKey = user ? (Object.keys(EMAIL_MAP).find(k => EMAIL_MAP[k] === user.email) || 'admin') : 'guest';
    hideEl('password-modal');
    
    const btnLogin = getEl('btn-login-header');
    if (btnLogin) btnLogin.classList.toggle('hidden', !isGuestMode);
    
    const userMenuWrapper = getEl('user-menu-wrapper');
    if (userMenuWrapper) userMenuWrapper.classList.toggle('hidden', isGuestMode);
    
    startFirestoreListener();
    
    const badgeInfo = BADGE_INFO[currentUserKey] || { name: 'Invitado', color: 'bg-slate-200', text: 'text-slate-600' };
    const centerInitial = currentUserKey === 'admin' ? 'A' : (currentUserKey === 'mangamar' ? 'M' : (currentUserKey === 'guest' ? 'INV' : currentUserKey.charAt(0).toUpperCase()));
    const btn = getEl('user-badge-button');
    
    if (btn) {
        btn.className = `rounded-[4px] px-3 py-2 text-[10px] font-bold shadow-sm flex items-center gap-2 hover:opacity-90 transition-all ${badgeInfo.color} ${badgeInfo.text}`;
        btn.innerHTML = `<span class="${isGuestMode ? 'bg-black/10' : 'bg-black/20'} px-1.5 rounded-sm">${centerInitial}</span><span class="tracking-wide">${badgeInfo.name}</span><svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
    }
    
    updateNotificationsMenu();
});

/* =========================================================================
   4. HISTORY LOGGER & PAGINATION
   ========================================================================= */

function getCenterInfoSafe(keyOrCode) {
    if (!keyOrCode) return { name: 'Otro centro', color: 'bg-slate-200', text: 'text-slate-800' };
    if (CENTERS[keyOrCode]) return CENTERS[keyOrCode];
    const code = USER_CENTER_KEYS[keyOrCode];
    return (code && CENTERS[code]) ? CENTERS[code] : { name: keyOrCode, color: 'bg-slate-200', text: 'text-slate-800' };
}

function changeHistoryPage(dir) {
    historyCurrentPage += dir;
    renderHistory();
}

function changeHistoryItemsPerPage(val) {
    historyItemsPerPage = parseInt(val, 10);
    historyCurrentPage = 1;
    renderHistory();
}

/* =========================================================================
   5. DATA OPS (IMPORT/EMPTY)
   ========================================================================= */

function triggerImport() { 
    getEl('csv-upload').click(); 
}

async function handleImport(e) {
    const f = e.target.files[0]; 
    if(!f) return;
    
    const btn = getEl('user-badge-button'); 
    const originalBtnHtml = btn.innerHTML;
    btn.innerHTML = `<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="tracking-wide">Cargando CSV...</span>`;
    
    try {
        const text = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target.result);
            reader.onerror = err => reject(err);
            reader.readAsText(f);
        });

        const rs = text.split('\n');
        const loaded = [];
        const safeCenterMap = {}; 
        Object.keys(CENTERS).forEach(k => safeCenterMap[CENTERS[k].name.toUpperCase()] = k);
        const slotTracker = {}; 

        for(let i=1; i<rs.length; i++) {
            if(!rs[i].trim()) continue;
            let c = rs[i].split(','); 
            if (c.length < 5) c = rs[i].split(';'); 
            if (c.length < 5) c = rs[i].split('\t'); 
            if (c.length < 5) continue;
            
            const clean = (str) => str ? str.replace(/['"\r\n]+/g, '').trim() : '';
            const rawDate = clean(c[0]), centerName = clean(c[1]).toUpperCase(), rawSite = clean(c[2]), rawTime = clean(c[3]), pax = parseInt(clean(c[4]), 10);
            
            let site = rawSite;
            const siteUpper = rawSite.toUpperCase();
            if (siteUpper.includes('BAJO')) site = 'Bajo de Dentro';
            else if (siteUpper.includes('TESTA')) site = 'Testa';
            else if (siteUpper.includes('MORRA')) site = 'Morra';
            else if (siteUpper.includes('PILES')) {
                if (siteUpper.includes('II') || siteUpper.includes('2')) site = 'Piles II';
                else if (siteUpper.includes('I') || siteUpper.includes('1')) site = 'Piles I';
            }

            const normalizedDate = normalizeCSVDate(rawDate);
            const normalizedTime = normalizeCSVTime(rawTime);
            const cKey = safeCenterMap[centerName];

            if(cKey && !isNaN(pax)) {
                const trackKey = `${normalizedDate}-${normalizedTime}-${site}`;
                if (!slotTracker[trackKey]) slotTracker[trackKey] = 1; else slotTracker[trackKey]++;
                loaded.push({ date: normalizedDate, center: cKey, site: site, time: normalizedTime, pax: pax, subslot: slotTracker[trackKey] });
            }
        }
        
        if(loaded.length) { 
            const monthlyData = {};
            loaded.forEach((item) => {
                const monthKey = item.date.substring(0, 7);
                if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
                monthlyData[monthKey][generateId(item.date, item.time, item.site, item.center, item.subslot)] = item;
            });
            
            const batch = db.batch();
            for (const [month, dataMap] of Object.entries(monthlyData)) {
                batch.set(db.collection("reservations_monthly").doc(month), { allocations: dataMap }, { merge: true });
            }
            await batch.commit();
            
            showNotification('Importación Exitosa', `Se ha procesado y guardado la planificación completa (${loaded.length} reservas).`); 
            if(loaded[0] && loaded[0].date) setDate(loaded[0].date);
        } else {
            showNotification('Error de Formato', 'No se encontraron datos válidos. Comprueba el archivo.', true); 
        }
    } catch(err) {
        console.error("Import error:", err);
        showNotification('Error', 'Hubo un problema al procesar el archivo o guardar en la nube.', true);
    } finally {
        btn.innerHTML = originalBtnHtml;
        e.target.value = ''; 
    }
}

function promptEmptyData() {
    try { backupAllToCSV(); } catch(e) { console.error(e); }
    setTimeout(() => showEl('empty-confirm-modal'), 800);
}

async function executeEmptyData() {
    const btnConfirm = getEl('btn-confirm-empty');
    const btnCancel = getEl('btn-cancel-empty');
    
    if(btnConfirm) { btnConfirm.textContent = "Borrando..."; btnConfirm.disabled = true; }
    if(btnCancel) btnCancel.disabled = true;

    try {
        const snapshot = await db.collection("reservations_monthly").get();
        if (!snapshot.empty) await Promise.all(snapshot.docs.map(doc => doc.ref.delete()));
        
        const swapSnapshot = await db.collection("swaps").get();
        if (!swapSnapshot.empty) await Promise.all(swapSnapshot.docs.map(doc => doc.ref.delete()));
        
        const historySnapshot = await db.collection("history_logs").get();
        if (!historySnapshot.empty) await Promise.all(historySnapshot.docs.map(doc => doc.ref.delete()));

        hideEl('empty-confirm-modal');
        showNotification('Base de Datos Vaciada', `Se han eliminado permanentemente todos los archivos de la nube.`);
    } catch (error) {
        hideEl('empty-confirm-modal'); 
        showNotification('Error', 'Hubo un problema al vaciar los datos.', true);
    } finally {
        if(btnConfirm) { btnConfirm.textContent = "Sí, vaciar"; btnConfirm.disabled = false; }
        if(btnCancel) btnCancel.disabled = false;
    }
}

/* =========================================================================
   6. DRAG & DROP + SWAPS + DOUBLE CLICK (THE BRAIN)
   ========================================================================= */

let draggedItemId = null;
let pendingDrop = null;
let pendingNewSalidaWA = null;
let pendingSwapIntent = null;
let isProcessingDrop = false; 
let pendingSwapInit = null;
let pendingSwapTargets = [];
let pendingSwapIsAdmin = false;
let pendingSwapHueco = null; // Buffer to hold hueco parameters during choice modal
let pendingNewSalida = null;
let pendingPartialSwap = null;
let pendingPartialMove = null;

let pendingEditSalida = null;
let pendingEditSalidaWA = null;
let pendingDeleteSalidaWA = null;
let pendingDonationRequest = null;
let pendingDonationWA = null;

function cancelWhatsAppDrop() {
    hideEl('whatsapp-confirm-modal'); 
    hideEl('swap-choice-modal'); 
    hideEl('partial-action-modal');
    
    pendingDrop = null; 
    pendingSwapIntent = null; 
    pendingNewSalidaWA = null; 
    isProcessingDrop = false; 
    pendingSwapInit = null; 
    pendingSwapTargets = []; 
    pendingSwapIsAdmin = false; 
    pendingSwapHueco = null;
    pendingNewSalida = null; 
    pendingPartialSwap = null; 
    pendingPartialMove = null;
    pendingEditSalidaWA = null;
    pendingDeleteSalidaWA = null;
    pendingDonationWA = null;

    renderAll(); 
}

async function confirmWhatsAppAction() {
    hideEl('whatsapp-confirm-modal'); 
    getEl('btn-confirm-wa').disabled = true; 
    
    if (pendingDrop) {
        const drop = pendingDrop; 
        pendingDrop = null; 
        await sendSilentWebhook(drop.msg); 
        await executeDrop(drop.id, drop.item, drop.newTime, drop.newSite, drop.newSubslot);
        logHistory('move', { date: drop.item.date, oldTime: drop.item.time, oldSite: drop.item.site, newTime: drop.newTime, newSite: drop.newSite, pax: drop.item.pax });
    }
    else if (pendingSwapIntent) {
        const swap = pendingSwapIntent; 
        pendingSwapIntent = null; 
        await sendSilentWebhook(swap.msg);
        try {
            await db.collection("swaps").add({ 
                initiatorId: swap.initId, 
                targetId: swap.targetId, 
                initiatorCenter: swap.initItem.center, 
                targetCenter: swap.targetItem.center, 
                initiatorData: swap.initItem, 
                targetData: swap.targetItem, 
                status: 'pending', 
                timestamp: firebase.firestore.FieldValue.serverTimestamp() 
            });
            showNotification('Solicitud Enviada', 'La propuesta de intercambio ha sido enviada al otro centro.');
        } catch(e) { 
            showNotification('Error', 'Hubo un fallo al solicitar el intercambio.', true); 
        }
    }
    else if (pendingNewSalidaWA) {
        const newSalida = pendingNewSalidaWA; 
        pendingNewSalidaWA = null; 
        await sendSilentWebhook(newSalida.msg); 
        await executeNewSalida(newSalida.data, newSalida.pax, newSalida.centerKey);
        logHistory('add', { date: newSalida.data.date, time: newSalida.data.time, site: newSalida.data.site, pax: newSalida.pax });
    }
    else if (pendingEditSalidaWA) {
        const edit = pendingEditSalidaWA; 
        pendingEditSalidaWA = null;
        await sendSilentWebhook(edit.msg);
        await executeEditSalida(edit.id, edit.item, edit.newPax);
        logHistory('edit', { date: edit.item.date, time: edit.item.time, site: edit.item.site, oldPax: edit.item.pax, newPax: edit.newPax });
    }
    else if (pendingDeleteSalidaWA) {
        const del = pendingDeleteSalidaWA; 
        pendingDeleteSalidaWA = null;
        await sendSilentWebhook(del.msg);
        await executeDeleteSalida(del.id, del.item);
        logHistory('delete', { date: del.item.date, time: del.item.time, site: del.item.site, pax: del.item.pax });
    }

    else if (pendingDonationWA) {
        const req = pendingDonationWA; 
        pendingDonationWA = null;
        await sendSilentWebhook(req.msg);
        try {
            await db.collection("swaps").add({
                type: 'donation', targetId: req.targetId, targetCenter: req.targetItem.center, targetData: req.targetItem,
                initiatorCenter: USER_CENTER_KEYS[currentUserKey], requestedPax: req.requestedPax, isFull: req.isFull, status: 'pending',
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showNotification('Solicitud Enviada', 'La petición ha sido enviada al centro.');
        } catch(e) { showNotification('Error', 'Hubo un fallo al solicitar la donación.', true); }
    }
    
    getEl('btn-confirm-wa').disabled = false; 
    isProcessingDrop = false;
}

function triggerSwapConfirmation(initId, initItem, targetId, targetItem) {
    const targetInfo = getCenterInfoSafe(targetItem.center);
    const initInfo = getCenterInfoSafe(initItem.center);
    const d = parseDateT00(initItem.date);
    
    let initNote = `*${initItem.site} (${initItem.time})*`;
    if (initItem.originalPax && initItem.originalPax > initItem.pax) {
        initNote += ` (reducido a ${initItem.pax} pax)`;
    } else {
        initNote += ` (${initItem.pax} pax)`;
    }

    let targetNote = `*${targetItem.site} (${targetItem.time})*`;
    if (targetItem.originalPax && targetItem.originalPax > targetItem.pax) {
        targetNote += ` (se reducirá a ${targetItem.pax} pax)`;
    } else {
        targetNote += ` (${targetItem.pax} pax)`;
    }

    const msg = `🤖 *AVISO AUTOMÁTICO*\n🔀 *SOLICITUD DE INTERCAMBIO* - ${initInfo.name} a ${targetInfo.name}\nPara el ${d.getDate()} de ${MONTHS_ES[d.getMonth()].toUpperCase()}, ofrece ${initNote} por ${targetNote}. Entrad al visor para confirmar.`;
    
    pendingSwapIntent = { initId, initItem, targetId, targetItem, msg };
    getEl('wa-action-type').textContent = "Solicitud de Intercambio";
    getEl('confirm-whatsapp-msg').innerText = msg;
    showEl('whatsapp-confirm-modal');
}

/**
 * Modified to support both swapping with an existing boat AND taking an empty space (hueco).
 */
function showSwapChoiceModal(initId, initItem, targets, isAdmin, allowHueco = false, newTime = null, newSite = null, huecoCapacity = 0) {
    pendingSwapInit = { initId, initItem }; 
    pendingSwapTargets = targets; 
    pendingSwapIsAdmin = isAdmin;
    pendingSwapHueco = { allowHueco, newTime, newSite, huecoCapacity };
    
    const container = getEl('swap-choice-buttons'); 
    container.innerHTML = '';
    
    getEl('swap-choice-title').innerText = allowHueco ? "Elige una Acción" : "Elegir Intercambio";
    getEl('swap-choice-subtitle').innerText = allowHueco ? "Hay un barco en este horario, pero queda un hueco libre." : "Hay dos barcos en este horario. ¿Con cuál quieres proponer el intercambio?";

    if (allowHueco) {
        const btnHueco = document.createElement('button');
        btnHueco.className = `w-full px-4 py-4 mb-2 rounded-xl text-sm font-bold shadow-sm border-2 border-emerald-500 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all flex items-center justify-between`;
        btnHueco.innerHTML = `<span><span class="text-lg mr-2">✅</span> Ocupar Hueco Libre</span> <span class="bg-emerald-200 px-2 py-1 rounded-md text-xs">${huecoCapacity} Plazas max</span>`;
        btnHueco.onclick = () => selectTakeHueco();
        container.appendChild(btnHueco);
    }
    
    targets.forEach(target => {
        const cInfo = CENTERS[target.center];
        const btn = document.createElement('button');
        btn.className = `w-full px-4 py-4 rounded-xl text-sm font-bold shadow-sm border border-slate-200 hover:shadow-md transition-all flex items-center justify-between ${cInfo.color} ${cInfo.text} mt-2`;
        btn.innerHTML = `<span><span class="text-lg mr-2">🔀</span> Intercambiar con ${cInfo.name}</span> <span class="bg-black/20 px-2 py-1 rounded-md">${target.pax} Plazas</span>`;
        btn.onclick = () => selectSwapTarget(target.id);
        container.appendChild(btn);
    });

    showEl('swap-choice-modal');
}

/**
 * Fires if the user chooses the Hueco option when dropping onto a slot with 1 boat.
 */
function selectTakeHueco() {
    hideEl('swap-choice-modal');
    const { initId, initItem } = pendingSwapInit;
    const { newTime, newSite, huecoCapacity } = pendingSwapHueco;
    
    pendingSwapInit = null; pendingSwapTargets = []; pendingSwapHueco = null;

    if (initItem.pax > huecoCapacity) {
        promptPartialMove(initId, initItem, newTime, newSite, huecoCapacity);
    } else {
        executeProceedWithMove(initId, initItem, newTime, newSite);
    }
}

function cancelPartialAction() {
    hideEl('partial-action-modal');
    pendingPartialSwap = null;
    pendingPartialMove = null;
    isProcessingDrop = false;
    renderAll();
}

function promptPartialMove(id, item, newTime, newSite, maxPax) {
    const dObj = parseDateT00(item.date);
    const dStr = `${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()]}`;
    pendingPartialMove = { id, item, newTime, newSite, newPax: maxPax };
    const msg = `Para el **${dStr}**, el punto de destino solo tiene ${maxPax} plazas libres.\n\nTu barco de ${item.pax} plazas se reducirá forzosamente a ${maxPax} plazas si realizas el movimiento.\n\n¿Aceptas continuar con este ajuste automático?`;
    
    getEl('partial-action-msg').innerText = msg;
    showEl('partial-action-modal');
}

function confirmPartialAction() {
    hideEl('partial-action-modal');
    
    if (pendingPartialSwap) {
        const { initId, initItem, targetId, targetItem, safeInitPax, safeTargetPax, isAdmin } = pendingPartialSwap;
        pendingPartialSwap = null;

        const adjustedInitItem = { ...initItem, pax: safeInitPax, originalPax: initItem.originalPax || initItem.pax };
        const adjustedTargetItem = { ...targetItem, pax: safeTargetPax, originalPax: targetItem.originalPax || targetItem.pax };

        if (isAdmin) { 
            acceptAdminInstantSwap(initId, adjustedInitItem, targetId, adjustedTargetItem);
        } else { 
            triggerSwapConfirmation(initId, adjustedInitItem, targetId, adjustedTargetItem); 
        }
    } else if (pendingPartialMove) {
        const { id, item, newTime, newSite, newPax } = pendingPartialMove;
        pendingPartialMove = null;
        
        const adjustedItem = { ...item, pax: newPax };
        executeProceedWithMove(id, adjustedItem, newTime, newSite);
    }
}

async function acceptAdminInstantSwap(initId, initItem, targetId, targetItem) {
    try { 
        await performSwap(initId, initItem, targetId, targetItem); 
    } catch(e) { 
        showNotification('Error', 'Hubo un fallo al realizar el intercambio.', true); 
    }
    isProcessingDrop = false;
}

async function selectSwapTarget(targetId) {
    hideEl('swap-choice-modal');
    const targetItem = pendingSwapTargets.find(t => t.id === targetId);
    const { initId, initItem } = pendingSwapInit;
    const isAdmin = pendingSwapIsAdmin;
    
    pendingSwapInit = null; 
    pendingSwapTargets = []; 
    pendingSwapIsAdmin = false;
    pendingSwapHueco = null;
    
    const itemsInTargetSiteToday = allocations.filter(a => a.date === initItem.date && a.site === targetItem.site);
    const currentPaxTargetSite = itemsInTargetSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const targetSiteCap = getDailyCapacity(initItem.date, targetItem.site);
    const maxAllowedInTarget = targetSiteCap - currentPaxTargetSite + targetItem.pax;

    const itemsInInitSiteToday = allocations.filter(a => a.date === initItem.date && a.site === initItem.site);
    const currentPaxInitSite = itemsInInitSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const initSiteCap = getDailyCapacity(initItem.date, initItem.site);
    const maxAllowedInInit = initSiteCap - currentPaxInitSite + initItem.pax;

    let safeInitPax = Math.min(initItem.pax, maxAllowedInTarget);
    let safeTargetPax = Math.min(targetItem.pax, maxAllowedInInit);

    if (safeInitPax <= 0 || safeTargetPax <= 0) {
        showNotification('Error de Cupo', 'No hay plazas suficientes para realizar este intercambio. El punto está totalmente lleno.', true);
        isProcessingDrop = false;
        return;
    }

    if (initItem.pax > maxAllowedInTarget) {
        const dObj = parseDateT00(initItem.date);
        const dStr = `${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()]}`;
        
        pendingPartialSwap = { initId, initItem, targetId, targetItem, safeInitPax, safeTargetPax: targetItem.pax, isAdmin };
        let msg = `Para el **${dStr}**, el punto de destino está casi lleno.\n\nTu barco de ${initItem.pax} plazas se reducirá forzosamente a ${safeInitPax} plazas si realizas el intercambio.\n\n¿Aceptas continuar con este ajuste automático?`;
        
        getEl('partial-action-msg').innerText = msg;
        showEl('partial-action-modal');
        return;
    }

    const adjustedInitItem = { ...initItem, pax: safeInitPax, originalPax: initItem.pax };
    const adjustedTargetItem = { ...targetItem, pax: targetItem.pax, originalPax: targetItem.pax };

    if (isAdmin) { 
        acceptAdminInstantSwap(initId, adjustedInitItem, targetId, adjustedTargetItem);
    } else { 
        triggerSwapConfirmation(initId, adjustedInitItem, targetId, adjustedTargetItem); 
    }
}

function executeProceedWithMove(id, item, newTime, newSite) {
    if (currentUserKey !== 'admin') {
        const d = parseDateT00(item.date);
        const centerInfo = getCenterInfoSafe(item.center);
        let msg = `🤖 *AVISO AUTOMÁTICO*\n➡️ *CAMBIO DE HORARIO* - ${centerInfo.name}\nPara el ${d.getDate()} de ${MONTHS_ES[d.getMonth()].toUpperCase()}, movió su salida de *${item.site} (${item.time})* a *${newSite} (${newTime})* (${item.pax} pax).`;
        
        const originalItem = allocations.find(a => String(a.id) === String(id));
        if (originalItem && item.pax < originalItem.pax) {
            msg += `\n⚠️ (Reducido a ${item.pax} plazas por límite de cupo).`;
        }
        
        pendingDrop = { id, item, newTime, newSite, msg };
        getEl('wa-action-type').textContent = "Cambio de Horario/Punto"; 
        getEl('confirm-whatsapp-msg').innerText = msg; 
        showEl('whatsapp-confirm-modal');
    } else { 
        executeDrop(id, item, newTime, newSite); 
        isProcessingDrop = false; 
    }
}

/* -------------------------------------------------------------------------
   NATIVE DRAG & DROP BROWSER API LISTENERS
   ------------------------------------------------------------------------- */

document.addEventListener('dragstart', (e) => {
    if (isGuestMode || isProcessingDrop) { e.preventDefault(); return; } 
    const block = e.target.closest('.draggable-item');
    if (!block || block.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
    
    draggedItemId = block.dataset.dragId;
    try { 
        e.dataTransfer.setData('text/plain', String(draggedItemId)); 
        e.dataTransfer.effectAllowed = 'move'; 
    } catch (err) { }
    
    setTimeout(() => block.classList.add('opacity-50'), 0);
});

document.addEventListener('dragend', (e) => {
    const block = e.target.closest('.draggable-item'); 
    if (!block) return;
    draggedItemId = null; 
    block.classList.remove('opacity-50');
    document.querySelectorAll('.dropzone').forEach(el => el.classList.remove('bg-blue-50', 'bg-purple-50'));
});

document.addEventListener('dragover', (e) => {
    if (isGuestMode || !draggedItemId || isProcessingDrop) return;
    e.preventDefault(); 
    
    if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    
    document.querySelectorAll('.bg-blue-50, .bg-purple-50').forEach(el => { 
        if (el !== e.target.closest('.dropzone')) el.classList.remove('bg-blue-50', 'bg-purple-50'); 
    });

    const dropzone = e.target.closest('.dropzone'); 
    if (!dropzone) return;
    
    const newTime = dropzone.dataset.time;
    const newSite = dropzone.dataset.site;
    const ds = getStrYMD(currentDate);

    const initItem = allocations.find(a => String(a.id) === String(draggedItemId));
    if (initItem && initItem.time === newTime && initItem.site === newSite && initItem.date === ds) {
        return; 
    }

    const existing = allocations.filter(a => a.date === ds && a.time === newTime && a.site === newSite && String(a.id) !== String(draggedItemId));
    if (existing.length >= 2) {
        dropzone.classList.add('bg-purple-50'); 
    } else {
        dropzone.classList.add('bg-blue-50');   
    }
});

document.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('.dropzone');
    if (dropzone && !dropzone.contains(e.relatedTarget)) dropzone.classList.remove('bg-blue-50', 'bg-purple-50');
});

// PRIMARY DROP ROUTER
document.addEventListener('drop', async (e) => {
    if (isGuestMode || isProcessingDrop) return;
    e.preventDefault(); 
    
    document.querySelectorAll('.dropzone').forEach(el => el.classList.remove('bg-blue-50', 'bg-purple-50'));
    let id = draggedItemId; 
    if (!id) return;

    const dropzone = e.target.closest('.dropzone'); 
    if (!dropzone) return;
    
    const newTime = dropzone.dataset.time, newSite = dropzone.dataset.site;
    const initItem = allocations.find(a => String(a.id) === String(id)); 
    if (!initItem) return;
    
    if (initItem.time === newTime && initItem.site === newSite) return;
    
    if (currentUserKey !== 'admin' && initItem.center !== USER_CENTER_KEYS[currentUserKey]) { 
        showNotification('Acción Bloqueada', 'Solo puedes mover tus propias reservas.', true); 
        return; 
    }

    isProcessingDrop = true; 
    const existingItemsInSlot = allocations.filter(a => a.date === initItem.date && a.time === newTime && a.site === newSite && String(a.id) !== String(id));

    // Evaluate absolute remaining capacity for taking a Hueco
    const itemsInNewSiteToday = allocations.filter(a => a.date === initItem.date && a.site === newSite && String(a.id) !== String(id));
    const currentPaxNewSite = itemsInNewSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const remainingCapacity = getDailyCapacity(initItem.date, newSite) - currentPaxNewSite;

    const canTakeHueco = existingItemsInSlot.length < 2 && remainingCapacity > 0;
    const requiresShrinkForHueco = initItem.pax > remainingCapacity;

    if (existingItemsInSlot.length === 0) {
        // Scenario 1: Target slot is totally empty. Normal Move.
        if (!canTakeHueco) {
            showNotification('Cupo Lleno', 'No puedes mover la salida aquí. El punto está lleno.', true);
            isProcessingDrop = false; return;
        }
        if (requiresShrinkForHueco) {
            promptPartialMove(id, initItem, newTime, newSite, remainingCapacity);
        } else {
            executeProceedWithMove(id, initItem, newTime, newSite);
        }
    } 
    else if (existingItemsInSlot.length === 1) {
        // Scenario 2: Target slot has 1 boat. Might be a Swap OR a Hueco take.
        const targets = existingItemsInSlot.filter(t => t.center !== initItem.center || currentUserKey === 'admin');
        
        if (targets.length === 0) {
            // The existing boat is ours. Cannot swap. Only Hueco.
            if (!canTakeHueco) {
                showNotification('Cupo Lleno', 'El punto está lleno o no tienes con quién intercambiar.', true);
                isProcessingDrop = false; return;
            }
            if (requiresShrinkForHueco) {
                promptPartialMove(id, initItem, newTime, newSite, remainingCapacity);
            } else {
                executeProceedWithMove(id, initItem, newTime, newSite);
            }
        } else {
            // Target available. Ask user: Swap or Take Hueco?
            showSwapChoiceModal(id, initItem, targets, currentUserKey === 'admin', canTakeHueco, newTime, newSite, remainingCapacity);
        }
    } 
    else {
        // Scenario 3: Target slot has 2 boats. Forced Swap.
        const targets = existingItemsInSlot.filter(t => t.center !== initItem.center || currentUserKey === 'admin');
        if (targets.length === 0) {
            showNotification('Acción Bloqueada', 'Ambos barcos son tuyos.', true);
            isProcessingDrop = false; return;
        }
        showSwapChoiceModal(id, initItem, targets, currentUserKey === 'admin', false);
    }
});

/* -------------------------------------------------------------------------
   DOUBLE CLICK LISTENERS (Add / Edit / Delete)
   ------------------------------------------------------------------------- */

function handleSlotDoubleClick(time, site) {
    if (isGuestMode || isProcessingDrop) return;

    const ds = getStrYMD(currentDate);
    const existingItemsInSlot = allocations.filter(a => a.date === ds && a.time === time && a.site === site);
    
    if (existingItemsInSlot.length >= 2) { 
        showNotification('Horario Completo', 'Ya hay 2 barcos asignados en este horario.', true); 
        return; 
    }

    const itemsInSiteToday = allocations.filter(a => a.date === ds && a.site === site);
    const currentPax = itemsInSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const remainingCapacity = getDailyCapacity(ds, site) - currentPax;

    if (remainingCapacity <= 0) { 
        showNotification('Cupo Lleno', 'No quedan plazas disponibles para este punto de buceo hoy.', true); 
        return; 
    }
    
    const allowedMax = Math.min(11, remainingCapacity);

    pendingNewSalida = { date: ds, time, site, maxPax: remainingCapacity };
    
    getEl('new-salida-title').textContent = `${site} a las ${time}`;
    getEl('new-salida-avail').textContent = `Plazas disponibles en el punto: ${remainingCapacity} (Máx por barco: ${allowedMax})`;
    
    const paxInput = getEl('new-salida-pax'); 
    paxInput.value = ''; 
    paxInput.max = allowedMax;
    
    const centerSelector = getEl('new-salida-center-container');
    if (centerSelector) centerSelector.classList.toggle('hidden', currentUserKey !== 'admin');
    
    showEl('new-salida-modal');
}

function cancelNewSalida() { 
    hideEl('new-salida-modal'); 
    pendingNewSalida = null; 
}

async function confirmNewSalida() {
    const pax = parseInt(getEl('new-salida-pax').value, 10);
    const allowedMax = Math.min(11, pendingNewSalida.maxPax);
    
    if (!pax || isNaN(pax) || pax <= 0) { 
        showNotification('Error', 'Introduce un número válido.', true); 
        return; 
    }
    if (pax > allowedMax) { 
        showNotification('Límite excedido', `El máximo permitido es ${allowedMax} plazas.`, true); 
        return; 
    }

    hideEl('new-salida-modal');
    
    const targetCenterKey = currentUserKey === 'admin' ? getEl('new-salida-center').value : currentUserKey;
    const { date, time, site } = pendingNewSalida;
    const dObj = parseDateT00(date);
    const centerInfo = getCenterInfoSafe(targetCenterKey);
    
    const msg = `🤖 *AVISO AUTOMÁTICO*\n➕ *NUEVA SALIDA* - ${centerInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, añadió una salida a *${site} (${time})* de ${pax} plazas.`;
    
    if (currentUserKey !== 'admin') {
        pendingNewSalidaWA = { data: pendingNewSalida, pax: pax, centerKey: targetCenterKey, msg: msg };
        getEl('wa-action-type').textContent = "Nueva Salida"; 
        getEl('confirm-whatsapp-msg').innerText = msg; 
        showEl('whatsapp-confirm-modal');
    } else {
        await executeNewSalida(pendingNewSalida, pax, targetCenterKey);
    }
}

/**
 * Handles explicit edits or deletes via a double-click event on an existing boat.
 */
function handleBoatDoubleClick(e, id) {
    e.stopPropagation(); // Prevents the dropzone double click from firing underneath
    if (isGuestMode || isProcessingDrop) return;
    
    const item = allocations.find(a => String(a.id) === String(id));
    if (!item) return;

    if (currentUserKey !== 'admin' && item.center !== USER_CENTER_KEYS[currentUserKey]) {
            promptDonationRequest(id, item);
            return;
    }

    const itemsInSiteToday = allocations.filter(a => a.date === item.date && a.site === item.site && String(a.id) !== String(id));
    const currentPaxOthers = itemsInSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const absoluteMax = getDailyCapacity(item.date, item.site);
    const remainingCapacity = absoluteMax - currentPaxOthers;
    const allowedMax = Math.min(11, remainingCapacity);

    pendingEditSalida = { id, item, maxPax: allowedMax };

    getEl('edit-salida-title').textContent = `${item.site} a las ${item.time}`;
    getEl('edit-salida-avail').textContent = `Plazas máximas permitidas para este barco: ${allowedMax}`;
    
    const paxInput = getEl('edit-salida-pax');
    paxInput.value = item.pax;
    paxInput.max = allowedMax;

    showEl('edit-salida-modal');
}

function cancelEditSalida() {
    hideEl('edit-salida-modal');
    pendingEditSalida = null;
}

async function confirmEditSalida() {
    const pax = parseInt(getEl('edit-salida-pax').value, 10);
    const allowedMax = pendingEditSalida.maxPax;

    if (!pax || isNaN(pax) || pax <= 0) { showNotification('Error', 'Introduce un número válido.', true); return; }
    if (pax > allowedMax) { showNotification('Límite excedido', `El máximo permitido es ${allowedMax} plazas.`, true); return; }

    hideEl('edit-salida-modal');
    
    if (pax === pendingEditSalida.item.pax) {
        pendingEditSalida = null; 
        return; // No change made
    }

    const centerInfo = getCenterInfoSafe(pendingEditSalida.item.center);
    const dObj = parseDateT00(pendingEditSalida.item.date);
    const actionWord = pax > pendingEditSalida.item.pax ? 'aumentó' : 'redujo';
    const msg = `🤖 *AVISO AUTOMÁTICO*\n✏️ *MODIFICACIÓN DE SALIDA* - ${centerInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, ${actionWord} su salida en *${pendingEditSalida.item.site} (${pendingEditSalida.item.time})* de ${pendingEditSalida.item.pax} a ${pax} plazas.`;

    if (currentUserKey !== 'admin') {
        pendingEditSalidaWA = { id: pendingEditSalida.id, item: pendingEditSalida.item, newPax: pax, msg };
        getEl('wa-action-type').textContent = "Modificar Salida";
        getEl('confirm-whatsapp-msg').innerText = msg;
        showEl('whatsapp-confirm-modal');
    } else {
        await executeEditSalida(pendingEditSalida.id, pendingEditSalida.item, pax);
        pendingEditSalida = null;
    }
}

function promptDeleteSalida() {
    hideEl('edit-salida-modal');
    showEl('delete-confirm-modal');
}

function cancelDeleteSalida() {
    hideEl('delete-confirm-modal');
    showEl('edit-salida-modal'); // Re-open the edit modal if they back out of deletion
}

async function confirmDeleteSalida() {
    hideEl('delete-confirm-modal');
    
    const centerInfo = getCenterInfoSafe(pendingEditSalida.item.center);
    const dObj = parseDateT00(pendingEditSalida.item.date);
    const msg = `🤖 *AVISO AUTOMÁTICO*\n🗑️ *SALIDA CANCELADA* - ${centerInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, ha eliminado su salida en *${pendingEditSalida.item.site} (${pendingEditSalida.item.time})* (${pendingEditSalida.item.pax} plazas).`;

    if (currentUserKey !== 'admin') {
        pendingDeleteSalidaWA = { id: pendingEditSalida.id, item: pendingEditSalida.item, msg };
        getEl('wa-action-type').textContent = "Eliminar Salida";
        getEl('confirm-whatsapp-msg').innerText = msg;
        showEl('whatsapp-confirm-modal');
    } else {
        await executeDeleteSalida(pendingEditSalida.id, pendingEditSalida.item);
        pendingEditSalida = null;
    }
}

function promptDonationRequest(id, item) {
    pendingDonationRequest = { id, item };
    const centerInfo = getCenterInfoSafe(item.center);
    getEl('donation-title').textContent = `Solicitar a ${centerInfo.name}`;
    getEl('donation-subtitle').textContent = `${item.site} a las ${item.time}`;
    getEl('donation-pax-info').textContent = `El barco tiene ${item.pax} plazas ocupadas.`;
    const paxInput = getEl('donation-pax');
    paxInput.value = ''; paxInput.max = item.pax - 1;
    showEl('donation-request-modal');
}

function cancelDonationRequest() {
    hideEl('donation-request-modal');
    pendingDonationRequest = null;
}

function confirmDonationRequest() {
    const isFull = getEl('donation-type-full').checked;
    const pax = parseInt(getEl('donation-pax').value, 10);
    
    if (!isFull && (!pax || isNaN(pax) || pax <= 0 || pax >= pendingDonationRequest.item.pax)) {
        showNotification('Error', `Introduce un número válido (menor a ${pendingDonationRequest.item.pax}). Si quieres todo el barco, marca "Barco completo".`, true);
        return;
    }
    hideEl('donation-request-modal');
    
    const requestedPax = isFull ? pendingDonationRequest.item.pax : pax;
    const targetInfo = getCenterInfoSafe(pendingDonationRequest.item.center);
    const myInfo = getCenterInfoSafe(currentUserKey);
    const dObj = parseDateT00(pendingDonationRequest.item.date);
    
    const msg = `🤖 *AVISO AUTOMÁTICO*\n🙏 *SOLICITUD DE DONACIÓN* - ${myInfo.name} a ${targetInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, solicita que le ceda ${isFull ? '*EL BARCO COMPLETO*' : `*${requestedPax} plazas*`} en *${pendingDonationRequest.item.site} (${pendingDonationRequest.item.time})*. Entrad al visor para confirmar.`;
    
    pendingDonationWA = {
        targetId: pendingDonationRequest.id, targetItem: pendingDonationRequest.item,
        requestedPax: requestedPax, isFull: isFull, msg: msg
    };
    getEl('wa-action-type').textContent = "Petición de Plazas";
    getEl('confirm-whatsapp-msg').innerText = msg;
    showEl('whatsapp-confirm-modal');
}

/* =========================================================================
   11. INITIALIZATION EXECUTION
   ========================================================================= */

// Boots the application UI structures upon primary DOM parsing
document.addEventListener('DOMContentLoaded', () => {
    initSelectors(); 
    initFilters(); 
    renderAll();
});