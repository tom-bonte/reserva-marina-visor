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

/** * @type {Object} 
 * The active capacity configuration matrix. Initialized with DEFAULT_CAPS from config.js,
 * but dynamically overwritten by Firebase if an admin has customized the seasons or caps.
 */
let sysConfig = JSON.parse(JSON.stringify(DEFAULT_CAPS));

/** * @type {Date} 
 * The currently selected date in the application. Drives the rendering of the 
 * Diario, Semanal, and Mensual views. Defaults to March 29, 2026.
 */
let currentDate = new Date(2026, 2, 29); 

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
 * Determines if a given date string falls on a weekend or an official holiday.
 * @param {string} dStr - The date string in YYYY-MM-DD format.
 * @returns {boolean} True if the date is a Saturday, Sunday, or exists in the FESTIVOS set.
 */
const isWH = dStr => {
    const day = parseDateT00(dStr).getDay();
    // 0 = Sunday, 6 = Saturday
    return day === 0 || day === 6 || FESTIVOS.has(dStr);
};

/**
 * Determines if a date should be painted red on the calendar UI. 
 * A red day is either a weekend/holiday OR falls within a Special Period (like Semana Santa).
 * @param {string} dStr - The date string in YYYY-MM-DD format.
 * @returns {boolean} True if the date requires red highlighting.
 */
const isRedCalendarDay = dStr => {
    if (isWH(dStr)) return true;
    const t = parseDateT00(dStr).getTime();
    // Check if the timestamp falls within any defined SPECIAL_PERIODS ranges
    return SPECIAL_PERIODS.some(p => t >= p.start && t <= p.end);
};

/**
 * Evaluates a given date against the system configuration to determine its 
 * seasonal profile for capacity planning.
 * @param {string} dStr - The date string in YYYY-MM-DD format.
 * @returns {string} The season profile key: 'peak', 'high', or 'low'.
 */
const getSeasonProfile = dStr => {
    const d = parseDateT00(dStr);
    const t = d.getTime();
    const m = d.getMonth();
    
    if (sysConfig.peakSeasonMonths.includes(m)) return 'peak';
    
    // High season includes designated months AND any Special Periods (even if in a Low month)
    if (sysConfig.highSeasonMonths.includes(m) || SPECIAL_PERIODS.some(p => t >= p.start && t <= p.end)) return 'high';
    
    return 'low';
};

/**
 * Pure declarative logic function: Calculates the absolute maximum number of 
 * divers allowed at a specific site on a specific date.
 * Relies on the intersection of Season, Day Type (Weekend vs Weekday), and Site rules.
 * @param {string} dStr - The date string in YYYY-MM-DD format.
 * @param {string} site - The name of the dive site.
 * @returns {number} The maximum allowed passenger capacity.
 */
const getDailyCapacity = (dStr, site) => {
    const isWe = isWH(dStr);
    
    // Strict business rule: Morra is always closed (0 capacity) on standard weekdays.
    if (site === 'Morra' && !isWe) return 0; 
    
    // Traverse the 3-tier matrix: Matrix[Season][DayType][Site]
    return sysConfig.capacities[getSeasonProfile(dStr)][isWe ? 'weekend' : 'weekday'][site] || 0;
};

/**
 * Determines which dive sites are open and active on a given date.
 * Morra is excluded from the array on standard weekdays.
 * @param {string} dStr - The date string in YYYY-MM-DD format.
 * @returns {string[]} Array of active dive site names.
 */
const getDailySites = dStr => isWH(dStr) ? SITES : ['Bajo de Dentro', 'Piles II', 'Piles I', 'Testa'];