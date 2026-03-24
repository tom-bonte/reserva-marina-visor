/**
 * @file utils.js
 * @description A collection of pure, globally accessible utility functions. 
 * This file contains DOM manipulation shorthands, complex Date/Time mathematics 
 * (specifically engineered to avoid timezone shifting bugs), and string 
 * normalization tools used heavily during CSV data imports.
 */

/* =========================================================================
   1. DOM MANIPULATION SHORTHANDS
   ========================================================================= */

/**
 * Shorthand for document.getElementById.
 * @param {string} id - The ID of the DOM element.
 * @returns {HTMLElement|null} The DOM element, or null if not found.
 */
const getEl = id => document.getElementById(id);

/**
 * Safely adds Tailwind's 'hidden' class to a DOM element to remove it from the display.
 * Uses optional chaining (?.) to prevent errors if the element doesn't exist.
 * @param {string} id - The ID of the DOM element to hide.
 */
const hideEl = id => getEl(id)?.classList.add('hidden');

/**
 * Safely removes Tailwind's 'hidden' class from a DOM element to display it.
 * @param {string} id - The ID of the DOM element to show.
 */
const showEl = id => getEl(id)?.classList.remove('hidden');

/**
 * Safely toggles Tailwind's 'hidden' class on a DOM element.
 * @param {string} id - The ID of the DOM element to toggle.
 */
const toggleVis = id => getEl(id)?.classList.toggle('hidden');


/* =========================================================================
   2. DATE & TIME PARSERS
   ========================================================================= */

/**
 * Parses a standard date string into a localized Date object.
 * Appends "T00:00:00" before parsing. This is a critical fix to force the JS engine 
 * to evaluate the date in the local timezone rather than UTC, preventing "off-by-one-day" bugs.
 * @param {string} dateStr - Date string in "YYYY-MM-DD" format.
 * @returns {Date} A JavaScript Date object set to midnight local time.
 */
const parseDateT00 = dateStr => new Date(dateStr + "T00:00:00");

/**
 * Converts a JavaScript Date object back into a strict "YYYY-MM-DD" string format.
 * Automatically pads single-digit months and days with leading zeros.
 * @param {Date} d - The JavaScript Date object.
 * @returns {string} Formatted date string.
 */
const getStrYMD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Calculates and returns the Monday of the week for a given Date.
 * Considers Monday as the first day of the week.
 * @param {Date|string|number} d - The reference date.
 * @returns {Date} A new Date object representing the Monday of that week.
 */
function getMonday(d) { 
    d = new Date(d); 
    var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff)); 
}

/**
 * Calculates the ISO-8601 week number for a given date.
 * @param {Date} d - The reference Date object.
 * @returns {number} The week number (1-52 or 53).
 */
function getWeekNumber(d) { 
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); 
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); 
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); 
    return Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7); 
}

/**
 * Reconstructs a specific Date (always a Monday) based on an ISO week number and year.
 * @param {number} w - The ISO week number.
 * @param {number} y - The 4-digit year.
 * @returns {Date} A Date object representing the Monday of the requested week.
 */
function getDateOfISOWeek(w, y) { 
    var simple = new Date(y, 0, 1 + (w - 1) * 7); 
    var ISOweekStart = simple; 
    if (simple.getDay() <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); 
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay()); 
    return ISOweekStart; 
}


/* =========================================================================
   3. DATA NORMALIZATION (CSV SANITIZATION)
   ========================================================================= */

/**
 * Generates a consistent, strictly alphanumeric unique identifier string for a boat reservation.
 * Strips out all special characters, spaces, and symbols to ensure safe usage as a DOM ID or object key.
 * @param {string} date - Reservation date.
 * @param {string} time - Reservation time.
 * @param {string} site - Dive site name.
 * @param {string} center - Center code or name.
 * @param {number|string} subslot - Subslot indicator (1 or 2).
 * @returns {string} Sanitized concatenated ID.
 */
function generateId(date, time, site, center, subslot) {
    return `${date.replace(/[^0-9-]/g, '')}_${time.replace(/[^0-9]/g, '')}_${site.replace(/[^a-zA-Z0-9]/g, '')}_${center.replace(/[^a-zA-Z0-9]/g, '')}_${subslot}`;
}

/**
 * Intelligently normalizes messy date strings parsed from a CSV file.
 * Handles variations like DD/MM/YY, DD-MM-YYYY, or YYYY/MM/DD and strictly 
 * coerces them into the system-standard "YYYY-MM-DD" format.
 * @param {string} dateStr - The raw date string from the CSV.
 * @returns {string} Normalized "YYYY-MM-DD" string.
 */
function normalizeCSVDate(dateStr) { 
    let p; 
    if (dateStr.includes('/')) p = dateStr.split('/'); 
    else if (dateStr.includes('-')) p = dateStr.split('-'); 
    else return dateStr.replace(/[^0-9-]/g, '-'); 
    
    if (p.length === 3) { 
        if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`; 
        else return `${p[2].length === 2 ? '20'+p[2] : p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; 
    } 
    return dateStr.replace(/[^0-9-]/g, '-'); 
}

/**
 * Normalizes time strings parsed from a CSV file.
 * Ensures single-digit hours (e.g., "9:00") are zero-padded to standard "HH:MM" format ("09:00").
 * @param {string} timeStr - The raw time string from the CSV.
 * @returns {string} Normalized "HH:MM" string.
 */
function normalizeCSVTime(timeStr) { 
    let p = timeStr.split(':'); 
    if(p.length >= 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`; 
    return timeStr; 
}