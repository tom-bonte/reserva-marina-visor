/**
 * @file config.js
 * @description Core configuration and constants for the Visor Reserva Interior application.
 * This file holds all static data models, including dive sites, capacities, center 
 * profiles, calendar logic (holidays/seasons), and external service configurations 
 * (Firebase and Make.com).
 */

/** @constant {string[]} Array of valid dive site names within the marine reserve. */
const SITES = ['Bajo de Dentro', 'Piles II', 'Piles I', 'Testa', 'Morra'];

/** @constant {string[]} Array defining the three possible seasonal volume profiles. */
const SEASONS = ['peak', 'high', 'low'];

/** @constant {string[]} Array of standard daily time slots for dive boat departures. */
const TIMES = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'];

/**
 * @constant {Set<string>}
 * Contains the dates (YYYY-MM-DD) of all official regional and national holidays 
 * for 2026. These dates are treated as "weekends" for capacity calculations.
 */
const FESTIVOS = new Set([
    '2026-03-19', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-09', 
    '2026-07-16', '2026-08-17', '2026-10-09', '2026-10-12', '2026-10-13', 
    '2026-11-02', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-25'
]);

/**
 * Fechas exactas aprobadas por Capitanía para 2026 que actúan con cupo de "Fin de Semana".
 * Nota: El 1 de Mayo y el 25 de Diciembre NO están aquí porque Capitanía exige cupo diario.
 */
const FESTIVOS_CAPITANIA = new Set([
    '2026-03-19', // San José
    '2026-04-02', // Jueves Santo
    '2026-04-03', // Viernes Santo
    '2026-06-09', // Día Región Murcia
    '2026-07-16', // Virgen del Carmen
    '2026-08-17', // Puente Asunción
    '2026-10-09', // Día Com. Valenciana
    '2026-10-12', // Pilar
    '2026-10-13', // Puente Octubre
    '2026-11-02', // Todos los Santos (Lunes)
    '2026-12-07', // Puente Constitución
    '2026-12-08', // Inmaculada
    '2026-12-09'  // Puente Constitución
]);

/**
 * Periodos que fuerzan la temporada a "ALTA" aunque el mes sea de temporada baja.
 */
const PERIODOS_ESPECIALES = [
    { start: parseDateT00("2026-03-27").getTime(), end: parseDateT00("2026-04-06").getTime(), season: 'high' }, // Semana Santa
    { start: parseDateT00("2026-05-01").getTime(), end: parseDateT00("2026-05-03").getTime(), season: 'high' }, // Puente Mayo
    { start: parseDateT00("2026-12-25").getTime(), end: parseDateT00("2026-12-31").getTime(), season: 'high' }  // Navidad
];

/**
 * @constant {Object}
 * Hardcoded capacity rules based on simple seasonal and weekend/weekday splits.
 * Note: Total counts are -20 from absolute max because 20 slots belong to 'Palomas'.
 */
const CAPACITY_RULES = {
    seasons: {
        peak: [6, 7], // Julio, Agosto
        high: [5, 8], // Junio, Septiembre
        low:  [0, 1, 2, 3, 4, 9, 10, 11] // Ene, Feb, Mar, Abr, May, Oct, Nov, Dic
    },
    caps: {
        peak: {
            weekend: { 'Bajo de Dentro': 70, 'Piles II': 60, 'Piles I': 60, 'Testa': 50, 'Morra': 60 }, // Total 300 (+20 Palomas = 320)
            weekday: { 'Bajo de Dentro': 50, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 0 }   // Total 180 (+20 Palomas = 200)
        },
        high: {
            weekend: { 'Bajo de Dentro': 70, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 50 }, // Total 250 (+20 Palomas = 270)
            weekday: { 'Bajo de Dentro': 50, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 0 }   // Total 180 (+20 Palomas = 200)
        },
        low: {
            weekend: { 'Bajo de Dentro': 60, 'Piles II': 40, 'Piles I': 40, 'Testa': 20, 'Morra': 40 }, // Total 200 (+20 Palomas = 220)
            weekday: { 'Bajo de Dentro': 40, 'Piles II': 40, 'Piles I': 40, 'Testa': 20, 'Morra': 0 }   // Total 140 (+20 Palomas = 160)
        }
    }
};

/**
 * @constant {Object}
 * Dictionary of all participating dive centers.
 * Maps a single-letter code to the center's name and UI styling (Tailwind classes for the app, 
 * and hex codes for jsPDF generation).
 */
const CENTERS = {
    'B': { name: 'Balky', emoji: '🔴', color: 'bg-[#ef4444]', text: 'text-white', pdfBg: '#ef4444', pdfText: '#ffffff' }, 
    'H': { name: 'Islas Hormigas', emoji: '⚫', color: 'bg-[#0f172a]', text: 'text-white', pdfBg: '#000000', pdfText: '#ffffff' }, 
    'M': { name: 'Mangamar', emoji: '🟢', color: 'bg-[#22c55e]', text: 'text-white', pdfBg: '#00b050', pdfText: '#ffffff' }, 
    'N': { name: 'Naranjito', emoji: '🟠', color: 'bg-[#fbbf24]', text: 'text-slate-900', pdfBg: '#f59e0b', pdfText: '#000000' }, 
    'P': { name: 'Planeta Azul', emoji: '🔵', color: 'bg-[#3b82f6]', text: 'text-white', pdfBg: '#3b82f6', pdfText: '#ffffff' }, 
    'D': { name: 'Divers', emoji: '🟣', color: 'bg-[#6d28d9]', text: 'text-white', pdfBg: '#a855f7', pdfText: '#ffffff' }, 
    'C': { name: 'CLUB', emoji: '🔘', color: 'bg-[#64748b]', text: 'text-white', pdfBg: '#64748b', pdfText: '#ffffff' }, 
    'X': { name: 'X La Manga', emoji: '⚪', color: 'bg-[#cbd5e1]', text: 'text-slate-800', pdfBg: '#cbd5e1', pdfText: '#000000' } 
};

/** @constant {string[]} Full Spanish names for days of the week, matching JS Date.getDay() index. */
const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];

/** @constant {string[]} Full Spanish names for months of the year, matching JS Date.getMonth() index. */
const MONTHS_ES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/** @constant {string[]} Shortened Spanish names for months of the year, matching JS Date.getMonth() index. */
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * @constant {Object}
 * Maps internal user identity keys (used in the UI dropdown) to the pseudo-email addresses 
 * required for Firebase Authentication.
 */
const EMAIL_MAP = {
    'admin': 'admin@visor.local', 'mangamar': 'mangamar@visor.local', 'balky': 'balky@visor.local',
    'hormigas': 'hormigas@visor.local', 'naranjito': 'naranjito@visor.local', 'planeta': 'planeta@visor.local',
    'divers': 'divers@visor.local', 'club': 'club@visor.local', 'xlm': 'xlm@visor.local'
};

/**
 * @constant {Object}
 * Translates a user identity key into the single-letter code representing their center.
 * Used for filtering and identifying ownership of dragged boats.
 */
const USER_CENTER_KEYS = {
    'balky': 'B', 'hormigas': 'H', 'mangamar': 'M', 'naranjito': 'N',
    'planeta': 'P', 'divers': 'D', 'club': 'C', 'xlm': 'X'
};

/**
 * @constant {Object}
 * Dictionary defining the UI styling for the top-right user badge based on the current logged-in user.
 */
const BADGE_INFO = {
    'admin': { name: 'Admin Root', color: 'bg-slate-800', text: 'text-white' },
    'mangamar': { name: 'Mangamar', color: 'bg-[#22c55e]', text: 'text-white' },
    'balky': { name: 'Balky', color: 'bg-[#ef4444]', text: 'text-white' },
    'hormigas': { name: 'Islas Hormigas', color: 'bg-[#0f172a]', text: 'text-white' },
    'naranjito': { name: 'Naranjito', color: 'bg-[#fbbf24]', text: 'text-slate-900' },
    'planeta': { name: 'Planeta Azul', color: 'bg-[#3b82f6]', text: 'text-white' },
    'divers': { name: 'Divers', color: 'bg-[#6d28d9]', text: 'text-white' },
    'club': { name: 'CLUB', color: 'bg-[#64748b]', text: 'text-white' },
    'xlm': { name: 'X La Manga', color: 'bg-[#cbd5e1]', text: 'text-slate-800' }
};

/**
 * @constant {string}
 * The endpoint URL for the Make.com webhook. Used by `sendSilentWebhook()` to push 
 * automated update messages to the WhatsApp group.
 */
const WHATSAPP_WEBHOOK_URL = "https://hook.eu1.make.com/nwgnqeiosbu73mtwljk7i252atthcuwd";

/**
 * @constant {Object}
 * Configuration keys required to initialize the connection to the Firebase cloud environment.
 */
const firebaseConfig = {
    apiKey: "AIzaSyBe7X5AUC-PpcJSCYgMzyyUMJMPqxtTdiw",
    authDomain: "reserva-marina-cdp.firebaseapp.com",
    projectId: "reserva-marina-cdp",
    storageBucket: "reserva-marina-cdp.appspot.com",
    messagingSenderId: "242126338137",
    appId: "1:242126338137:web:c32d20d4697545a172d948"
};