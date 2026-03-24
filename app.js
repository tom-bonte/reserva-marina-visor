/**
 * @file app.js
 * @description The Core App Controller. This file acts as the primary traffic cop 
 * for the application, connecting the UI (Views), the Database (Model), and external 
 * services (Make.com webhook). It handles user authentication, Drag and Drop events,
 * and high-level interaction logic (swaps, moves, double-clicks).
 */

/* =========================================================================
   1. CORE DATA, UTILITIES & INITIALIZATION ENGINE
   ========================================================================= */

/**
 * Dispatches an automated message to the Cabo de Palos WhatsApp group via a Make.com webhook.
 * Fails silently if the webhook URL is missing or the message is empty.
 * @async
 * @param {string} msg - The pre-formatted text message to send.
 * @returns {Promise<void>}
 */
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
   3. AUTHENTICATION & UI MENU
   ========================================================================= */

/**
 * Authenticates a dive center user against Firebase Auth.
 * Automatically handles UI toggles upon success or displays an error message.
 * @returns {void}
 */
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

/**
 * Signs the current user out of Firebase and returns to Guest Mode.
 * @returns {void}
 */
function logout() { 
    auth.signOut(); 
}

// Global click listener to handle clicking outside of custom dropdown menus to close them.
document.addEventListener('click', function(e) {
    const checks = [
        { wrap: 'user-menu-wrapper', panel: 'user-dropdown' },
        { wrap: 'center-filter-dropdown-wrapper', panel: 'filter-dropdown-panel' },
        { wrap: 'history-month-filter-wrapper', panel: 'month-dropdown-panel' }
    ];
    checks.forEach(c => {
        const w = getEl(c.wrap), p = getEl(c.panel);
        if (w && !w.contains(e.target) && p) hideEl(c.panel);
    });
});

// Primary Firebase Auth State Listener. Re-initializes data streams on login/logout.
auth.onAuthStateChanged((user) => {
    isGuestMode = !user;
    currentUserKey = user ? (Object.keys(EMAIL_MAP).find(k => EMAIL_MAP[k] === user.email) || 'admin') : 'guest';
    hideEl('password-modal');
    
    const btnLogin = getEl('btn-login-header');
    if (btnLogin) btnLogin.classList.toggle('hidden', !isGuestMode);
    
    const userMenuWrapper = getEl('user-menu-wrapper');
    if (userMenuWrapper) userMenuWrapper.classList.toggle('hidden', isGuestMode);
    
    // Reboot listeners to fetch proper access-level data
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
   9. WIZARD CONFIGURATION LOGIC (3-TIER DRY SYSTEM)
   ========================================================================= */

/**
 * Triggers the display of the Admin Config Wizard to adjust seasonal capacities.
 * @returns {void}
 */
function openConfigWizard() {
    renderWizardTables();
    showEl('config-wizard-modal');
}

/**
 * Scrapes the input values from the Config Wizard DOM elements and pushes
 * the newly assembled capacity matrices to Firestore.
 * @async
 * @returns {Promise<void>}
 */
async function saveConfigWizard() {
    const btn = getEl('btn-save-config');
    btn.innerHTML = 'Guardando...'; 
    btn.disabled = true;

    // Initialize an empty matrix conforming to the 3-tier system
    const newCaps = { peak: { weekend: {}, weekday: {} }, high: { weekend: {}, weekday: {} }, low: { weekend: {}, weekday: {} } };

    SEASONS.forEach(season => {
        SITES.forEach(s => {
            newCaps[season].weekend[s] = parseInt(getEl(`cap-${season}-we-${s}`).value) || 0;
            // Enforce Morra strict closure rule on weekdays regardless of input
            newCaps[season].weekday[s] = s === 'Morra' ? 0 : (parseInt(getEl(`cap-${season}-wd-${s}`).value) || 0);
        });
    });

    try {
        await db.collection("config").doc("capacities").set({
            peakSeasonMonths: sysConfig.peakSeasonMonths,
            highSeasonMonths: sysConfig.highSeasonMonths,
            capacities: newCaps
        }, { merge: true });
        
        hideEl('config-wizard-modal');
        showNotification('Configuración Guardada', 'Los cupos se han actualizado y aplicado correctamente.');
    } catch(e) {
        console.error(e);
        showNotification('Error', 'No se pudo guardar la configuración.', true);
    } finally {
        btn.innerHTML = 'Guardar Plazas'; 
        btn.disabled = false;
    }
}

/* =========================================================================
   5. HISTORY LOGGER & PAGINATION
   ========================================================================= */

/**
 * Utility function to retrieve center metadata safely, falling back to a default
 * style if the key or code is unrecognized.
 * @param {string} keyOrCode - The center's internal key or short code.
 * @returns {Object} Center configuration object containing name, color, and text style.
 */
function getCenterInfoSafe(keyOrCode) {
    if (!keyOrCode) return { name: 'Otro centro', color: 'bg-slate-200', text: 'text-slate-800' };
    if (CENTERS[keyOrCode]) return CENTERS[keyOrCode];
    const code = USER_CENTER_KEYS[keyOrCode];
    return (code && CENTERS[code]) ? CENTERS[code] : { name: keyOrCode, color: 'bg-slate-200', text: 'text-slate-800' };
}

/**
 * Adjusts the current pagination index for the History View and triggers a re-render.
 * @param {number} dir - Direction to move (-1 for previous, 1 for next).
 * @returns {void}
 */
function changeHistoryPage(dir) {
    historyCurrentPage += dir;
    renderHistory();
}

/**
 * Adjusts the amount of log items displayed per page in the History View.
 * @param {string} val - The new items per page count from the dropdown.
 * @returns {void}
 */
function changeHistoryItemsPerPage(val) {
    historyItemsPerPage = parseInt(val, 10);
    historyCurrentPage = 1;
    renderHistory();
}

/* =========================================================================
   6. NOTIFICATIONS & DATA OPS
   ========================================================================= */

/**
 * Simulates a click on the hidden file input to trigger a CSV import sequence.
 * @returns {void}
 */
function triggerImport() { 
    getEl('csv-upload').click(); 
}

/**
 * Parses an uploaded CSV file, normalizes the data, groups it by month, 
 * and pushes batch updates to Firestore.
 * @async
 * @param {Event} e - The DOM file upload change event.
 * @returns {Promise<void>}
 */
function handleImport(e) {
    const f = e.target.files[0]; 
    if(!f) return;
    
    const btn = getEl('user-badge-button'); 
    const originalBtnHtml = btn.innerHTML;
    // Inject loading spinner
    btn.innerHTML = `<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="tracking-wide">Cargando CSV...</span>`;
    
    const r = new FileReader();
    r.onload = async (ev) => {
        const rs = ev.target.result.split('\n'), loaded = [];
        const safeCenterMap = {}; 
        Object.keys(CENTERS).forEach(k => safeCenterMap[CENTERS[k].name.toUpperCase()] = k);
        const slotTracker = {}; 

        // Skip header row (i=1)
        for(let i=1; i<rs.length; i++) {
            if(!rs[i].trim()) continue;
            
            // Try standard delimiters
            let c = rs[i].split(','); 
            if (c.length < 5) c = rs[i].split(';'); 
            if (c.length < 5) c = rs[i].split('\t'); 
            if (c.length < 5) continue;
            
            const clean = (str) => str ? str.replace(/['"\r\n]+/g, '').trim() : '';
            const rawDate = clean(c[0]), centerName = clean(c[1]).toUpperCase(), rawSite = clean(c[2]), rawTime = clean(c[3]), pax = parseInt(clean(c[4]), 10);
            
            // Normalize site to match exactly the SITES array (fixes case and spelling variations)
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
                // Track how many boats exist in a specific slot to assign subslot (1 or 2)
                const trackKey = `${normalizedDate}-${normalizedTime}-${site}`;
                if (!slotTracker[trackKey]) slotTracker[trackKey] = 1; else slotTracker[trackKey]++;
                loaded.push({ date: normalizedDate, center: cKey, site: site, time: normalizedTime, pax: pax, subslot: slotTracker[trackKey] });
            }
        }
        
        if(loaded.length) { 
            try {
                // Group the flattened array into objects keyed by month (YYYY-MM)
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
            } catch(err) {
                showNotification('Error', 'Hubo un problema de red al guardar en la nube.', true);
            } finally { 
                btn.innerHTML = originalBtnHtml; 
            }
        } else {
            showNotification('Error de Formato', 'No se encontraron datos válidos. Comprueba el archivo.', true); 
            btn.innerHTML = originalBtnHtml;
        }
    };
    r.readAsText(f); 
    e.target.value = '';
}

/**
 * Triggers an immediate full CSV backup of all current allocations in memory,
 * then cues the warning modal to empty the database.
 * @returns {void}
 */
function promptEmptyData() {
    try { backupAllToCSV(); } catch(e) { console.error(e); }
    setTimeout(() => showEl('empty-confirm-modal'), 800);
}

/**
 * Permanently deletes all documents from reservations, swaps, and history collections.
 * Only executable by the Root Admin.
 * @async
 * @returns {Promise<void>}
 */
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
   8. DRAG & DROP + SWAPS + DOUBLE CLICK (THE BRAIN)
   ========================================================================= */

// Drag and Action state buffers
let draggedItemId = null;
let pendingDrop = null;
let pendingNewSalidaWA = null;
let pendingSwapIntent = null;
let isProcessingDrop = false; 
let pendingSwapInit = null;
let pendingSwapTargets = [];
let pendingSwapIsAdmin = false;
let pendingNewSalida = null;
let pendingPartialSwap = null;
let pendingPartialMove = null;

/**
 * Clears all pending action buffers and closes related confirmation modals.
 * @returns {void}
 */
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
    pendingNewSalida = null; 
    pendingPartialSwap = null; 
    pendingPartialMove = null;
    
    renderAll(); 
}

/**
 * Routes the confirmed user action to the appropriate execution function 
 * (Move, Swap Request, or New Addition) and triggers the webhook.
 * @async
 * @returns {Promise<void>}
 */
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
    getEl('btn-confirm-wa').disabled = false; 
    isProcessingDrop = false;
}

/**
 * Directly updates a reservation document in Firestore after a drag/drop move.
 * Automatically resolves subslot collisions (1 vs 2).
 * @async
 * @param {string} id - The unique ID of the reservation.
 * @param {Object} item - The current reservation object.
 * @param {string} newTime - The target time slot.
 * @param {string} newSite - The target dive site.
 * @returns {Promise<void>}
 */
async function executeDrop(id, item, newTime, newSite) {
    const monthKey = item.date.substring(0, 7); 
    try {
        const updates = {}; 
        let finalSubslot = 1;
        
        // Ensure the old slot is cleaned up correctly if a boat remains
        const remainingOld = allocations.filter(a => a.date === item.date && a.time === item.time && a.site === item.site && String(a.id) !== String(id));
        if (remainingOld.length === 1 && remainingOld[0].subslot !== 1) updates[`allocations.${remainingOld[0].id}.subslot`] = 1;

        // Assign correct subslot at the target
        const existingNew = allocations.filter(a => a.date === item.date && a.time === newTime && a.site === newSite && String(a.id) !== String(id));
        if (existingNew.length === 1) {
            finalSubslot = 2; 
            if (existingNew[0].subslot !== 1) updates[`allocations.${existingNew[0].id}.subslot`] = 1; 
        }

        updates[`allocations.${id}.time`] = newTime; 
        updates[`allocations.${id}.site`] = newSite; 
        updates[`allocations.${id}.subslot`] = finalSubslot;
        
        if (item.pax !== undefined) {
            updates[`allocations.${id}.pax`] = item.pax;
        }
        
        await db.collection("reservations_monthly").doc(monthKey).update(updates);
    } catch(error) { 
        showNotification('Error', 'No se pudo guardar en la nube.', true); 
    }
}

/**
 * Executes an atomic batch write to swap two reservation documents.
 * Handles both intra-month and cross-month swaps.
 * @async
 * @param {string} initId - Initiating reservation ID.
 * @param {Object} initItem - Initiating reservation data object.
 * @param {string} targetId - Target reservation ID.
 * @param {Object} targetItem - Target reservation data object.
 * @param {string|null} swapDocId - Optional ID of the swap request to delete upon success.
 * @returns {Promise<void>}
 */
async function performSwap(initId, initItem, targetId, targetItem, swapDocId = null) {
    const month1 = initItem.date.substring(0, 7), month2 = targetItem.date.substring(0, 7); 
    try {
        const batch = db.batch();
        if (month1 === month2) {
            batch.update(db.collection("reservations_monthly").doc(month1), {
                [`allocations.${initId}.time`]: targetItem.time, 
                [`allocations.${initId}.site`]: targetItem.site, 
                [`allocations.${initId}.subslot`]: targetItem.subslot || 1, 
                [`allocations.${initId}.pax`]: initItem.pax,
                [`allocations.${targetId}.time`]: initItem.time, 
                [`allocations.${targetId}.site`]: initItem.site, 
                [`allocations.${targetId}.subslot`]: initItem.subslot || 2, 
                [`allocations.${targetId}.pax`]: targetItem.pax
            });
        } else {
            // Highly unlikely but architecture supports it: Cross-month swap logic
            const new_iItem = { ...initItem, time: targetItem.time, site: targetItem.site, subslot: targetItem.subslot || 1 };
            const new_tItem = { ...targetItem, time: initItem.time, site: initItem.site, subslot: initItem.subslot || 2 };
            batch.update(db.collection("reservations_monthly").doc(month1), { [`allocations.${initId}`]: firebase.firestore.FieldValue.delete() });
            batch.update(db.collection("reservations_monthly").doc(month2), { [`allocations.${targetId}`]: firebase.firestore.FieldValue.delete() });
            batch.set(db.collection("reservations_monthly").doc(month2), { allocations: { [initId]: new_iItem } }, { merge: true });
            batch.set(db.collection("reservations_monthly").doc(month1), { allocations: { [targetId]: new_tItem } }, { merge: true });
        }
        
        if (swapDocId) batch.delete(db.collection("swaps").doc(swapDocId));
        await batch.commit();
    } catch(e) { 
        console.error(e); 
        throw e; 
    }
}

/**
 * Commits a newly created reservation to Firestore via the double-click modal.
 * @async
 * @param {Object} info - Object containing date, time, and site details.
 * @param {number} pax - Number of places reserved.
 * @param {string} userKeyChoice - Target center code (defaults to current user).
 * @returns {Promise<void>}
 */
async function executeNewSalida(info, pax, userKeyChoice) {
    const { date, time, site } = info;
    const centerCode = USER_CENTER_KEYS[userKeyChoice] || USER_CENTER_KEYS[currentUserKey];
    const monthKey = date.substring(0, 7);
    
    try {
        const updates = {}; 
        let finalSubslot = 1;
        const existingInSlot = allocations.filter(a => a.date === date && a.time === time && a.site === site);
        
        if (existingInSlot.length === 1) {
            finalSubslot = 2; 
            if (existingInSlot[0].subslot !== 1) updates[`allocations.${existingInSlot[0].id}.subslot`] = 1; 
        }

        const uniqueId = `boat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const newItem = { date, time, site, center: centerCode, pax, subslot: finalSubslot };
        updates[`allocations.${uniqueId}`] = newItem;

        try { 
            await db.collection("reservations_monthly").doc(monthKey).update(updates); 
        } catch(e) { 
            // Fallback if the month document does not exist yet
            await db.collection("reservations_monthly").doc(monthKey).set({ allocations: { [uniqueId]: newItem } }, { merge: true }); 
        }
    } catch(e) { 
        showNotification('Error', 'Hubo un problema guardando en la nube.', true); 
    }
}

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
            const initName = CENTERS[req.initiatorCenter].name, d = parseDateT00(req.initiatorData.date);
            const dStr = `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
            
            // Format UX hints if the swap requires a forced reduction due to strict capacity
            const initPaxStr = req.initiatorData.originalPax && req.initiatorData.originalPax > req.initiatorData.pax 
                ? `<span class="text-amber-600 font-bold bg-amber-50 px-1 rounded ml-1">(reducido a ${req.initiatorData.pax} pax)</span>` 
                : `(${req.initiatorData.pax} pax)`;
                
            const targetPaxStr = req.targetData.originalPax && req.targetData.originalPax > req.targetData.pax 
                ? `<span class="text-red-500 font-bold bg-red-50 px-1 rounded ml-1">(Se reducirá a ${req.targetData.pax} pax por límite del cupo)</span>` 
                : `(${req.targetData.pax} pax)`;

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
        });
    }
    showEl('notifications-modal');
}

/**
 * Triggers the pre-flight confirmation modal outlining the exact consequences
 * of requesting a boat swap to another center.
 * @param {string} initId - Initiating reservation ID.
 * @param {Object} initItem - Initiating reservation data.
 * @param {string} targetId - Target reservation ID.
 * @param {Object} targetItem - Target reservation data.
 * @returns {void}
 */
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
 * Displays an intermediate modal if a user drags a boat onto a fully occupied slot,
 * asking them which specific boat they want to initiate a swap with.
 * @param {string} initId - Initiating reservation ID.
 * @param {Object} initItem - Initiating reservation data.
 * @param {Array} targets - Array of target reservation objects residing in the slot.
 * @param {boolean} [isAdmin=false] - Flag indicating if Root Admin bypasses confirmation.
 * @returns {void}
 */
function showSwapChoiceModal(initId, initItem, targets, isAdmin = false) {
    pendingSwapInit = { initId, initItem }; 
    pendingSwapTargets = targets; 
    pendingSwapIsAdmin = isAdmin;
    
    const container = getEl('swap-choice-buttons'); 
    container.innerHTML = '';
    
    targets.forEach(target => {
        const cInfo = CENTERS[target.center], btn = document.createElement('button');
        btn.className = `w-full px-4 py-4 rounded-xl text-sm font-bold shadow-sm border border-slate-200 hover:shadow-md transition-all flex items-center justify-between ${cInfo.color} ${cInfo.text}`;
        btn.innerHTML = `<span>${cInfo.name}</span> <span class="bg-black/20 px-2 py-1 rounded-md">${target.pax} Plazas</span>`;
        btn.onclick = () => selectSwapTarget(target.id);
        container.appendChild(btn);
    });
    showEl('swap-choice-modal');
}

/**
 * Clears the partial action buffers required when enforcing a strict site capacity reduction.
 * @returns {void}
 */
function cancelPartialAction() {
    hideEl('partial-action-modal');
    pendingPartialSwap = null;
    pendingPartialMove = null;
    isProcessingDrop = false;
    renderAll();
}

/**
 * Confirms user consent to a strict capacity reduction during a swap or move,
 * routing to the final step in the action chain.
 * @returns {void}
 */
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

/**
 * God-mode override allowing Admin Root to bypass center approval and instantly
 * execute a swap request.
 * @async
 * @param {string} initId - Initiating reservation ID.
 * @param {Object} initItem - Initiating reservation data.
 * @param {string} targetId - Target reservation ID.
 * @param {Object} targetItem - Target reservation data.
 * @returns {Promise<void>}
 */
async function acceptAdminInstantSwap(initId, initItem, targetId, targetItem) {
    try { 
        await performSwap(initId, initItem, targetId, targetItem); 
    } catch(e) { 
        showNotification('Error', 'Hubo un fallo al realizar el intercambio.', true); 
    }
    isProcessingDrop = false;
}

/**
 * The core logic engine that evaluates a selected swap target. It actively calculates 
 * the real-time capacity constraints of both the origin and target dive sites to ensure
 * a swap does not accidentally overbook a site. Triggers intermediate modals if
 * reservations must be strictly shrunk to comply with constraints.
 * @async
 * @param {string} targetId - The target reservation ID to swap with.
 * @returns {Promise<void>}
 */
async function selectSwapTarget(targetId) {
    hideEl('swap-choice-modal');
    const targetItem = pendingSwapTargets.find(t => t.id === targetId);
    const { initId, initItem } = pendingSwapInit;
    const isAdmin = pendingSwapIsAdmin;
    
    pendingSwapInit = null; 
    pendingSwapTargets = []; 
    pendingSwapIsAdmin = false;
    
    // Dynamic constraint evaluation for the target site
    const itemsInTargetSiteToday = allocations.filter(a => a.date === initItem.date && a.site === targetItem.site);
    const currentPaxTargetSite = itemsInTargetSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const targetSiteCap = getDailyCapacity(initItem.date, targetItem.site);
    const maxAllowedInTarget = targetSiteCap - currentPaxTargetSite + targetItem.pax;

    // Dynamic constraint evaluation for the origin site
    const itemsInInitSiteToday = allocations.filter(a => a.date === initItem.date && a.site === initItem.site);
    const currentPaxInitSite = itemsInInitSiteToday.reduce((sum, a) => sum + a.pax, 0);
    const initSiteCap = getDailyCapacity(initItem.date, initItem.site);
    const maxAllowedInInit = initSiteCap - currentPaxInitSite + initItem.pax;

    let safeInitPax = Math.min(initItem.pax, maxAllowedInTarget);
    let safeTargetPax = Math.min(targetItem.pax, maxAllowedInInit);

    // Hard block if either site is absolutely exhausted
    if (safeInitPax <= 0 || safeTargetPax <= 0) {
        showNotification('Error de Cupo', 'No hay plazas suficientes para realizar este intercambio. El punto está totalmente lleno.', true);
        isProcessingDrop = false;
        return;
    }

    // Only block and warn the initiating user if THEIR boat needs to shrink.
    // If the target boat needs to shrink, that is the target user's problem. They will be warned during the acceptSwap step.
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

/**
 * Pre-flight handler that builds the action trace for a successful drop onto a valid slot.
 * Enqueues the webhook transmission.
 * @param {string} id - The ID of the reservation moving.
 * @param {Object} item - The payload data for the item.
 * @param {string} newTime - Target time slot.
 * @param {string} newSite - Target dive site.
 * @returns {void}
 */
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
    
    // Defer opacity shift slightly so drag ghost generates at full opacity
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
    
    // Clear styles from sibling dropzones to avoid ghost trails
    document.querySelectorAll('.bg-blue-50, .bg-purple-50').forEach(el => { 
        if (el !== e.target.closest('.dropzone')) el.classList.remove('bg-blue-50', 'bg-purple-50'); 
    });

    const dropzone = e.target.closest('.dropzone'); 
    if (!dropzone) return;
    
    // Dynamically query target capacity state to tint the dropzone
    const newTime = dropzone.dataset.time, newSite = dropzone.dataset.site, ds = getStrYMD(currentDate);
    const existing = allocations.filter(a => a.date === ds && a.time === newTime && a.site === newSite && String(a.id) !== String(draggedItemId));
    if (existing.length >= 2) {
        dropzone.classList.add('bg-purple-50'); // Swap threshold
    } else {
        dropzone.classList.add('bg-blue-50');   // Free space threshold
    }
});

document.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('.dropzone');
    if (dropzone && !dropzone.contains(e.relatedTarget)) dropzone.classList.remove('bg-blue-50', 'bg-purple-50');
});

// Primary drop interceptor. Contains the core logic for routing moves vs swaps.
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

    if (existingItemsInSlot.length < 2) {
        /* Route A: Empty Space -> Process Move */
        const itemsInNewSiteToday = allocations.filter(a => a.date === initItem.date && a.site === newSite && String(a.id) !== String(id));
        const currentPaxNewSite = itemsInNewSiteToday.reduce((sum, a) => sum + a.pax, 0);
        const remainingCapacity = getDailyCapacity(initItem.date, newSite) - currentPaxNewSite;

        if (initItem.pax > remainingCapacity) {
            if (remainingCapacity <= 0) {
                showNotification('Cupo Lleno', `No puedes mover la salida aquí. El punto está lleno.`, true);
                isProcessingDrop = false; 
                return;
            }
            
            const dObj = parseDateT00(initItem.date);
            const dStr = `${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()]}`;
            
            pendingPartialMove = { id, item: initItem, newTime, newSite, newPax: remainingCapacity };
            const msg = `Para el **${dStr}**, el punto de destino solo tiene ${remainingCapacity} plazas libres.\n\nTu barco de ${initItem.pax} plazas se reducirá forzosamente a ${remainingCapacity} plazas si realizas el movimiento.\n\n¿Aceptas continuar con este ajuste automático?`;
            
            getEl('partial-action-msg').innerText = msg;
            showEl('partial-action-modal');
            return;
        }

        executeProceedWithMove(id, initItem, newTime, newSite);
    } else {
        /* Route B: Slot Exhausted -> Process Swap */
        if (currentUserKey !== 'admin') {
            const targets = existingItemsInSlot.filter(t => t.center !== initItem.center);
            if (targets.length === 0) { 
                showNotification('Acción Bloqueada', 'Ambos barcos en este horario son tuyos. No puedes hacer un intercambio.', true); 
                isProcessingDrop = false; 
                return; 
            } 
            
            if (targets.length === 1) {
                pendingSwapInit = { initId: id, initItem: initItem }; 
                pendingSwapTargets = targets; 
                pendingSwapIsAdmin = false;
                selectSwapTarget(targets[0].id);
            } else { 
                showSwapChoiceModal(id, initItem, targets, false); 
            }
        } else { 
            const targets = existingItemsInSlot;
            if (targets.length === 1) {
                pendingSwapInit = { initId: id, initItem: initItem }; 
                pendingSwapTargets = targets; 
                pendingSwapIsAdmin = true;
                selectSwapTarget(targets[0].id);
            } else {
                showSwapChoiceModal(id, initItem, targets, true); 
            }
        }
    }
});

/**
 * Handles explicit slot generation for empty spaces via a double-click event.
 * Rejects interaction if target slot holds two boats or site capacity is zero.
 * @param {string} time - The time slot invoked.
 * @param {string} site - The dive site invoked.
 * @returns {void}
 */
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
    
    // Global constraint logic per local legislation mandates 11 max pax per boat.
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

/**
 * Halts the New Salida interaction chain and drops the modal.
 * @returns {void}
 */
function cancelNewSalida() { 
    hideEl('new-salida-modal'); 
    pendingNewSalida = null; 
}

/**
 * Validates user input from the Double Click modal and queues the database
 * save (and webhook dispatch if applicable).
 * @async
 * @returns {Promise<void>}
 */
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
    
    if (currentUserKey === 'admin') {
        await executeNewSalida(pendingNewSalida, pax, getEl('new-salida-center').value);
    } else {
        const { date, time, site } = pendingNewSalida;
        const dObj = parseDateT00(date);
        const centerInfo = getCenterInfoSafe(currentUserKey);
        
        const msg = `🤖 *AVISO AUTOMÁTICO*\n➕ *NUEVA SALIDA* - ${centerInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, añadió una salida a *${site} (${time})* de ${pax} plazas.`;
        
        pendingNewSalidaWA = { data: pendingNewSalida, pax: pax, centerKey: currentUserKey, msg: msg };
        
        getEl('wa-action-type').textContent = "Nueva Salida"; 
        getEl('confirm-whatsapp-msg').innerText = msg; 
        showEl('whatsapp-confirm-modal');
    }
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