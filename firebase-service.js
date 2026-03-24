/**
 * @file firebase-service.js
 * @description The Database Layer (Model). Isolates all direct interactions with the 
 * Google Firebase infrastructure. Handles establishing listeners for real-time 
 * syncing, writing history logs, resolving drag-and-drop movements natively in the cloud, 
 * and handling the atomic transactions required for boat swaps and new boat additions.
 */

// Initialize Firebase Core services
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Pointers to active data streams. Nullified upon disconnect/reboot.
let unsubscribeSnapshot = null; 
let unsubscribeSwaps = null; 
let unsubscribeHistory = null; 
let unsubscribeConfig = null;

/**
 * Boots up real-time listeners attached to specific Firestore collections.
 * Pulls down live arrays and triggers the UI (`renderAll()`) to repaint upon any cloud changes.
 * Automatically unsubscribes and re-establishes connections if called consecutively to prevent memory leaks.
 * @returns {void}
 */
function startFirestoreListener() {
    if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
    if (unsubscribeSwaps) { unsubscribeSwaps(); unsubscribeSwaps = null; }
    if (unsubscribeHistory) { unsubscribeHistory(); unsubscribeHistory = null; }
    if (unsubscribeConfig) { unsubscribeConfig(); unsubscribeConfig = null; }

    // 1. Listen for global capacity configuration changes
    unsubscribeConfig = db.collection("config").doc("capacities").onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            sysConfig = {
                peakSeasonMonths: data.peakSeasonMonths || DEFAULT_CAPS.peakSeasonMonths,
                highSeasonMonths: data.highSeasonMonths || DEFAULT_CAPS.highSeasonMonths,
                capacities: {
                    peak: data.capacities?.peak || DEFAULT_CAPS.capacities.peak,
                    high: data.capacities?.high || DEFAULT_CAPS.capacities.high,
                    low:  data.capacities?.low  || DEFAULT_CAPS.capacities.low
                }
            };
            // FORCE PATCH: Overwrite old ghost values if they erroneously exist in the DB
            if (sysConfig.capacities.peak.weekend['Piles II'] === 50) {
                sysConfig.capacities.peak.weekend = { ...DEFAULT_CAPS.capacities.peak.weekend };
            }
        } else {
            sysConfig = JSON.parse(JSON.stringify(DEFAULT_CAPS));
        }
        renderAll();
    });

    // 2. Listen for core reservation allocations (Boats)
    unsubscribeSnapshot = db.collection("reservations_monthly").onSnapshot((snapshot) => {
        const dataFromCloud = [];
        snapshot.forEach((doc) => {
            const monthData = doc.data().allocations || {};
            // Flatten the nested month structure into a single linear array
            for (const customDocId in monthData) dataFromCloud.push({ id: customDocId, ...monthData[customDocId] });
        });
        allocations = dataFromCloud;
        renderAll();
    });

    // 3. Listen for pending inter-center swap requests
    unsubscribeSwaps = db.collection("swaps").onSnapshot((snapshot) => {
        const swapsFromCloud = [];
        snapshot.forEach(doc => { swapsFromCloud.push({ id: doc.id, ...doc.data() }); });
        swapRequests = swapsFromCloud;
        updateNotificationsMenu();
        renderAll(); 
    });

    // 4. Listen for system activity logs for the History Feed
    unsubscribeHistory = db.collection("history_logs").onSnapshot((snapshot) => {
        const historyFromCloud = [];
        snapshot.forEach(doc => { historyFromCloud.push({ id: doc.id, ...doc.data() }); });
        historyLogs = historyFromCloud;
        if (activeViewMode === 'historial') renderHistory();
    });
}

/**
 * Pushes a new chronological activity log to Firestore.
 * Bypasses logging if the user is an Admin or Guest to keep metrics focused on Center activity.
 * @async
 * @param {string} actionType - 'move', 'swap', or 'add'
 * @param {Object} details - Payload of data related to the specific action.
 * @returns {Promise<void>}
 */
async function logHistory(actionType, details) {
    if (currentUserKey === 'admin' || isGuestMode) return; 
    try {
        await db.collection("history_logs").add({ 
            actionType, 
            centerKey: currentUserKey, 
            details, 
            timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
    } catch (e) { 
        console.error("Error writing to history log:", e); 
    }
}

/**
 * Directly updates a reservation document in Firestore after a drag/drop move.
 * Calculates logic locally to resolve subslot collisions (position 1 vs position 2).
 * @async
 * @param {string} id - The unique ID of the reservation.
 * @param {Object} item - The current reservation object payload.
 * @param {string} newTime - The target time slot (e.g. '09:00').
 * @param {string} newSite - The target dive site.
 * @returns {Promise<void>}
 */
async function executeDrop(id, item, newTime, newSite) {
    const monthKey = item.date.substring(0, 7); 
    try {
        const updates = {}; 
        let finalSubslot = 1;
        
        // Ensure the old slot is cleaned up correctly if a sibling boat remains
        const remainingOld = allocations.filter(a => a.date === item.date && a.time === item.time && a.site === item.site && String(a.id) !== String(id));
        if (remainingOld.length === 1 && remainingOld[0].subslot !== 1) updates[`allocations.${remainingOld[0].id}.subslot`] = 1;

        // Ensure target slot receives correct placement index
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
 * Executes an atomic batch write to swap two reservation documents simultaneously.
 * Uses a Firestore batch to ensure both updates succeed, or both fail together, preventing corrupted state.
 * Handles both intra-month and complex cross-month swap logic.
 * @async
 * @param {string} initId - Initiating reservation ID.
 * @param {Object} initItem - Initiating reservation data payload.
 * @param {string} targetId - Target reservation ID.
 * @param {Object} targetItem - Target reservation data payload.
 * @param {string|null} swapDocId - Optional ID of the pending swap request to delete upon success.
 * @returns {Promise<void>}
 */
async function performSwap(initId, initItem, targetId, targetItem, swapDocId = null) {
    const month1 = initItem.date.substring(0, 7), month2 = targetItem.date.substring(0, 7); 
    try {
        const batch = db.batch();
        if (month1 === month2) {
            // Standard swap within the same month document
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
            // Complex cross-month swap: Requires deep object deletion and recreation
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
 * Commits a newly created boat reservation to Firestore.
 * Automatically generates a unique ID token and positions it accurately inside the monthly allocation block.
 * @async
 * @param {Object} info - Object containing date, time, and site details.
 * @param {number} pax - Number of places reserved by the center.
 * @param {string} userKeyChoice - Target center code (defaults to the currently authenticated user).
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
            // Fallback strategy: if the YYYY-MM document doesn't exist yet, force creation
            await db.collection("reservations_monthly").doc(monthKey).set({ allocations: { [uniqueId]: newItem } }, { merge: true }); 
        }
    } catch(e) { 
        showNotification('Error', 'Hubo un problema guardando en la nube.', true); 
    }
}

/**
 * Destroys a pending swap request document from the cloud when denied by the target center.
 * @async
 * @param {string} swapId - The unique ID of the swap request to destroy.
 * @returns {Promise<void>}
 */
async function rejectSwap(swapId) { 
    try { 
        await db.collection("swaps").doc(swapId).delete(); 
        openNotificationsModal(); 
    } catch(e) {} 
}

/**
 * Finalizes an inter-center swap by verifying live capacities immediately before
 * executing the atomic database write via `performSwap()`. Shuts down the swap
 * if the environment has drastically changed since the request was made.
 * @async
 * @param {string} swapId - The unique ID of the swap request to approve and execute.
 * @returns {Promise<void>}
 */
async function acceptSwap(swapId) {
    const req = swapRequests.find(s => s.id === swapId); 
    if (!req) return;
    
    hideEl('notifications-modal');

    // --- REAL-TIME CAPACITY CHECK ---
    // Recalculate capacity limits at the exact moment of execution to prevent double-booking anomalies
    const liveInitItem = allocations.find(a => String(a.id) === String(req.initiatorId));
    const liveTargetItem = allocations.find(a => String(a.id) === String(req.targetId));

    if (!liveInitItem || !liveTargetItem) {
        showNotification('Error', 'Uno de los barcos ya no existe. Intercambio cancelado.', true);
        db.collection("swaps").doc(swapId).delete();
        return;
    }

    const desiredInitPax = req.initiatorData.originalPax || liveInitItem.pax;
    const desiredTargetPax = req.targetData.originalPax || liveTargetItem.pax;

    const itemsInTargetSite = allocations.filter(a => a.date === liveInitItem.date && a.site === liveTargetItem.site && String(a.id) !== String(liveTargetItem.id) && String(a.id) !== String(liveInitItem.id));
    const currentPaxTargetSite = itemsInTargetSite.reduce((sum, a) => sum + a.pax, 0);
    const maxAllowedInTarget = getDailyCapacity(liveInitItem.date, liveTargetItem.site) - currentPaxTargetSite;

    const itemsInInitSite = allocations.filter(a => a.date === liveInitItem.date && a.site === liveInitItem.site && String(a.id) !== String(liveInitItem.id) && String(a.id) !== String(liveTargetItem.id));
    const currentPaxInitSite = itemsInInitSite.reduce((sum, a) => sum + a.pax, 0);
    const maxAllowedInInit = getDailyCapacity(liveInitItem.date, liveInitItem.site) - currentPaxInitSite;

    // Apply strict site volume shrinkage if required
    let finalInitPax = Math.min(desiredInitPax, maxAllowedInTarget);
    let finalTargetPax = Math.min(desiredTargetPax, maxAllowedInInit);

    if (finalInitPax <= 0 || finalTargetPax <= 0) {
        showNotification('Error de Cupo', 'El cupo de uno de los puntos se ha llenado. Ya no hay espacio para realizar este intercambio.', true);
        db.collection("swaps").doc(swapId).delete();
        return;
    }

    const finalInitData = { ...liveInitItem, pax: finalInitPax };
    const finalTargetData = { ...liveTargetItem, pax: finalTargetPax };

    try {
        await performSwap(req.initiatorId, finalInitData, req.targetId, finalTargetData, swapId);
        
        const targetInfo = getCenterInfoSafe(req.targetData.center);
        const initInfo = getCenterInfoSafe(req.initiatorCenter);
        const d = parseDateT00(liveInitItem.date);
        
        let paxNote = "";
        if (finalInitPax < desiredInitPax || finalTargetPax < desiredTargetPax) {
            paxNote = `\n⚠️ Ajuste por cupo actual: ${initInfo.name} movió ${finalInitPax} pax. ${targetInfo.name} movió ${finalTargetPax} pax.`;
        }

        // Fire confirmation webhook upon success
        const msg = `🤖 *AVISO AUTOMÁTICO*\n✅ *INTERCAMBIO ACEPTADO* - ${initInfo.name} y ${targetInfo.name}\nPara el ${d.getDate()} de ${MONTHS_ES[d.getMonth()].toUpperCase()}, intercambiaron *${liveInitItem.site} (${liveInitItem.time})* (${finalInitPax} pax) por *${liveTargetItem.site} (${liveTargetItem.time})* (${finalTargetPax} pax).${paxNote}`;
        await sendSilentWebhook(msg);
        
        logHistory('swap', { 
            date: liveInitItem.date, 
            initCenter: req.initiatorCenter, 
            initSite: liveInitItem.site, 
            initTime: liveInitItem.time, 
            initPax: finalInitPax, 
            targetCenter: req.targetData.center, 
            targetSite: liveTargetItem.site, 
            targetTime: liveTargetItem.time, 
            targetPax: finalTargetPax 
        });
    } catch(e) { 
        showNotification('Error', 'Hubo un fallo al realizar el intercambio.', true); 
    }
}