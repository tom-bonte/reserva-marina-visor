        /* =========================================================================
           1. CORE DATA, UTILITIES & INITIALIZATION ENGINE
           ========================================================================= */
        const getEl = id => document.getElementById(id);
        const hideEl = id => getEl(id)?.classList.add('hidden');
        const showEl = id => getEl(id)?.classList.remove('hidden');
        const toggleVis = id => getEl(id)?.classList.toggle('hidden');

        // Elegant date parser to avoid timezone mismatch
        const parseDateT00 = dateStr => new Date(dateStr + "T00:00:00");
        const getStrYMD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const SITES = ['Bajo de Dentro', 'Piles II', 'Piles I', 'Testa', 'Morra'];
        const SEASONS = ['peak', 'high', 'low'];
        const TIMES = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'];
        
        const FESTIVOS = new Set([
            '2026-03-19', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-09', 
            '2026-07-16', '2026-08-17', '2026-10-09', '2026-10-12', '2026-10-13', 
            '2026-11-02', '2026-12-07', '2026-12-08', '2026-12-09', '2026-12-25'
        ]);

        // Fixed blocks that act as High Season (Alta) AND completely red calendar days.
        const SPECIAL_PERIODS = [
            { start: parseDateT00("2026-03-27").getTime(), end: parseDateT00("2026-04-06").getTime() }, // Semana Santa
            { start: parseDateT00("2026-12-25").getTime(), end: parseDateT00("2026-12-31").getTime() }  // Navidad
        ];

        // DRY matrix definition
        const DEFAULT_CAPS = {
            peakSeasonMonths: [6, 7], // Jul, Aug
            highSeasonMonths: [5, 8], // Jun, Sep
            capacities: {
                peak: {
                    weekend: { 'Bajo de Dentro': 70, 'Piles II': 60, 'Piles I': 60, 'Testa': 50, 'Morra': 60 },
                    weekday: { 'Bajo de Dentro': 50, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 0 }
                },
                high: {
                    weekend: { 'Bajo de Dentro': 70, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 50 },
                    weekday: { 'Bajo de Dentro': 50, 'Piles II': 50, 'Piles I': 50, 'Testa': 30, 'Morra': 0 }
                },
                low: {
                    weekend: { 'Bajo de Dentro': 60, 'Piles II': 40, 'Piles I': 40, 'Testa': 20, 'Morra': 40 },
                    weekday: { 'Bajo de Dentro': 40, 'Piles II': 40, 'Piles I': 40, 'Testa': 20, 'Morra': 0 }
                }
            }
        };

        // Master state
        let sysConfig = JSON.parse(JSON.stringify(DEFAULT_CAPS));

        // Logic check for Weekends and Festivos
        const isWH = dStr => {
            const day = parseDateT00(dStr).getDay();
            return day === 0 || day === 6 || FESTIVOS.has(dStr);
        };

        // Logic check for painting the calendar red
        const isRedCalendarDay = dStr => {
            if (isWH(dStr)) return true;
            const t = parseDateT00(dStr).getTime();
            return SPECIAL_PERIODS.some(p => t >= p.start && t <= p.end);
        };

        // Determines which of the 3 matrices to apply
        const getSeasonProfile = dStr => {
            const d = parseDateT00(dStr), t = d.getTime(), m = d.getMonth();
            if (sysConfig.peakSeasonMonths.includes(m)) return 'peak';
            if (sysConfig.highSeasonMonths.includes(m) || SPECIAL_PERIODS.some(p => t >= p.start && t <= p.end)) return 'high';
            return 'low';
        };

        // Pure declarative logic: season -> daytype -> site
        const getDailyCapacity = (dStr, site) => {
            const isWe = isWH(dStr);
            if (site === 'Morra' && !isWe) return 0; // Forced strict rule
            return sysConfig.capacities[getSeasonProfile(dStr)][isWe ? 'weekend' : 'weekday'][site] || 0;
        };

        const getDailySites = dStr => isWH(dStr) ? SITES : ['Bajo de Dentro', 'Piles II', 'Piles I', 'Testa'];
        
        const CENTERS = {
            'B': { name: 'Balky', color: 'bg-[#ef4444]', text: 'text-white', pdfBg: '#ef4444', pdfText: '#ffffff' }, 
            'H': { name: 'Islas Hormigas', color: 'bg-[#0f172a]', text: 'text-white', pdfBg: '#000000', pdfText: '#ffffff' }, 
            'M': { name: 'Mangamar', color: 'bg-[#22c55e]', text: 'text-white', pdfBg: '#00b050', pdfText: '#ffffff' }, 
            'N': { name: 'Naranjito', color: 'bg-[#fbbf24]', text: 'text-slate-900', pdfBg: '#f59e0b', pdfText: '#000000' }, 
            'P': { name: 'Planeta Azul', color: 'bg-[#3b82f6]', text: 'text-white', pdfBg: '#3b82f6', pdfText: '#ffffff' }, 
            'D': { name: 'Divers', color: 'bg-[#6d28d9]', text: 'text-white', pdfBg: '#a855f7', pdfText: '#ffffff' }, 
            'C': { name: 'CLUB', color: 'bg-[#64748b]', text: 'text-white', pdfBg: '#64748b', pdfText: '#ffffff' }, 
            'X': { name: 'X La Manga', color: 'bg-[#cbd5e1]', text: 'text-slate-800', pdfBg: '#cbd5e1', pdfText: '#000000' } 
        };
        
        const DAYS_ES = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
        const MONTHS_ES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        const EMAIL_MAP = {
            'admin': 'admin@visor.local', 'mangamar': 'mangamar@visor.local', 'balky': 'balky@visor.local',
            'hormigas': 'hormigas@visor.local', 'naranjito': 'naranjito@visor.local', 'planeta': 'planeta@visor.local',
            'divers': 'divers@visor.local', 'club': 'club@visor.local', 'xlm': 'xlm@visor.local'
        };

        const USER_CENTER_KEYS = {
            'balky': 'B', 'hormigas': 'H', 'mangamar': 'M', 'naranjito': 'N',
            'planeta': 'P', 'divers': 'D', 'club': 'C', 'xlm': 'X'
        };

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

        let currentDate = new Date(2026, 2, 29); 
        let allocations = []; 
        let swapRequests = []; 
        let historyLogs = []; 
        let selectedCenters = Object.keys(CENTERS);
        let selectedHistoryMonth = 'all'; 
        let activeViewMode = 'diario';
        let statsUnit = 'plazas'; 
        let isGuestMode = false;
        let currentUserKey = 'guest';
        
        let historyCurrentPage = 1;
        let historyItemsPerPage = 20;

        /* =========================================================================
           WEBHOOK / WHATSAPP ROBOT CONFIGURATION
           ========================================================================= */
        const WHATSAPP_WEBHOOK_URL = "https://hook.eu1.make.com/nwgnqeiosbu73mtwljk7i252atthcuwd"; 

        async function sendSilentWebhook(msg) {
            if (!WHATSAPP_WEBHOOK_URL || !msg || msg.trim() === "") return;
            try {
                await fetch(WHATSAPP_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' }, 
                    body: JSON.stringify({ message: msg })
                });
            } catch(e) { console.error("Webhook Error:", e); }
        }

        /* =========================================================================
           2. FIREBASE SETUP & LISTENERS
           ========================================================================= */
        const firebaseConfig = {
            apiKey: "AIzaSyBe7X5AUC-PpcJSCYgMzyyUMJMPqxtTdiw",
            authDomain: "reserva-marina-cdp.firebaseapp.com",
            projectId: "reserva-marina-cdp",
            storageBucket: "reserva-marina-cdp.appspot.com",
            messagingSenderId: "242126338137",
            appId: "1:242126338137:web:c32d20d4697545a172d948"
        };
        firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const db = firebase.firestore();

        let unsubscribeSnapshot = null; let unsubscribeSwaps = null; let unsubscribeHistory = null; let unsubscribeConfig = null;

        function startFirestoreListener() {
            if (unsubscribeSnapshot) { unsubscribeSnapshot(); unsubscribeSnapshot = null; }
            if (unsubscribeSwaps) { unsubscribeSwaps(); unsubscribeSwaps = null; }
            if (unsubscribeHistory) { unsubscribeHistory(); unsubscribeHistory = null; }
            if (unsubscribeConfig) { unsubscribeConfig(); unsubscribeConfig = null; }

            // DB LISTENER WITH AUTO-PATCHING
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
                    // FORCE PATCH: Overwrite old ghost values if they exist in the DB
                    if (sysConfig.capacities.peak.weekend['Piles II'] === 50) {
                        sysConfig.capacities.peak.weekend = { ...DEFAULT_CAPS.capacities.peak.weekend };
                    }
                } else {
                    sysConfig = JSON.parse(JSON.stringify(DEFAULT_CAPS));
                }
                renderAll();
            });

            unsubscribeSnapshot = db.collection("reservations_monthly").onSnapshot((snapshot) => {
                const dataFromCloud = [];
                snapshot.forEach((doc) => {
                    const monthData = doc.data().allocations || {};
                    for (const customDocId in monthData) dataFromCloud.push({ id: customDocId, ...monthData[customDocId] });
                });
                allocations = dataFromCloud;
                renderAll();
            });

            unsubscribeSwaps = db.collection("swaps").onSnapshot((snapshot) => {
                const swapsFromCloud = [];
                snapshot.forEach(doc => { swapsFromCloud.push({ id: doc.id, ...doc.data() }); });
                swapRequests = swapsFromCloud;
                updateNotificationsMenu();
                renderAll(); 
            });

            unsubscribeHistory = db.collection("history_logs").onSnapshot((snapshot) => {
                const historyFromCloud = [];
                snapshot.forEach(doc => { historyFromCloud.push({ id: doc.id, ...doc.data() }); });
                historyLogs = historyFromCloud;
                if (activeViewMode === 'historial') renderHistory();
            });
        }

        /* =========================================================================
           3. AUTHENTICATION & UI MENU
           ========================================================================= */
        function openLoginModal() { showEl('password-modal'); }
        function closeLoginModal() { hideEl('password-modal'); }
        function openHelpModal() { showEl('help-modal'); }

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

        function verifyLogin() {
            const userKey = getEl('login-user').value;
            const password = getEl('login-password').value;
            auth.signInWithEmailAndPassword(EMAIL_MAP[userKey], password)
                .then(() => {
                    hideEl('password-modal'); hideEl('password-error'); getEl('login-password').value = ''; 
                })
                .catch(() => showEl('password-error'));
        }

        function logout() { auth.signOut(); }
        function toggleUserMenu() { toggleVis('user-dropdown'); }
        
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

        function buildUserMenu() {
            let html = '';
            const myCode = USER_CENTER_KEYS[currentUserKey];
            const pendingForMe = swapRequests.filter(s => s.targetCenter === myCode);
            
            if (pendingForMe.length > 0 && !isGuestMode && currentUserKey !== 'admin') {
                html += `<button onclick="openNotificationsModal(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-between"><div class="flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg> Notificaciones</div> <span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full">${pendingForMe.length}</span></button><div class="h-px bg-slate-100 my-1"></div>`;
            }
            if (currentUserKey === 'admin') {
                html += `<button onclick="openConfigWizard(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Configurar Cupos</button>`;
                html += `<button onclick="triggerImport(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg> Importar CSV</button>`;
                html += `<button onclick="promptEmptyData(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"><svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Vaciar Datos</button><div class="h-px bg-slate-100 my-1"></div>`;
            }
            html += `<button onclick="logout(); toggleUserMenu();" class="text-left px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors flex items-center gap-2">Cerrar sesión</button>`;
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
           9. WIZARD CONFIGURATION LOGIC (3-TIER DRY SYSTEM)
           ========================================================================= */
        function renderWizardTables() {
            SEASONS.forEach(season => {
                const container = getEl(`wizard-${season}-table`);
                if(!container) return;
                
                container.innerHTML = `
                <div class="grid grid-cols-[1fr_1fr_1fr] gap-2 mb-3 px-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    <div class="text-left">Punto</div><div>Finde/Fest.</div><div>Diario</div>
                </div>
                ${SITES.map(s => {
                    const isM = s === 'Morra';
                    const cName = s === 'Bajo de Dentro' ? 'Dentro' : s;
                    const weVal = sysConfig.capacities[season].weekend[s];
                    const wdVal = isM ? 0 : sysConfig.capacities[season].weekday[s];
                    return `
                    <div class="grid grid-cols-[1fr_1fr_1fr] gap-2 items-center mb-2 bg-white p-2 rounded border border-slate-100 text-center shadow-sm">
                        <div class="text-xs font-bold text-slate-700 text-left">${cName}</div>
                        <input type="number" id="cap-${season}-we-${s}" value="${weVal}" class="w-full text-center p-1.5 border border-slate-200 rounded bg-slate-50 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none" min="0">
                        <input type="number" id="cap-${season}-wd-${s}" value="${wdVal}" class="w-full text-center p-1.5 border border-slate-200 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none ${isM ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-50'}" min="0" ${isM ? 'disabled title="Cerrado en diario"' : ''}>
                    </div>`;
                }).join('')}`;
            });
        }

        function openConfigWizard() {
            renderWizardTables();
            showEl('config-wizard-modal');
        }

        async function saveConfigWizard() {
            const btn = getEl('btn-save-config');
            btn.innerHTML = 'Guardando...'; btn.disabled = true;

            const newCaps = { peak: { weekend: {}, weekday: {} }, high: { weekend: {}, weekday: {} }, low: { weekend: {}, weekday: {} } };

            SEASONS.forEach(season => {
                SITES.forEach(s => {
                    newCaps[season].weekend[s] = parseInt(getEl(`cap-${season}-we-${s}`).value) || 0;
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
                btn.innerHTML = 'Guardar Plazas'; btn.disabled = false;
            }
        }

        /* =========================================================================
           4. UTILITIES & UI CONTROLLERS
           ========================================================================= */
        function getMonday(d) { d = new Date(d); var day = d.getDay(), diff = d.getDate() - day + (day === 0 ? -6 : 1); return new Date(d.setDate(diff)); }
        function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7); }
        function getDateOfISOWeek(w, y) { var simple = new Date(y, 0, 1 + (w - 1) * 7); var ISOweekStart = simple; if (simple.getDay() <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1); else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay()); return ISOweekStart; }
        
        function generateId(date, time, site, center, subslot) {
            return `${date.replace(/[^0-9-]/g, '')}_${time.replace(/[^0-9]/g, '')}_${site.replace(/[^a-zA-Z0-9]/g, '')}_${center.replace(/[^a-zA-Z0-9]/g, '')}_${subslot}`;
        }
        function normalizeCSVDate(dateStr) { let p; if (dateStr.includes('/')) p = dateStr.split('/'); else if (dateStr.includes('-')) p = dateStr.split('-'); else return dateStr.replace(/[^0-9-]/g, '-'); if (p.length === 3) { if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`; else return `${p[2].length === 2 ? '20'+p[2] : p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`; } return dateStr.replace(/[^0-9-]/g, '-'); }
        function normalizeCSVTime(timeStr) { let p = timeStr.split(':'); if(p.length >= 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}`; return timeStr; }

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
            if (histWrap) { histWrap.classList.toggle('hidden', v !== 'historial'); histWrap.classList.toggle('flex', v === 'historial'); }

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

        function setStatsUnit(unit) { statsUnit = unit; const udTxt = getEl('unit-dropdown-text'); if(udTxt) udTxt.textContent = unit === 'barcos' ? 'Barcos (Salidas)' : 'Plazas (Buceadores)'; renderStats(); }

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
            let mH = ''; for(let i=0; i<12; i++) mH += `<option value="${i}">${MONTHS_ES[i]} 2026</option>`;
            
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
        }

        function toggleCenter(k) { selectedCenters = selectedCenters.includes(k) ? selectedCenters.filter(x => x !== k) : [...selectedCenters, k]; historyCurrentPage = 1; initFilters(); renderAll(); }
        function setAllFilters(s) { selectedCenters = s ? Object.keys(CENTERS) : []; historyCurrentPage = 1; initFilters(); renderAll(); }
        function changeMonth(i) { currentDate.setMonth(parseInt(i)); currentDate.setDate(1); renderAll(); }
        function changeWeek(n) { currentDate = getDateOfISOWeek(parseInt(n), 2026); renderAll(); }
        function setDate(s) { const p = s.split('-'); currentDate = new Date(p[0], p[1]-1, p[2]); renderAll(); }
        function toggleFilterDropdown() { toggleVis('filter-dropdown-panel'); }
        function toggleMonthDropdown() { toggleVis('month-dropdown-panel'); }
        function selectHistoryMonth(val, text) {
            selectedHistoryMonth = val;
            historyCurrentPage = 1;
            const mfBtn = getEl('month-filter-button-text');
            if (mfBtn) mfBtn.textContent = text;
            hideEl('month-dropdown-panel');
            initSelectors(); renderHistory();
        }

        /* =========================================================================
           5. HISTORY LOGGER & PAGINATION
           ========================================================================= */
        async function logHistory(actionType, details) {
            if (currentUserKey === 'admin' || isGuestMode) return; 
            try {
                await db.collection("history_logs").add({ actionType, centerKey: currentUserKey, details, timestamp: firebase.firestore.FieldValue.serverTimestamp() });
            } catch (e) { console.error("Error writing to history log:", e); }
        }

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

                if (log.actionType === 'swap') {
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

        /* =========================================================================
           6. NOTIFICATIONS & DATA OPS
           ========================================================================= */
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
            titleEl.textContent = title; getEl('notification-message').textContent = message; showEl('notification-modal');
        }

        function closeNotification() { hideEl('notification-modal'); }
        function triggerImport() { getEl('csv-upload').click(); }

        function handleImport(e) {
            const f = e.target.files[0]; if(!f) return;
            const btn = getEl('user-badge-button'); const originalBtnHtml = btn.innerHTML;
            btn.innerHTML = `<svg class="animate-spin h-3 w-3 mr-1 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="tracking-wide">Cargando CSV...</span>`;
            
            const r = new FileReader();
            r.onload = async (ev) => {
                const rs = ev.target.result.split('\n'), loaded = [];
                const safeCenterMap = {}; Object.keys(CENTERS).forEach(k => safeCenterMap[CENTERS[k].name.toUpperCase()] = k);
                const slotTracker = {}; 

                for(let i=1; i<rs.length; i++) {
                    if(!rs[i].trim()) continue;
                    let c = rs[i].split(','); if (c.length < 5) c = rs[i].split(';'); if (c.length < 5) c = rs[i].split('\t'); if (c.length < 5) continue;
                    
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

                    const normalizedDate = normalizeCSVDate(rawDate), normalizedTime = normalizeCSVTime(rawTime), cKey = safeCenterMap[centerName];

                    if(cKey && !isNaN(pax)) {
                        const trackKey = `${normalizedDate}-${normalizedTime}-${site}`;
                        if (!slotTracker[trackKey]) slotTracker[trackKey] = 1; else slotTracker[trackKey]++;
                        loaded.push({ date: normalizedDate, center: cKey, site: site, time: normalizedTime, pax: pax, subslot: slotTracker[trackKey] });
                    }
                }
                
                if(loaded.length) { 
                    try {
                        const monthlyData = {};
                        loaded.forEach((item) => {
                            const monthKey = item.date.substring(0, 7);
                            if (!monthlyData[monthKey]) monthlyData[monthKey] = {};
                            monthlyData[monthKey][generateId(item.date, item.time, item.site, item.center, item.subslot)] = item;
                        });
                        
                        const batch = db.batch();
                        for (const [month, dataMap] of Object.entries(monthlyData)) batch.set(db.collection("reservations_monthly").doc(month), { allocations: dataMap }, { merge: true });
                        await batch.commit();
                        showNotification('Importación Exitosa', `Se ha procesado y guardado la planificación completa (${loaded.length} reservas).`); 
                        if(loaded[0] && loaded[0].date) setDate(loaded[0].date);
                    } catch(err) {
                        showNotification('Error', 'Hubo un problema de red al guardar en la nube.', true);
                    } finally { btn.innerHTML = originalBtnHtml; }
                } else {
                    showNotification('Error de Formato', 'No se encontraron datos válidos. Comprueba el archivo.', true); btn.innerHTML = originalBtnHtml;
                }
            };
            r.readAsText(f); e.target.value = '';
        }

        /* =========================================================================
           7. EXPORT & BACKUP FUNCTIONALITY (CSV & TRUE-VECTOR PDF)
           ========================================================================= */
        function selectExportFormat(format) {
            getEl('export-format').value = format;
            const btnPdf = getEl('btn-format-pdf'), btnCsv = getEl('btn-format-csv');
            btnPdf.className = `flex-1 py-2 px-3 border-2 rounded-lg font-bold text-sm transition-colors ${format === 'pdf' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
            btnCsv.className = `flex-1 py-2 px-3 border-2 rounded-lg font-bold text-sm transition-colors ${format === 'csv' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`;
        }

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

        function closePrintModal() { hideEl('print-modal'); }

        function executeExport() {
            const format = getEl('export-format').value;
            if (format === 'pdf') executePrintPDF(); else executePrintCSV();
        }

        function executePrintCSV() {
            const monthVal = getEl('print-month').value, centerVal = getEl('print-center').value;
            let targetCenters = centerVal === 'all' ? Object.keys(CENTERS) : [centerVal];
            let filtered = allocations.filter(a => targetCenters.includes(a.center));
            if (monthVal !== 'all') filtered = filtered.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === parseInt(monthVal, 10));

            if (filtered.length === 0) { showNotification('Sin Datos', 'No hay reservas para los filtros seleccionados.', true); closePrintModal(); return; }

            try {
                let csv = "Fecha,Centro,Punto,Hora,Plazas\n";
                filtered.sort((a, b) => a.date !== b.date ? a.date.localeCompare(b.date) : a.time.localeCompare(b.time));
                filtered.forEach(a => { csv += `${a.date},${CENTERS[a.center] ? CENTERS[a.center].name : a.center},${a.site},${a.time},${a.pax}\n`; });
                const l = document.createElement("a"); 
                l.setAttribute("href", "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv)); 
                l.setAttribute("download", `Planificacion_${centerVal}_${monthVal}.csv`); 
                document.body.appendChild(l);
                l.click(); 
                document.body.removeChild(l);
                closePrintModal();
            } catch (error) { showNotification('Error', 'Hubo un problema al exportar el CSV.', true); }
        }

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
            } catch(e) { console.error("Error creating full backup CSV:", e); }
        }

        function executePrintPDF() {
            const monthVal = getEl('print-month').value, centerVal = getEl('print-center').value;
            let targetCenters = centerVal === 'all' ? Object.keys(CENTERS) : [centerVal];
            let filtered = allocations.filter(a => targetCenters.includes(a.center));
            if (monthVal !== 'all') filtered = filtered.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === parseInt(monthVal, 10));

            if (filtered.length === 0) { showNotification('Sin Datos', 'No hay reservas para los filtros seleccionados.', true); closePrintModal(); return; }

            const byDate = {};
            filtered.forEach(a => { if (!byDate[a.date]) byDate[a.date] = []; byDate[a.date].push(a); });
            const sortedDates = Object.keys(byDate).sort();

            closePrintModal();
            showNotification('Generando PDF Vectorial', 'Por favor, espera mientras se dibuja el documento...', false);

            setTimeout(() => {
                try {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF('p', 'pt', 'a4');
                    const startX = 40; let currentY = 40; 

                    for (let i = 0; i < sortedDates.length; i++) {
                        const date = sortedDates[i];
                        const dateItems = byDate[date] || [];
                        const centerDailyPax = {}; let totalDailyPax = 0;
                        
                        dateItems.forEach(item => {
                            if(!centerDailyPax[item.center]) centerDailyPax[item.center] = 0;
                            centerDailyPax[item.center] += item.pax;
                            totalDailyPax += item.pax;
                        });

                        if (i > 0 && i % 3 === 0) { doc.addPage(); currentY = 40; }
                        drawDayBlock(doc, date, dateItems, centerDailyPax, totalDailyPax, startX, currentY);
                        currentY += 230; 
                    }

                    doc.save(`Planificacion_${centerVal}_${monthVal}.pdf`);
                    closeNotification();
                } catch (err) {
                    console.error("PDF Generation Error: ", err);
                    showNotification('Error', 'Hubo un problema al generar el PDF.', true);
                }
            }, 100); 
        }

        function drawDayBlock(doc, dateStr, dateItems, centerDailyPax, totalDailyPax, startX, startY) {
            const dObj = parseDateT00(dateStr), dayName = DAYS_ES[dObj.getDay()].substring(0,3).toUpperCase();
            const dateTitle = `${dayName}. ${dObj.getDate()}-${MONTHS_SHORT[dObj.getMonth()].toUpperCase()}`;
            const timeLabels = ['09:00 - 10:30', '10:30 - 12:00', '12:00 - 13:30', '13:30 - 15:00', '15:00 - 16:30', '16:30 - 18:00', '18:00 - 19:00'];
            const timeKeys = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00'];

            let siteColumnTotals = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0 };
            dateItems.forEach(it => { if (siteColumnTotals[it.site] !== undefined) siteColumnTotals[it.site] += it.pax; });

            const colorPink = '#f20884', colorYellow = '#ffff00', colorLightGray = '#f8fafc';
            const rowH = 14, subH = 12, restH = 12;

            const drawBox = (x, y, w, h, bg, text, textColor, fontStyle, fontSize) => {
                if (bg) { doc.setFillColor(bg); doc.rect(x, y, w, h, 'F'); }
                doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.rect(x, y, w, h, 'S');
                if (text !== undefined && text !== null && text !== '') {
                    doc.setTextColor(textColor); doc.setFont('helvetica', fontStyle); doc.setFontSize(fontSize);
                    doc.text(text.toString(), x + (w / 2), y + (h / 2) + (fontSize * 0.35), { align: 'center' });
                }
            };

            let currentY = startY;

            const dayTotalCap = SITES.reduce((sum, s) => sum + getDailyCapacity(dateStr, s), 0);

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
            SITES.forEach(s => {
                const cap = getDailyCapacity(dateStr, s);
                drawBox(currentX, currentY, 36, rowH, colorPink, cap, '#000', 'bold', 8); 
                drawBox(currentX + 36, currentY, 36, rowH, colorPink, siteColumnTotals[s], '#000', 'bold', 8); 
                currentX += 72;
            });
            currentY += rowH;

            timeKeys.forEach((tm, idx) => {
                if (tm === '13:30') {
                    drawBox(startX, currentY, 55, restH, '#e2e8f0', timeLabels[idx], '#000', 'normal', 7); 
                    drawBox(startX + 55, currentY, 25, restH, colorYellow, '', '#000', 'normal', 7);
                    drawBox(startX + 80, currentY, 360, restH, '#000000', '', '#fff', 'normal', 7);
                    currentY += restH; return;
                }

                const timeRowH = subH * 2; 
                drawBox(startX, currentY, 55, timeRowH, colorLightGray, timeLabels[idx], '#000', 'normal', 7); 
                drawBox(startX + 55, currentY, 25, timeRowH, colorYellow, '', '#000', 'normal', 7);

                currentX = startX + 80;
                SITES.forEach(s => {
                    const items = dateItems.filter(i => i.time === tm && i.site === s);
                    let it1 = items.find(i => i.subslot === 1) || items[0], it2 = items.find(i => i.subslot === 2) || (items.length > 1 ? items[1] : null);
                    if(items.length === 1) { it1 = items[0]; it2 = null; }

                    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.rect(currentX, currentY, 72, timeRowH, 'S');

                    const drawSub = (it, subY) => {
                        if (!it) return;
                        const cInfo = CENTERS[it.center];
                        doc.setFillColor(cInfo.pdfBg); doc.rect(currentX, subY, 28, subH, 'F');
                        doc.setDrawColor(0); doc.line(currentX + 28, subY, currentX + 28, subY + subH);
                        doc.setTextColor(cInfo.pdfText); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
                        doc.text(it.center, currentX + 14, subY + (subH / 2) + (8 * 0.35), { align: 'center' });
                        doc.setTextColor('#000'); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                        doc.text(it.pax.toString(), currentX + 50, subY + (subH / 2) + (8 * 0.35), { align: 'center' });
                    };

                    drawSub(it1, currentY); drawSub(it2, currentY + subH);
                    currentX += 72;
                });
                currentY += timeRowH;
            });

            drawBox(startX, currentY, 80, rowH, colorYellow, '', '#000', 'bold', 8);
            currentX = startX + 80;
            SITES.forEach(s => {
                const cap = getDailyCapacity(dateStr, s);
                const diff = cap - siteColumnTotals[s];
                drawBox(currentX, currentY, 72, rowH, '#ffffff', cap === 0 ? '-' : (diff >= 0 ? `+${diff}` : diff.toString()), cap === 0 ? '#94a3b8' : (diff >= 0 ? '#2563eb' : '#dc2626'), 'normal', 8);
                currentX += 72;
            });

            const legendX = startX + 455; let legendY = startY;
            ['B', 'D', 'H', 'M', 'N', 'P', 'X', 'C'].forEach(k => {
                if(!CENTERS[k]) return; 
                const cInfo = CENTERS[k], paxCount = centerDailyPax[k] || 0; 
                drawBox(legendX, legendY, 25, subH, cInfo.pdfBg, k, cInfo.pdfText, 'bold', 8);
                drawBox(legendX + 25, legendY, 35, subH, '#ffffff', paxCount.toString(), '#000', 'normal', 8); 
                legendY += subH;
            });
            drawBox(legendX, legendY, 25, subH, '#94a3b8', '', '#fff', 'normal', 8);
            drawBox(legendX + 25, legendY, 35, subH, colorLightGray, totalDailyPax.toString(), '#000', 'normal', 8);
        }

        function promptEmptyData() {
            try { backupAllToCSV(); } catch(e) { console.error(e); }
            setTimeout(() => showEl('empty-confirm-modal'), 800);
        }

        async function executeEmptyData() {
            const btnConfirm = getEl('btn-confirm-empty'), btnCancel = getEl('btn-cancel-empty');
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
                hideEl('empty-confirm-modal'); showNotification('Error', 'Hubo un problema al vaciar los datos.', true);
            } finally {
                if(btnConfirm) { btnConfirm.textContent = "Sí, vaciar"; btnConfirm.disabled = false; }
                if(btnCancel) btnCancel.disabled = false;
            }
        }

        /* =========================================================================
           8. DRAG & DROP + SWAPS + DOUBLE CLICK (THE BRAIN)
           ========================================================================= */
        let draggedItemId = null, pendingDrop = null, pendingNewSalidaWA = null, pendingSwapIntent = null, isProcessingDrop = false; 
        let pendingSwapInit = null, pendingSwapTargets = [], pendingSwapIsAdmin = false, pendingNewSalida = null, pendingPartialSwap = null, pendingPartialMove = null;

        function cancelWhatsAppDrop() {
            hideEl('whatsapp-confirm-modal'); hideEl('swap-choice-modal'); hideEl('partial-action-modal');
            pendingDrop = null; pendingSwapIntent = null; pendingNewSalidaWA = null; isProcessingDrop = false; 
            pendingSwapInit = null; pendingSwapTargets = []; pendingSwapIsAdmin = false; pendingNewSalida = null; pendingPartialSwap = null; pendingPartialMove = null;
            renderAll(); 
        }

        async function confirmWhatsAppAction() {
            hideEl('whatsapp-confirm-modal'); getEl('btn-confirm-wa').disabled = true; 
            
            if (pendingDrop) {
                const drop = pendingDrop; pendingDrop = null; 
                await sendSilentWebhook(drop.msg); await executeDrop(drop.id, drop.item, drop.newTime, drop.newSite, drop.newSubslot);
                logHistory('move', { date: drop.item.date, oldTime: drop.item.time, oldSite: drop.item.site, newTime: drop.newTime, newSite: drop.newSite, pax: drop.item.pax });
            }
            else if (pendingSwapIntent) {
                const swap = pendingSwapIntent; pendingSwapIntent = null; 
                await sendSilentWebhook(swap.msg);
                try {
                    await db.collection("swaps").add({ initiatorId: swap.initId, targetId: swap.targetId, initiatorCenter: swap.initItem.center, targetCenter: swap.targetItem.center, initiatorData: swap.initItem, targetData: swap.targetItem, status: 'pending', timestamp: firebase.firestore.FieldValue.serverTimestamp() });
                    showNotification('Solicitud Enviada', 'La propuesta de intercambio ha sido enviada al otro centro.');
                } catch(e) { showNotification('Error', 'Hubo un fallo al solicitar el intercambio.', true); }
            }
            else if (pendingNewSalidaWA) {
                const newSalida = pendingNewSalidaWA; pendingNewSalidaWA = null; 
                await sendSilentWebhook(newSalida.msg); await executeNewSalida(newSalida.data, newSalida.pax, newSalida.centerKey);
                logHistory('add', { date: newSalida.data.date, time: newSalida.data.time, site: newSalida.data.site, pax: newSalida.pax });
            }
            getEl('btn-confirm-wa').disabled = false; isProcessingDrop = false;
        }

        async function executeDrop(id, item, newTime, newSite) {
            const monthKey = item.date.substring(0, 7); 
            try {
                const updates = {}; let finalSubslot = 1;
                const remainingOld = allocations.filter(a => a.date === item.date && a.time === item.time && a.site === item.site && String(a.id) !== String(id));
                if (remainingOld.length === 1 && remainingOld[0].subslot !== 1) updates[`allocations.${remainingOld[0].id}.subslot`] = 1;

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
            } catch(error) { showNotification('Error', 'No se pudo guardar en la nube.', true); }
        }

        async function performSwap(initId, initItem, targetId, targetItem, swapDocId = null) {
            const month1 = initItem.date.substring(0, 7), month2 = targetItem.date.substring(0, 7); 
            try {
                const batch = db.batch();
                if (month1 === month2) {
                    batch.update(db.collection("reservations_monthly").doc(month1), {
                        [`allocations.${initId}.time`]: targetItem.time, [`allocations.${initId}.site`]: targetItem.site, [`allocations.${initId}.subslot`]: targetItem.subslot || 1, [`allocations.${initId}.pax`]: initItem.pax,
                        [`allocations.${targetId}.time`]: initItem.time, [`allocations.${targetId}.site`]: initItem.site, [`allocations.${targetId}.subslot`]: initItem.subslot || 2, [`allocations.${targetId}.pax`]: targetItem.pax
                    });
                } else {
                    const new_iItem = { ...initItem, time: targetItem.time, site: targetItem.site, subslot: targetItem.subslot || 1 };
                    const new_tItem = { ...targetItem, time: initItem.time, site: initItem.site, subslot: initItem.subslot || 2 };
                    batch.update(db.collection("reservations_monthly").doc(month1), { [`allocations.${initId}`]: firebase.firestore.FieldValue.delete() });
                    batch.update(db.collection("reservations_monthly").doc(month2), { [`allocations.${targetId}`]: firebase.firestore.FieldValue.delete() });
                    batch.set(db.collection("reservations_monthly").doc(month2), { allocations: { [initId]: new_iItem } }, { merge: true });
                    batch.set(db.collection("reservations_monthly").doc(month1), { allocations: { [targetId]: new_tItem } }, { merge: true });
                }
                if (swapDocId) batch.delete(db.collection("swaps").doc(swapDocId));
                await batch.commit();
            } catch(e) { console.error(e); throw e; }
        }
        
        async function executeNewSalida(info, pax, userKeyChoice) {
            const { date, time, site } = info;
            const centerCode = USER_CENTER_KEYS[userKeyChoice] || USER_CENTER_KEYS[currentUserKey], monthKey = date.substring(0, 7);
            
            try {
                const updates = {}; let finalSubslot = 1;
                const existingInSlot = allocations.filter(a => a.date === date && a.time === time && a.site === site);
                if (existingInSlot.length === 1) {
                    finalSubslot = 2; 
                    if (existingInSlot[0].subslot !== 1) updates[`allocations.${existingInSlot[0].id}.subslot`] = 1; 
                }

                const uniqueId = `boat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
                const newItem = { date, time, site, center: centerCode, pax, subslot: finalSubslot };
                updates[`allocations.${uniqueId}`] = newItem;

                try { await db.collection("reservations_monthly").doc(monthKey).update(updates); } 
                catch(e) { await db.collection("reservations_monthly").doc(monthKey).set({ allocations: { [uniqueId]: newItem } }, { merge: true }); }
            } catch(e) { showNotification('Error', 'Hubo un problema guardando en la nube.', true); }
        }

        function openNotificationsModal() {
            const myCode = USER_CENTER_KEYS[currentUserKey], pendingForMe = swapRequests.filter(s => s.targetCenter === myCode);
            const listEl = getEl('notifications-list'); listEl.innerHTML = '';
            
            if (pendingForMe.length === 0) listEl.innerHTML = `<p class="text-sm text-slate-500 italic text-center py-6">No tienes solicitudes pendientes.</p>`;
            else {
                pendingForMe.forEach(req => {
                    const initName = CENTERS[req.initiatorCenter].name, d = parseDateT00(req.initiatorData.date);
                    const dStr = `${d.getDate()} de ${MONTHS_SHORT[d.getMonth()]}`;
                    
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

        async function rejectSwap(swapId) { try { await db.collection("swaps").doc(swapId).delete(); openNotificationsModal(); } catch(e) {} }

        async function acceptSwap(swapId) {
            const req = swapRequests.find(s => s.id === swapId); if (!req) return;
            hideEl('notifications-modal');

            // --- REAL-TIME CAPACITY CHECK ---
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
                const targetInfo = getCenterInfoSafe(req.targetData.center), initInfo = getCenterInfoSafe(req.initiatorCenter);
                const d = parseDateT00(liveInitItem.date);
                
                let paxNote = "";
                if (finalInitPax < desiredInitPax || finalTargetPax < desiredTargetPax) {
                    paxNote = `\n⚠️ Ajuste por cupo actual: ${initInfo.name} movió ${finalInitPax} pax. ${targetInfo.name} movió ${finalTargetPax} pax.`;
                }

                const msg = `🤖 *AVISO AUTOMÁTICO*\n✅ *INTERCAMBIO ACEPTADO* - ${initInfo.name} y ${targetInfo.name}\nPara el ${d.getDate()} de ${MONTHS_ES[d.getMonth()].toUpperCase()}, intercambiaron *${liveInitItem.site} (${liveInitItem.time})* (${finalInitPax} pax) por *${liveTargetItem.site} (${liveTargetItem.time})* (${finalTargetPax} pax).${paxNote}`;
                await sendSilentWebhook(msg);
                
                logHistory('swap', { date: liveInitItem.date, initCenter: req.initiatorCenter, initSite: liveInitItem.site, initTime: liveInitItem.time, initPax: finalInitPax, targetCenter: req.targetData.center, targetSite: liveTargetItem.site, targetTime: liveTargetItem.time, targetPax: finalTargetPax });
            } catch(e) { showNotification('Error', 'Hubo un fallo al realizar el intercambio.', true); }
        }
        
        function triggerSwapConfirmation(initId, initItem, targetId, targetItem) {
            const targetInfo = getCenterInfoSafe(targetItem.center), initInfo = getCenterInfoSafe(initItem.center);
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

        function showSwapChoiceModal(initId, initItem, targets, isAdmin = false) {
            pendingSwapInit = { initId, initItem }; pendingSwapTargets = targets; pendingSwapIsAdmin = isAdmin;
            const container = getEl('swap-choice-buttons'); container.innerHTML = '';
            
            targets.forEach(target => {
                const cInfo = CENTERS[target.center], btn = document.createElement('button');
                btn.className = `w-full px-4 py-4 rounded-xl text-sm font-bold shadow-sm border border-slate-200 hover:shadow-md transition-all flex items-center justify-between ${cInfo.color} ${cInfo.text}`;
                btn.innerHTML = `<span>${cInfo.name}</span> <span class="bg-black/20 px-2 py-1 rounded-md">${target.pax} Plazas</span>`;
                btn.onclick = () => selectSwapTarget(target.id);
                container.appendChild(btn);
            });
            showEl('swap-choice-modal');
        }

        function cancelPartialAction() {
            hideEl('partial-action-modal');
            pendingPartialSwap = null;
            pendingPartialMove = null;
            isProcessingDrop = false;
            renderAll();
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
            const { initId, initItem } = pendingSwapInit, isAdmin = pendingSwapIsAdmin;
            pendingSwapInit = null; pendingSwapTargets = []; pendingSwapIsAdmin = false;
            
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

        function executeProceedWithMove(id, item, newTime, newSite) {
            if (currentUserKey !== 'admin') {
                const d = parseDateT00(item.date), centerInfo = getCenterInfoSafe(item.center);
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

        document.addEventListener('dragstart', (e) => {
            if (isGuestMode || isProcessingDrop) { e.preventDefault(); return; } 
            const block = e.target.closest('.draggable-item');
            if (!block || block.getAttribute('draggable') !== 'true') { e.preventDefault(); return; }
            draggedItemId = block.dataset.dragId;
            try { e.dataTransfer.setData('text/plain', String(draggedItemId)); e.dataTransfer.effectAllowed = 'move'; } catch (err) { }
            setTimeout(() => block.classList.add('opacity-50'), 0);
        });

        document.addEventListener('dragend', (e) => {
            const block = e.target.closest('.draggable-item'); if (!block) return;
            draggedItemId = null; block.classList.remove('opacity-50');
            document.querySelectorAll('.dropzone').forEach(el => el.classList.remove('bg-blue-50', 'bg-purple-50'));
        });

        document.addEventListener('dragover', (e) => {
            if (isGuestMode || !draggedItemId || isProcessingDrop) return;
            e.preventDefault(); if(e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            document.querySelectorAll('.bg-blue-50, .bg-purple-50').forEach(el => { if (el !== e.target.closest('.dropzone')) el.classList.remove('bg-blue-50', 'bg-purple-50'); });

            const dropzone = e.target.closest('.dropzone'); if (!dropzone) return;
            const newTime = dropzone.dataset.time, newSite = dropzone.dataset.site, ds = getStrYMD(currentDate);
            const existing = allocations.filter(a => a.date === ds && a.time === newTime && a.site === newSite && String(a.id) !== String(draggedItemId));
            if (existing.length >= 2) dropzone.classList.add('bg-purple-50'); else dropzone.classList.add('bg-blue-50');
        });

        document.addEventListener('dragleave', (e) => {
            const dropzone = e.target.closest('.dropzone');
            if (dropzone && !dropzone.contains(e.relatedTarget)) dropzone.classList.remove('bg-blue-50', 'bg-purple-50');
        });

        document.addEventListener('drop', async (e) => {
            if (isGuestMode || isProcessingDrop) return;
            e.preventDefault(); document.querySelectorAll('.dropzone').forEach(el => el.classList.remove('bg-blue-50', 'bg-purple-50'));
            let id = draggedItemId; if (!id) return;

            const dropzone = e.target.closest('.dropzone'); if (!dropzone) return;
            const newTime = dropzone.dataset.time, newSite = dropzone.dataset.site;
            const initItem = allocations.find(a => String(a.id) === String(id)); if (!initItem) return;
            
            if (initItem.time === newTime && initItem.site === newSite) return;
            if (currentUserKey !== 'admin' && initItem.center !== USER_CENTER_KEYS[currentUserKey]) { showNotification('Acción Bloqueada', 'Solo puedes mover tus propias reservas.', true); return; }

            isProcessingDrop = true; 
            const existingItemsInSlot = allocations.filter(a => a.date === initItem.date && a.time === newTime && a.site === newSite && String(a.id) !== String(id));

            if (existingItemsInSlot.length < 2) {
                // Free Space logic
                const itemsInNewSiteToday = allocations.filter(a => a.date === initItem.date && a.site === newSite && String(a.id) !== String(id));
                const currentPaxNewSite = itemsInNewSiteToday.reduce((sum, a) => sum + a.pax, 0);
                const remainingCapacity = getDailyCapacity(initItem.date, newSite) - currentPaxNewSite;

                if (initItem.pax > remainingCapacity) {
                    if (remainingCapacity <= 0) {
                        showNotification('Cupo Lleno', `No puedes mover la salida aquí. El punto está lleno.`, true);
                        isProcessingDrop = false; return;
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
                // Swap logic (Slot is full)
                if (currentUserKey !== 'admin') {
                    const targets = existingItemsInSlot.filter(t => t.center !== initItem.center);
                    if (targets.length === 0) { showNotification('Acción Bloqueada', 'Ambos barcos en este horario son tuyos. No puedes hacer un intercambio.', true); isProcessingDrop = false; return; } 
                    
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

        function handleSlotDoubleClick(time, site) {
            if (isGuestMode || isProcessingDrop) return;

            const ds = getStrYMD(currentDate);
            const existingItemsInSlot = allocations.filter(a => a.date === ds && a.time === time && a.site === site);
            if (existingItemsInSlot.length >= 2) { showNotification('Horario Completo', 'Ya hay 2 barcos asignados en este horario.', true); return; }

            const itemsInSiteToday = allocations.filter(a => a.date === ds && a.site === site);
            const currentPax = itemsInSiteToday.reduce((sum, a) => sum + a.pax, 0);
            const remainingCapacity = getDailyCapacity(ds, site) - currentPax;

            if (remainingCapacity <= 0) { showNotification('Cupo Lleno', 'No quedan plazas disponibles para este punto de buceo hoy.', true); return; }
            const allowedMax = Math.min(11, remainingCapacity);

            pendingNewSalida = { date: ds, time, site, maxPax: remainingCapacity };
            getEl('new-salida-title').textContent = `${site} a las ${time}`;
            getEl('new-salida-avail').textContent = `Plazas disponibles en el punto: ${remainingCapacity} (Máx por barco: ${allowedMax})`;
            
            const paxInput = getEl('new-salida-pax'); paxInput.value = ''; paxInput.max = allowedMax;
            
            const centerSelector = getEl('new-salida-center-container');
            if (centerSelector) centerSelector.classList.toggle('hidden', currentUserKey !== 'admin');
            
            showEl('new-salida-modal');
        }

        function cancelNewSalida() { hideEl('new-salida-modal'); pendingNewSalida = null; }

        async function confirmNewSalida() {
            const pax = parseInt(getEl('new-salida-pax').value, 10), allowedMax = Math.min(11, pendingNewSalida.maxPax);
            if (!pax || isNaN(pax) || pax <= 0) { showNotification('Error', 'Introduce un número válido.', true); return; }
            if (pax > allowedMax) { showNotification('Límite excedido', `El máximo permitido es ${allowedMax} plazas.`, true); return; }

            hideEl('new-salida-modal');
            
            if (currentUserKey === 'admin') {
                await executeNewSalida(pendingNewSalida, pax, getEl('new-salida-center').value);
            } else {
                const { date, time, site } = pendingNewSalida, dObj = parseDateT00(date), centerInfo = getCenterInfoSafe(currentUserKey);
                const msg = `🤖 *AVISO AUTOMÁTICO*\n➕ *NUEVA SALIDA* - ${centerInfo.name}\nPara el ${dObj.getDate()} de ${MONTHS_ES[dObj.getMonth()].toUpperCase()}, añadió una salida a *${site} (${time})* de ${pax} plazas.`;
                pendingNewSalidaWA = { data: pendingNewSalida, pax: pax, centerKey: currentUserKey, msg: msg };
                getEl('wa-action-type').textContent = "Nueva Salida"; getEl('confirm-whatsapp-msg').innerText = msg; showEl('whatsapp-confirm-modal');
            }
        }

        /* =========================================================================
           10. RENDER LOGIC: DIARIO & MEGA & STATS
           ========================================================================= */
        function renderDaily() {
            if(activeViewMode !== 'diario') return;
            const ds = getStrYMD(currentDate);
            const activeSites = getDailySites(ds);
            
            getEl('daily-date-header').textContent = `${DAYS_ES[currentDate.getDay()]}, ${currentDate.getDate()} DE ${MONTHS_ES[currentDate.getMonth()]} DE ${currentDate.getFullYear()}`;
            
            let maxDailyCap = activeSites.reduce((sum, s) => sum + getDailyCapacity(ds, s), 0);
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

                        return `<div ${dragAttrs} class="boat-block w-full h-[34px] rounded-[4px] px-2 py-1.5 flex justify-between items-center text-[10px] font-bold shadow-sm ${c.color} ${c.text} ${ghostClass} ${cursorClass}">
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
            const isBarcos = statsUnit === 'barcos', filteredAllocations = allocations.filter(a => selectedCenters.includes(a.center));
            const cStats = {}, gTot = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 };
            
            Object.keys(CENTERS).forEach(k => { cStats[k] = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 }; });
            filteredAllocations.forEach(a => { const val = isBarcos ? 1 : a.pax; cStats[a.center][a.site] += val; cStats[a.center].total += val; gTot[a.site] += val; gTot.total += val; });

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
            const mGrid = getEl('stats-monthly-grid'); mGrid.innerHTML = '';
            
            for(let m = 0; m < 12; m++) {
                const mAlloc = filteredAllocations.filter(a => parseInt(a.date.split('-')[1], 10) - 1 === m);
                if (mAlloc.length === 0) continue; 
                
                const mStats = {}; Object.keys(CENTERS).forEach(k => mStats[k] = { 'Bajo de Dentro': 0, 'Piles II': 0, 'Piles I': 0, 'Testa': 0, 'Morra': 0, total: 0 });
                mAlloc.forEach(a => { const val = isBarcos ? 1 : a.pax; mStats[a.center][a.site] += val; mStats[a.center].total += val; });

                let cHtml = `<div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5 md:p-7 hover:shadow-md transition-shadow"><div class="flex justify-between items-center mb-4 border-b border-slate-100 pb-3"><h4 class="font-black italic text-lg md:text-xl uppercase tracking-tight text-slate-900">${MONTHS_ES[m]} 2026</h4><span class="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded tracking-widest uppercase border border-emerald-100">${statsUnit}</span></div><div class="overflow-x-auto"><table class="w-full text-left text-xs min-w-[400px]"><thead><tr class="text-slate-400 uppercase tracking-widest border-b-2 border-slate-100 text-[9px]"><th class="pb-2 font-bold">Centro</th><th class="pb-2 text-center">Bajo</th><th class="pb-2 text-center">Piles</th><th class="pb-2 text-center">Piles</th><th class="pb-2 text-center">Testa</th><th class="pb-2 text-center">Morra</th><th class="pb-2 text-center font-black text-slate-800 bg-slate-50 px-2 rounded-t-lg">Total</th></tr></thead><tbody>`;
                Object.keys(CENTERS).forEach(k => {
                    const st = mStats[k]; if(st.total === 0) return; const c = CENTERS[k];
                    cHtml += `<tr class="border-b border-slate-50 hover:bg-slate-50/50"><td class="py-2.5 font-bold flex items-center gap-2 text-slate-700 text-[10px]"><span class="w-3.5 h-3.5 rounded-sm ${c.color} ${c.text} flex items-center justify-center text-[7px] font-black">${k}</span> ${c.name}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Bajo de Dentro'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Piles II'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Piles I'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Testa'].toLocaleString('en-US')}</td><td class="py-2.5 text-center text-slate-600 font-medium">${st['Morra'].toLocaleString('en-US')}</td><td class="py-2.5 text-center font-black text-slate-900 bg-slate-50 px-2">${st.total.toLocaleString('en-US')}</td></tr>`;
                });
                cHtml += `</tbody></table></div></div>`;
                mGrid.innerHTML += cHtml;
            }
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

        function renderAll() { renderCalendar(); renderDaily(); renderMega(); renderStats(); renderHistory(); }

        /* =========================================================================
           11. INITIALIZATION EXECUTION
           ========================================================================= */
        document.addEventListener('DOMContentLoaded', () => {
            initSelectors(); 
            initFilters(); 
            renderAll();
        });