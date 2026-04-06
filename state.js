/**
 * @file state.js
 * @description The Global State Manager (Model layer). This file houses the core 
 * business logic for date and capacity calculations, as well as the application's 
 * primary state variables. By centralizing these variables, other files (like ui.js 
 * and app.js) can read from and write to a single source of truth without 
 * encountering scope collisions or passing massive objects around.
 */

/* =========================================================================
   GLOBAL STATE VARIABLES (The Application's Memory)
   ========================================================================= */

/** * @type {Date} 
 * The currently selected date in the application. Drives the rendering of the 
 * Diario, Semanal, and Mensual views. Defaults to March 29, 2026.
 */
let currentDate = new Date(); 

/** * @type {Array<Object>} 
 * The active array of all boat reservations (allocations) fetched from Firestore 
 * for the currently loaded context.
 */
let allocations = []; 

/** * @type {Array<Object>} 
 * Array of pending inter-center swap request documents fetched from Firestore.
 */
let swapRequests = []; 

/** * @type {Array<Object>} 
 * Array of system activity logs (moves, adds, swaps) fetched from Firestore.
 */
let historyLogs = []; 

/** * @type {Array<string>} 
 * Array of center single-letter codes currently active in the UI filter. 
 * Defaults to all centers.
 */
let selectedCenters = Object.keys(CENTERS);

/** * @type {string|number} 
 * The currently selected month filter for the History view. 'all' or 0-11.
 */
let selectedHistoryMonth = 'all'; 

/** * @type {string} 
 * The currently active viewport mode ('diario', 'semanal', 'mensual', 'estadisticas', 'historial').
 */
let activeViewMode = 'diario';

/** * @type {string} 
 * The unit of measurement for the Statistics view ('plazas' or 'barcos').
 */
let statsUnit = 'plazas'; 

/** * @type {boolean} 
 * Flag indicating if the user is unauthenticated (read-only mode).
 */
let isGuestMode = false;

/** * @type {string} 
 * The internal key of the currently authenticated user (e.g., 'mangamar', 'admin', 'guest').
 */
let currentUserKey = 'guest';

/** @type {number} Current page index for the History pagination table. */
let historyCurrentPage = 1;

/** @type {number} Number of log items to display per page in the History table. */
let historyItemsPerPage = 20;

/* =========================================================================
   BUSINESS LOGIC: DATES, SEASONS & CAPACITIES
   ========================================================================= */

/**
 * Determina si el día tiene cupo de Fin de Semana (Sábado, Domingo, o Festivo Capitanía)
 */
const isWH = dStr => {
    const day = parseDateT00(dStr).getDay();
    // 0 = Domingo, 6 = Sábado
    return day === 0 || day === 6 || FESTIVOS_CAPITANIA.has(dStr);
};

/**
 * Determina si el día debe pintarse en rojo en el calendario UI.
 * Pintamos los fines de semana, festivos y los bloques de temporada especial.
 */
const isRedCalendarDay = dStr => {
    if (isWH(dStr)) return true;
    const t = parseDateT00(dStr).getTime();
    return PERIODOS_ESPECIALES.some(p => t >= p.start && t <= p.end);
};

/**
 * Averigua qué temporada aplica para un día específico.
 * Primero comprueba si la fecha cae en un "Periodo Especial". Si no, mira el mes.
 */
const getSeasonProfile = dStr => {
    const dObj = parseDateT00(dStr);
    const t = dObj.getTime();
    const m = dObj.getMonth();

    // 1. Prioridad: ¿Es un periodo especial? (Semana Santa, Navidad, etc.)
    const special = PERIODOS_ESPECIALES.find(p => t >= p.start && t <= p.end);
    if (special) return special.season;

    // 2. Si no, aplicar temporada por defecto del mes
    if (CAPACITY_RULES.seasons.peak.includes(m)) return 'peak';
    if (CAPACITY_RULES.seasons.high.includes(m)) return 'high';
    return 'low';
};

/**
 * Devuelve el límite estricto de plazas basándose en el punto, día y temporada.
 */
const getDailyCapacity = (dStr, site) => {
    const isWe = isWH(dStr);
    if (site === 'Morra' && !isWe) return 0; 
    return CAPACITY_RULES.caps[getSeasonProfile(dStr)][isWe ? 'weekend' : 'weekday'][site] || 0;
};

/**
 * Filtra los puntos de buceo inactivos (Elimina Morra en días laborables)
 */
const getDailySites = dStr => isWH(dStr) ? SITES : ['Bajo de Dentro', 'Piles II', 'Piles I', 'Testa'];