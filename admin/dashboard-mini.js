/*
 * ===================================================================
 * Client-Side Analytics Engine (Full Enterprise Version)
 * ===================================================================
 * هذا الملف هو المحرك الرئيسي للوحة التحكم.
 * المبدأ: (Addition NOT Replacement) - توسيع الوظائف الحالية.
 *
 * يغطي:
 * 1. المؤشرات المالية (Revenue, Trends) - [موجود ومحسن]
 * 2. المعاملات (Transactions, Funnel) - [موجود ومحسن]
 * 3. التسويق والديموغرافيا (Campaigns, Experience) - [تم الإصلاح والتفعيل]
 * 4. إدارة الجدول والبيانات - [موجود]
 */

class AdminDashboard {
    constructor() {
        // مخازن البيانات
        this.allData = [];
        this.filteredData = [];

        // إعدادات الجدول
        this.currentPage = 1;
        this.itemsPerPage = 20;

        // مخزن الشارتات (لتدميرها قبل إعادة الرسم لمنع التداخل)
        this.charts = {
            trend: null,
            payment: null,
            funnel: null,
            language: null,
            experience: null, // (تمت الإضافة: شارت الخبرة)
            qualification: null
        };

        if (!window.APP_CONFIG || !window.APP_CONFIG.API_BASE_URL) {
            console.error('CRITICAL ERROR: window.APP_CONFIG.API_BASE_URL is missing.');
            document.body.innerHTML = '<div style="color:red; text-align:center; padding:50px; font-family:sans-serif;">System Configuration Error: Missing API Base URL.</div>';
            throw new Error('Missing API_BASE_URL');
        }
        this.API_URL = window.APP_CONFIG.API_BASE_URL + '/api/admin';
        // Dermossence: no product lookup needed

        this.init();
    }

    // ============================================================
    // (NEW) Helper: Escape HTML to prevent XSS
    // ============================================================
    escapeHtml(text) {
        if (!text) return text;
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // ============================================================
    // (NEW) نافذة تأكيد مخصصة بديلة لـ window.confirm
    // ============================================================
    showCustomConfirm(message, onConfirmCallback) {
        const act = `
        <button id="conf-cancel" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700 transition">إلغاء</button>
        <button id="conf-ok" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition shadow font-bold">نعم، متأكد</button>
        `;

        // نستخدم createModal الموجودة لدينا
        const m = this.createModal('تأكيد الإجراء', `<p class="text-slate-300 text-sm font-bold p-2">${this.escapeHtml(message)}</p>`, act);

        // برمجة زر الإلغاء
        m.querySelector('#conf-cancel').onclick = () => m.remove();

        // برمجة زر الموافقة
        m.querySelector('#conf-ok').onclick = () => {
            m.remove(); // نغلق النافذة أولاً
            onConfirmCallback(); // ثم ننفذ الكود المطلوب
        };
    }

    // ============================================================
    // (NEW) نظام الإشعارات المخصص (Toast Notifications)
    // ============================================================
    showNotification(message, type = 'success') {
        // 1. إنشاء الحاوية إذا لم تكن موجودة
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            // تنسيق الحاوية: ثابتة في الأعلى، وتظهر فوق كل شيء (Z-Index عالي)
            container.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none';
            document.body.appendChild(container);
        }



        // 2. تحديد الألوان والأيقونة حسب النوع
        const styles = {
            success: { bg: 'bg-emerald-900/20', border: 'border-emerald-500/50', text: 'text-emerald-400', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>' },
            error: { bg: 'bg-red-900/20', border: 'border-red-500/50', text: 'text-red-400', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
            info: { bg: 'bg-blue-900/20', border: 'border-blue-500/50', text: 'text-blue-400', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' }
        };
        const style = styles[type] || styles.info;

        // 3. إنشاء عنصر الإشعار
        const notif = document.createElement('div');
        notif.className = `${style.bg} ${style.border} ${style.text} border-r-4 p-4 rounded-lg shadow-xl flex items-center justify-between pointer-events-auto transform transition-all duration-500 translate-y-[-20px] opacity-0`;
        notif.setAttribute('dir', 'rtl');

        notif.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-1 rounded-full bg-slate-900 bg-opacity-50">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${style.icon}</svg>
                </div>
                <span class="font-bold text-sm">${this.escapeHtml(message)}</span>
            </div>
            <button onclick="this.parentElement.remove()" class="text-slate-500 hover:text-slate-300 transition-colors mr-4">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        `;

        // 4. الإضافة والتحريك
        container.appendChild(notif);

        // تفعيل الأنيميشن (الظهور)
        requestAnimationFrame(() => {
            notif.classList.remove('translate-y-[-20px]', 'opacity-0');
        });

        // 5. الإخفاء التلقائي بعد 4 ثوانٍ
        setTimeout(() => {
            if (notif.parentElement) {
                notif.classList.add('opacity-0', 'translate-y-[-20px]');
                setTimeout(() => notif.remove(), 500); // حذف العنصر بعد انتهاء الأنيميشن
            }
        }, 4000);
    }

    // ============================================================
    // (NEW) Popover system for compact table rows
    // ============================================================
    showPopover(event, element) {
        event.stopPropagation();
        const title = element.dataset.popoverTitle || '';
        const content = element.dataset.popoverContent || '';
        
        let popover = document.getElementById('global-popover');
        if (!popover) {
            popover = document.createElement('div');
            popover.id = 'global-popover';
            popover.className = 'fixed z-[9999] bg-slate-800 border border-slate-700 rounded shadow-2xl overflow-hidden flex-col w-[320px] max-w-[90vw] text-left';
            popover.style.display = 'none';
            // RTL is default on body, we explicitly set RTL if needed, but let's inherit body dir which is RTL.
            // But content should probably preserve its natural direction. 
            popover.innerHTML = `
                <div class="bg-slate-900/80 px-3 py-2 border-b border-slate-700/80 font-bold text-xs tracking-wider text-slate-300 popover-title flex items-center justify-between">
                    <span class="title-text"></span>
                    <button class="text-slate-500 hover:text-slate-300 transition-colors popover-close outline-none">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div class="p-3 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto popover-content text-right" dir="auto"></div>
            `;
            document.body.appendChild(popover);
            
            // Close on click outside
            document.addEventListener('click', (e) => {
                if (popover.style.display !== 'none' && !popover.contains(e.target)) {
                    popover.style.display = 'none';
                }
            });
            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && popover.style.display !== 'none') {
                    popover.style.display = 'none';
                }
            });
            // Close button
            popover.querySelector('.popover-close').onclick = () => {
                popover.style.display = 'none';
            };
        }

        const titleEl = popover.querySelector('.title-text');
        const contentEl = popover.querySelector('.popover-content');
        
        // Toggle if clicking the same trigger
        if (popover.style.display !== 'none' && popover.dataset.triggerId === title + content.substring(0,20)) {
            popover.style.display = 'none';
            return;
        }

        titleEl.innerHTML = title;
        // Use textContent or HTML. We escaped it so innerHTML is safe and allows &quot; etc to render.
        contentEl.innerHTML = content;
        popover.dataset.triggerId = title + content.substring(0,20);
        popover.style.display = 'flex';

        // Positioning logic
        const rect = element.getBoundingClientRect();
        const popRect = popover.getBoundingClientRect();
        
        let top = rect.bottom + 8;
        let left = rect.left; // in RTL left might be small if element is on the right
        
        if (left + popRect.width > window.innerWidth) {
            left = window.innerWidth - popRect.width - 16;
        }
        if (top + popRect.height > window.innerHeight) {
            top = rect.top - popRect.height - 8;
            if (top < 0) {
                top = 16;
            }
        }
        
        popover.style.top = top + 'px';
        popover.style.left = Math.max(16, left) + 'px';
    }

    // ============================================================
    // (NEW) Helper: Show Dashboard Alert (Persistent)
    // ============================================================
    showDashboardAlert(title, message, type = 'error') {
        const alertBox = document.getElementById('dashboard-alert');
        const alertTitle = document.getElementById('dashboard-alert-title');
        const alertMessage = document.getElementById('dashboard-alert-message');
        const alertIcon = document.getElementById('dashboard-alert-icon');

        if (!alertBox) return;

        const styles = {
            error: { bg: 'bg-red-900/20', border: 'border-red-500', text: 'text-red-400', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
            warning: { bg: 'bg-amber-900/20', border: 'border-amber-500', text: 'text-amber-400', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>' },
            info: { bg: 'bg-blue-900/20', border: 'border-blue-500', text: 'text-blue-400', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' }
        };

        const style = styles[type] || styles.error;

        alertBox.className = `p-4 rounded-lg border border-l-4 mb-4 flex items-start gap-3 transition-all duration-300 ${style.bg} ${style.border} ${style.text}`;
        if (alertTitle) alertTitle.textContent = title;
        if (alertMessage) alertMessage.textContent = message;
        if (alertIcon) alertIcon.innerHTML = style.icon;
        alertBox.classList.remove('hidden');
    }

    init() {
        this.bindEvents();
        this.checkAuth(); this.initMobileNav();
    }

    // ============================================================
    // 1. Data Fetching (جلب البيانات)
    // ============================================================
    async fetchAllData() {
        this.setLoadingState(true);
        const tableBody = document.getElementById('table-body');

        // رسالة تحميل مؤقتة
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="24" class="text-center p-10 text-slate-400">جاري الاتصال بقاعدة البيانات وجلب السجلات...</td></tr>`;

        try {
            const authHeaders = this.getAuthHeaders();

            // Append date filters to fetch only the needed data from the server
            const url = new URL(this.API_URL);

            // Append date filters to fetch only the needed data from the server
            const dateFilter = document.getElementById('date-filter')?.value || 'month'; // Default to last 30 days
            url.searchParams.append('dateFilter', dateFilter);
            if (dateFilter === 'custom') {
                const startDate = document.getElementById('start-date')?.value;
                const endDate = document.getElementById('end-date')?.value;
                if (startDate) url.searchParams.append('startDate', startDate);
                if (endDate) url.searchParams.append('endDate', endDate);
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders)
            });

            if (response.ok) {
                const result = await response.json();

                // [NEW] Hide alert if previously shown
                const alertBox = document.getElementById('dashboard-alert');
                if (alertBox) alertBox.classList.add('hidden');

                // [NEW] Check for empty data
                if (!result.data || result.data.length === 0) {
                    this.showDashboardAlert(
                        'تنبيه: لا توجد بيانات',
                        'لم يتم العثور على أي سجلات في قاعدة بيانات Supabase. يرجى التأكد من وجود بيانات في الجداول أو التحقق من الاتصال.',
                        'warning'
                    );
                }
                // --- [أضف هذا السطر هنا] ---
                this.spendData = result.spendData || [];
                this.campaignConfig = result.campaignConfig || [];
                // ---------------------------
                // مزامنة حالة المستخدم فوراً مع البيانات القادمة من السيرفر
                if (result.currentUser) {
                    this.syncUserState(result.currentUser);
                }

                // معالجة البيانات الأولية وتحويلها لصيغة قابلة للتحليل
                console.log('DEBUG: Raw Data Length:', result.data ? result.data.length : 'Missing');
                this.allData = (result.data || []).map(item => {
                    item.parsedDate = this.parseDate(item.timestamp);
                    item.finalAmount = parseFloat(item.finalAmount) || 0;

                    // تطبيع النصوص (Normalization) لضمان دقة الفلترة
                    let s = (item.status || 'pending').toLowerCase();
                    if (s === 'pending_cashplus') s = 'pending';
                    if (s === 'canceled' || s === 'not-confirmed' || s === 'failed') s = 'cancelled';
                    item.status = s;

                    // --- [التعديل الجديد] توحيد مصطلحات الدفع ---
                    let pm = (item.paymentMethod || 'other').toLowerCase().trim();
                    // إذا كان الاسم credit_card نحوله إلى card
                    if (pm === 'credit_card') { pm = 'card'; }
                    if (pm === 'cod') { pm = 'cash'; }
                    item.paymentMethod = pm;
                    // ------------------------------------------
                    item.normalizedCourse = item.productSku || item.productTitle || 'Dermossence';
                    item.productName = item.productTitle || 'Dermossence';
                    item.language = (item.language || 'unknown').toLowerCase();

                    // (FIX) معالجة حقول التتبع
                    item.utm_source = item.utm_source && item.utm_source !== 'undefined' ? item.utm_source : 'Direct/None';
                    item.utm_campaign = item.utm_campaign && item.utm_campaign !== 'undefined' ? item.utm_campaign : 'Organic';
                    item.utm_id = item.utm_id && item.utm_id !== 'undefined' ? item.utm_id.trim() : '';
                    // Dermossence: normalize quantity from productVariant field
                    item.quantity = parseInt(item.productVariant || item.quantity || 1);

                    return item;
                });

                // ترتيب البيانات: الأحدث أولاً
                this.allData.sort((a, b) => (b.parsedDate?.getTime() || 0) - (a.parsedDate?.getTime() || 0));

                // بدء تشغيل المحرك
                this.applyLocalFilters();

                // [تعديل جديد وحصري]: تحديث "سجل المصاريف" إذا كان مفتوحاً
                const spendSection = document.getElementById('spend-management-section');
                if (spendSection && !spendSection.classList.contains('hidden')) {
                    this.renderSpendManagementTable();
                }

            } else {
                let errorMsg = `فشل الاتصال بالسيرفر: ${response.status}`;
                try {
                    const errorJson = await response.json();
                    if (errorJson.error) errorMsg = errorJson.error;
                    else if (errorJson.message) errorMsg = errorJson.message;
                } catch (e) { }

                this.showDashboardAlert('خطأ في جلب البيانات', errorMsg, 'error');

                if (response.status === 401) {
                    this.logout();
                } else {
                    throw new Error(errorMsg);
                }
            }
        } catch (error) {
            console.error('Data Load Error:', error);
            this.showDashboardAlert('خطأ غير متوقع', error.message, 'error');
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="24" class="text-center p-10 text-red-500 font-bold">خطأ: ${error.message}</td></tr>`;
        } finally {
            this.setLoadingState(false);
        }
    }
    applyPermissionsUI() {
        const perms = JSON.parse(localStorage.getItem('user_permissions') || '{"can_edit":false, "can_view_stats":false}');
        const role = localStorage.getItem('user_role');

        // 1. منطق التعتيم (Blurring) للإحصائيات والأمور المالية
        if (role !== 'super_admin' && !perms.can_view_stats) {
            const sensitiveSelectors = [
                '#metrics-cards',
                '#revenue-stats-breakdown',
                '#paid-payments-stats',
                '#total-payments-stats',
                '#metrics-daily-revenue-chart',
                '#payment-method-chart',
                '#top-campaigns-body',
                '#product-stats-container',
                '#qualification-chart',
                '#experience-chart',
                '#language-chart',
                // --- إضافة جديدة: استهداف عمود المبلغ في الجدول ---
                '.sensitive-amount',
                // تعتيم البطاقات الجانبية للإحصائيات التفصيلية
                '.filtered-stat-wrapper',
                '#metrics-daily-funnel-chart',
                '#metrics-cards'
            ];

            sensitiveSelectors.forEach(selector => {
                const els = document.querySelectorAll(selector);
                els.forEach(el => {
                    el.style.filter = 'blur(5px)'; // درجة تعتيم قوية
                    el.style.pointerEvents = 'none'; // منع النقر
                    el.style.userSelect = 'none';   // منع التحديد والنسخ
                    el.style.opacity = '0.6';       // تخفيف الشفافية قليلاً
                });
            });
        }

        // 2. منطق إخفاء أزرار التعديل في الجدول
        if (role !== 'super_admin' && !perms.can_edit) {
            // نخفي أزرار التعديل في كل صفوف الجدول
            const actionButtons = document.querySelectorAll('#data-table button');
            actionButtons.forEach(btn => {
                // نجعل الأزرار شبه مختفية وغير قابلة للنقر
                btn.disabled = true;
                btn.classList.add('opacity-10', 'cursor-not-allowed', 'grayscale');
                // إزالة حدث النقر نهائياً
                btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); return false; };
            });

            // إخفاء زر "إضافة يدوية" بالكامل
            const addBtn = document.getElementById('add-btn');
            if (addBtn) addBtn.style.display = 'none';
        }
    }

    // ============================================================
    // (NEW) Debug Connection
    // ============================================================
    async debugConnection() {
        try {
            const authHeaders = this.getAuthHeaders();
            const response = await fetch(this.API_URL, {
                headers: authHeaders
            });
            const text = await response.text();
            let json;
            try { json = JSON.parse(text); } catch (e) { json = { error: 'Invalid JSON', raw: text }; }

            const debugInfo = {
                status: response.status,
                headers: Object.fromEntries(response.headers.entries()),
                summary: {
                    dataLength: json.data ? json.data.length : 'Missing/Null',
                    spendDataLength: json.spendData ? json.spendData.length : 'Missing/Null',
                    userRole: localStorage.getItem('user_role'),
                    serverUser: json.currentUser ? json.currentUser.role : 'Not Returned'
                },
                body: json,
                localStorageRole: localStorage.getItem('user_role'),
                localStorageToken: localStorage.getItem('admin_token') ? 'Present' : 'Missing'
            };

            const content = `<pre class="text-xs text-left bg-slate-900 p-4 rounded overflow-auto h-96" dir="ltr">${JSON.stringify(debugInfo, null, 2)}</pre>`;
            this.createModal('Debug Info', content, '');

        } catch (e) {
            this.createModal('Debug Error', e.message, '');
        }
    }

    // ============================================================
    // (NEW) دالة مزامنة حالة المستخدم مع السيرفر
    // ============================================================
    syncUserState(serverUser) {
        if (!serverUser) return;

        // 1. التحقق من التجميد الفوري
        if (serverUser.is_frozen) {
            this.showNotification('تم تجميد حسابك من قبل الإدارة. سيتم تسجيل الخروج...', 'error');

            // [التصحيح]: نؤخر الخروج لمدة 3 ثوانٍ ليتمكن المستخدم من قراءة الرسالة
            setTimeout(() => {
                this.logout();
            }, 3000);

            return;
        }

        const currentRole = localStorage.getItem('user_role');
        const currentPerms = localStorage.getItem('user_permissions');

        // [FIX] تحديث البريد الإلكتروني دائماً، ليس فقط عند تغيير الدور
        if (serverUser.email) {
            localStorage.setItem('user_email', serverUser.email);
        }

        // 2. التحقق من تغير الدور (Role)
        // مثلاً: تم تحويله من Editor إلى Super Admin أو العكس
        if (serverUser.role !== currentRole) {
            console.log(`Role changed from ${currentRole} to ${serverUser.role}. Updating UI...`);
            localStorage.setItem('user_role', serverUser.role);
            this.updateSettingsButtonVisibility(serverUser.role);
            this.updateutmbuilderButtonVisibility(serverUser.role);
            this.updatemanagespendButtonVisibility(serverUser.role);
            this.updaterecordspendButtonVisibility(serverUser.role);
        }

        // 3. التحقق من تغير الصلاحيات (Permissions)
        const newPermsStr = JSON.stringify(serverUser.permissions);
        if (newPermsStr !== currentPerms) {
            console.log('Permissions changed. Updating UI...');
            localStorage.setItem('user_permissions', newPermsStr);
            // إعادة تطبيق الصلاحيات على الواجهة (Blurring etc)
            this.applyPermissionsUI();
        }

        // 4. تحديث الأسماء (Names)
        if (serverUser.first_name !== undefined) {
            if (serverUser.first_name) {
                localStorage.setItem('user_first_name', serverUser.first_name);
                localStorage.setItem('user_last_name', serverUser.last_name || '');
            } else if (serverUser.role === 'super_admin') {
                // Fallback: يُستدعى فقط للمدير لأن get_users محظور على الموظفين
                this.fixMissingName(serverUser.email);
            }
        }


        // 5. تحديث رسالة الترحيب
        this.updateWelcomeMessage(serverUser.email);
    }

    // ============================================================
    // (NEW) تحديث رسالة الترحيب الديناميكية
    // ============================================================
    updateWelcomeMessage(email) {
        const container = document.getElementById('welcome-message-container');
        if (!container || !email) return;

        let firstName = localStorage.getItem('user_first_name');
        let lastName = localStorage.getItem('user_last_name');
        
        if (firstName === 'undefined' || firstName === 'null') firstName = '';
        if (lastName === 'undefined' || lastName === 'null') lastName = '';

        // [FIX #8] إعلان name صريح لتجنب ReferenceError
        let name = '';

        if (email === 'Emergency Admin') {
            name = 'Emergency Admin';
        } else if (firstName || lastName) {
            name = `${firstName || ''} ${lastName || ''}`.trim();
        } else {
            // 1. استخراج الاسم من البريد الإلكتروني كحل بديل
            name = email.split('@')[0];
            name = name.charAt(0).toUpperCase() + name.slice(1);
        }


        // 2. تحديد التحية حسب الوقت
        const hour = new Date().getHours();
        let greeting = 'مرحباً';
        let icon = '';

        if (hour >= 5 && hour < 12) {
            greeting = 'صباح الخير';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>`;
        } else if (hour >= 12 && hour < 18) {
            greeting = 'طاب يومك';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>`;
        } else {
            greeting = 'مساء الخير';
            icon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>`;
        }

        // 3. تحديث النصوص
        document.getElementById('welcome-title').innerHTML = `${greeting}، <span class="text-slate-100 font-bold tracking-wide">${this.escapeHtml(name)}</span>`;
        document.getElementById('welcome-icon-wrapper').innerHTML = icon;

        // 4. تحديث التاريخ والوقت بشكل حي (Live Clock)
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
        }
        
        const updateClock = () => {
            const now = new Date();
            const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit' };

            const dateElement = document.getElementById('welcome-date');
            const timeElement = document.getElementById('welcome-time');
            
            if (dateElement) dateElement.textContent = now.toLocaleDateString('ar-MA', dateOptions);
            if (timeElement) timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
        };
        
        // تحديث أولي فوراً
        updateClock();
        // تحديث كل ثانية
        this.clockInterval = setInterval(updateClock, 1000);

        // 5. إظهار الحاوية
        container.classList.remove('hidden');
    }

    // Workaround: Vercel might return empty first_name in get_all_data, but get_users works.
    async fixMissingName(email) {
        if (!email) return;
        try {
            const res = await fetch(`${this.API_URL}?action=get_users`, {
                headers: this.getAuthHeaders()
            });
            if (res.ok) {
                const { data } = await res.json();
                const me = data.find(u => u.email === email);
                if (me && (me.first_name || me.last_name)) {
                    localStorage.setItem('user_first_name', me.first_name);
                    localStorage.setItem('user_last_name', me.last_name);
                    this.updateWelcomeMessage(email);
                }
            }
        } catch (e) {
            console.error('Failed to fix missing name:', e);
        }
    }

    // دالة مساعدة لإظهار/إخفاء زر الإعدادات ديناميكياً
    updateSettingsButtonVisibility(role) {
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            if (role === 'super_admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }
    }

    updateutmbuilderButtonVisibility(role) {
        const settingsBtn = document.getElementById('utm-builder-btn');
        if (settingsBtn) {
            if (role === 'super_admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }
    }

    updatecampaignmanagerButtonVisibility(role) {
        const settingsBtn = document.getElementById('campaign-manager-btn');
        if (settingsBtn) {
            if (role === 'super_admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }
    }

    updatemanagespendButtonVisibility(role) {
        const settingsBtn = document.getElementById('manage-spend-btn');
        if (settingsBtn) {
            if (role === 'super_admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }
    }

    updaterecordspendButtonVisibility(role) {
        const settingsBtn = document.getElementById('record-spend-btn');
        if (settingsBtn) {
            if (role === 'super_admin') {
                settingsBtn.classList.remove('hidden');
            } else {
                settingsBtn.classList.add('hidden');
            }
        }
    }

    // ============================================================
    // (NEW) دالة مركزية للتحقق: هل هذه المعاملة مدفوعة؟
    // ============================================================
    isPaidTransaction(item) {
        // 1. Check utm_id first (Strongest Signal)
        if (item.utm_id) {
            const hasSpend = this.spendData.some(s => s.utm_id === item.utm_id);
            if (hasSpend) return true;
        }

        const src = (item.utm_source || '').toLowerCase().trim();
        const med = (item.utm_medium || '').toLowerCase().trim();
        const cmp = (item.utm_campaign || '').toLowerCase().trim();

        // 2. Explicit Free Sources
        if (src === 'manual_entry' || src === 'direct' || src === 'organic' || src === 'referral') return false;

        // 3. Explicit Paid Mediums
        const paidMediums = ['cpc', 'cpm', 'paid_social', 'display', 'ppc'];
        if (paidMediums.includes(med)) return true;

        // 4. Paid Sources
        if (['facebook_ads', 'google_ads', 'tiktok_ads', 'snapchat_ads', 'linkedin_ads'].includes(src)) return true;

        // 5. Fallback: Name-based Campaign Matching
        if (cmp && cmp !== 'undefined') {
            const key = this.getSmartCampaignKey(cmp);
            // البحث في سجل المصاريف
            if (this.spendData && this.spendData.some(s => this.getSmartCampaignKey(s.campaign) === key)) {
                return true;
            }
        }

        // الافتراضي: مجاني
        return false;
    }

    // ============================================================
    // 2. Filtering Engine (محرك الفلترة)
    // ============================================================
    applyLocalFilters() {
        // قراءة جميع الفلاتر من الواجهة
        const searchTerm = (document.getElementById('search-input')?.value || '').toLowerCase();
        const statusFilter = document.getElementById('status-filter')?.value || '';
        const paymentFilter = document.getElementById('payment-filter')?.value || '';
        const productFilter = document.getElementById('product-filter')?.value || '';
        const campaignFilter = document.getElementById('campaign-filter')?.value || '';
        const utmIdFilter = (document.getElementById('utm-id-filter')?.value || '').trim();
        const externalFilter = document.getElementById('external-filter')?.value || '';
        const dateFilter = document.getElementById('date-filter')?.value || 'all';
        const startDateVal = document.getElementById('start-date')?.value;
        const endDateVal = document.getElementById('end-date')?.value;

        // تطبيق المنطق على كل صف
        this.filteredData = this.allData.filter(item => {
            // 1. البحث النصي (يشمل الاسم، الإيميل، الهاتف، الدورة، المصدر)
            const searchTargets = [
                item.customerName, item.customerEmail, item.customerPhone,
                item.productName, item.orderId, item.utm_source
            ].join(' ').toLowerCase();

            if (searchTerm && !searchTargets.includes(searchTerm)) return false;

            // 2. الفلاتر المحددة
            if (statusFilter && item.status !== statusFilter) return false;
            if (paymentFilter && item.paymentMethod !== paymentFilter) return false;
            if (productFilter && item.normalizedCourse !== productFilter) return false;
            if (utmIdFilter && item.utm_id !== utmIdFilter) return false;
            if (externalFilter) {
                if (externalFilter === 'internal' && item.isExternal) return false;
                if (externalFilter === 'external' && !item.isExternal) return false;
            }
            if (campaignFilter) {
                if (campaignFilter === 'Organic') {
                    // إذا اختار المستخدم "Organic"، نعرض له كل ما هو "غير مدفوع"
                    // حتى لو كان اسم الحملة مختلفاً (لضمان تطابق الأرقام مع البطاقة)
                    if (this.isPaidTransaction(item)) return false;
                } else {
                    // للحملات الأخرى، تطابق بالاسم فقط
                    if (item.utm_campaign !== campaignFilter) return false;
                }
            }

            // 3. فلترة التاريخ (تم التحديث لتوحيد المنطق مع الجداول)
            if (dateFilter !== 'all') {
                if (!item.parsedDate) return false;

                const itemDate = new Date(item.parsedDate);
                // تصفير الوقت للمقارنة بالأيام
                itemDate.setHours(0, 0, 0, 0);

                const now = new Date();
                now.setHours(0, 0, 0, 0); // تصفير وقت "الآن"

                const cutoff = new Date(now); // تاريخ الحد الفاصل

                switch (dateFilter) {
                    case 'hour':
                        // استثناء: الساعة تتطلب دقة الوقت
                        const oneHourAgo = new Date(new Date().getTime() - (60 * 60 * 1000));
                        if (item.parsedDate < oneHourAgo) return false;
                        break; // لا نستخدم return true هنا لنسمح بمرور الكود

                    case 'day':
                        // اليوم الحالي فقط
                        if (itemDate.getTime() !== now.getTime()) return false;
                        break;

                    case 'week':
                        // آخر 7 أيام
                        cutoff.setDate(now.getDate() - 7);
                        if (itemDate < cutoff) return false;
                        break;

                    case 'month':
                        // آخر 30 يوم
                        cutoff.setDate(now.getDate() - 30);
                        if (itemDate < cutoff) return false;
                        break;

                    case '3month':
                        cutoff.setMonth(now.getMonth() - 3);
                        if (itemDate < cutoff) return false;
                        break;

                    case '6month':
                        cutoff.setMonth(now.getMonth() - 6);
                        if (itemDate < cutoff) return false;
                        break;

                    case '9month':
                        cutoff.setMonth(now.getMonth() - 9);
                        if (itemDate < cutoff) return false;
                        break;

                    case 'year':
                        cutoff.setFullYear(now.getFullYear() - 1);
                        if (itemDate < cutoff) return false;
                        break;

                    case 'custom':
                        if (startDateVal) {
                            const start = new Date(startDateVal);
                            start.setHours(0, 0, 0, 0);
                            if (itemDate < start) return false;
                        }
                        if (endDateVal) {
                            const end = new Date(endDateVal);
                            end.setHours(23, 59, 59, 999);
                            // هنا نقارن التاريخ الكامل بالوقت
                            if (item.parsedDate > end) return false;
                        }
                        break;
                }
            }
            return true;
        });

        this.currentPage = 1;
        this.updateDashboardUI();
    }

    // ============================================================
    // 3. UI Update Coordinator (مدير تحديث الواجهة)
    // ============================================================
    updateDashboardUI() {
        // 1. حساب KPIs للإجمالي والمفلتر
        const overallStats = this.calculateKPIs(this.allData);
        const filteredStats = this.calculateKPIs(this.filteredData);

        // 2. تحديث البطاقات العلوية (Split Stats)
        this.renderSplitStatsCards(overallStats, filteredStats);

        // 3. رسم الشارتات الأساسية (Trends, Payment, Language)
        this.renderAdvancedCharts(this.filteredData);

        // 4. (NEW - FIX) رسم الشارتات التي كانت "جامدة" سابقاً
        // نتأكد من وجود البيانات قبل محاولة الرسم
        if (this.filteredData.length > 0) {
            this.renderStatusDistributionChart(this.filteredData);
            this.renderAdvancedCharts(this.filteredData);
            this.renderQuantityChart(this.filteredData);
            this.renderCampaignsTable(this.filteredData);
            // [هام جداً: أضف هذا السطر لتشغيل جدول كفاءة الإعلانات]
            if (typeof this.renderAdPerformanceTable === 'function') {
                this.renderAdPerformanceTable(this.filteredData);
            }
        } else {
            this.clearCampaignsTable(); // مسح الجدول إذا لم توجد بيانات
            this.renderAdPerformanceTable(this.filteredData);
        }

        // 5. تحديث الجدول وإحصائيات الدورات
        this.renderTable();
        this.renderProductStatistics(this.filteredData);
        this.populateProductFilterOptions(this.allData);
        this.populateCampaignFilterOptions(this.allData);
        this.populateUtmIdFilterOptions(this.allData);

        // 6. التحكم في ظهور "القسم المفلتر"
        const isFiltered = this.allData.length !== this.filteredData.length;
        document.querySelectorAll('.filtered-stat-wrapper').forEach(el => {
            if (isFiltered) el.classList.remove('hidden');
            else el.classList.add('hidden');
        });
        // 7. (هام جداً) تطبيق الصلاحيات والتعتيم بعد رسم كل شيء
        this.applyPermissionsUI(); // <--- أضف هذا السطر هنا
    }

    // ============================================================
    // (NEW) Helper: Calculate Unit Cost per Campaign (Cost Per Lead)
    // ============================================================
    calculateCampaignUnitCosts() {
        const unitMetrics = {};

        // [SAFETY CHECK] Ensure data exists
        if (!this.spendData || !Array.isArray(this.spendData)) return {};
        if (!this.allData || !Array.isArray(this.allData)) return {};

        try {
            // 1. Get Date Filter Context
            const dateFilter = document.getElementById('date-filter')?.value || 'all';
            const startDateVal = document.getElementById('start-date')?.value;
            const endDateVal = document.getElementById('end-date')?.value;

            // 2. Filter Spend Data by Date
            const periodSpend = this.spendData.filter(s => {
                const sDate = this.parseSpendDate(s.date);
                if (!sDate) return false;
                sDate.setHours(0, 0, 0, 0);
                const now = new Date(); now.setHours(0, 0, 0, 0);

                if (dateFilter === 'all') return true;

                let cutoff = new Date(now);
                switch (dateFilter) {
                    case 'day': return sDate.getTime() === now.getTime();
                    case 'week': cutoff.setDate(now.getDate() - 7); return sDate >= cutoff;
                    case 'month': cutoff.setDate(now.getDate() - 30); return sDate >= cutoff;
                    case '3month': cutoff.setMonth(now.getMonth() - 3); return sDate >= cutoff;
                    case 'year': cutoff.setFullYear(now.getFullYear() - 1); return sDate >= cutoff;
                    case 'custom':
                        if (startDateVal && sDate < new Date(startDateVal).setHours(0, 0, 0, 0)) return false;
                        if (endDateVal && sDate > new Date(endDateVal).setHours(23, 59, 59, 999)) return false;
                        return true;
                    default: return true;
                }
            });

            // 3. Filter Leads Data by Date (Denominator)
            const periodLeads = this.allData.filter(item => {
                if (!item.parsedDate) return false;
                const itemDate = new Date(item.parsedDate);
                itemDate.setHours(0, 0, 0, 0);
                const now = new Date(); now.setHours(0, 0, 0, 0);

                if (dateFilter === 'all') return true;

                let cutoff = new Date(now);
                switch (dateFilter) {
                    case 'day': return itemDate.getTime() === now.getTime();
                    case 'week': cutoff.setDate(now.getDate() - 7); return itemDate >= cutoff;
                    case 'month': cutoff.setDate(now.getDate() - 30); return itemDate >= cutoff;
                    case '3month': cutoff.setMonth(now.getMonth() - 3); return itemDate >= cutoff;
                    case 'year': cutoff.setFullYear(now.getFullYear() - 1); return itemDate >= cutoff;
                    case 'custom':
                        if (startDateVal && itemDate < new Date(startDateVal).setHours(0, 0, 0, 0)) return false;
                        if (endDateVal && itemDate > new Date(endDateVal).setHours(23, 59, 59, 999)) return false;
                        return true;
                    default: return true;
                }
            });

            // 4. Group & Calculate
            const spendMap = {};
            const impMap = {};
            const clickMap = {};

            periodSpend.forEach(s => {
                const key = this.getSmartCampaignKey(s);
                spendMap[key] = (spendMap[key] || 0) + (parseFloat(s.spend) || 0);
                impMap[key] = (impMap[key] || 0) + (parseInt(s.impressions) || 0);
                clickMap[key] = (clickMap[key] || 0) + (parseInt(s.clicks) || 0);
            });

            const leadsMap = {};
            periodLeads.forEach(item => {
                const key = this.getSmartCampaignKey(item);
                leadsMap[key] = (leadsMap[key] || 0) + 1;
            });

            Object.keys(spendMap).forEach(key => {
                const totalSpend = spendMap[key];
                const totalImp = impMap[key] || 0;
                const totalClicks = clickMap[key] || 0;
                const totalLeads = leadsMap[key] || 0;

                // If leads > 0, distribute cost. If 0, it's wasted spend
                if (totalLeads > 0) {
                    unitMetrics[key] = {
                        cost: totalSpend / totalLeads,
                        impressions: totalImp / totalLeads,
                        clicks: totalClicks / totalLeads
                    };
                } else {
                    // For campaigns with 0 leads, we can't distribute proportionally to leads.
                    unitMetrics[key] = { cost: 0, impressions: 0, clicks: 0 };
                }
            });

            return unitMetrics;
        } catch (error) {
            console.error('Error in calculateCampaignUnitCosts:', error);
            return {};
        }
    }

    // ============================================================
    // 4. Analytics Engine (محرك الحسابات)
    // ============================================================
    // ============================================================
    // استبدل دالة calculateKPIs القديمة بهذه النسخة
    // ============================================================
    calculateKPIs(dataSet) {
        // [NEW] Calculate Unit Costs for Attribution
        const unitCosts = this.calculateCampaignUnitCosts();

        const stats = {
            totalRevenue: 0,
            totalFees: 0,    // [جديد] مخزن العمولات
            netRevenue: 0,   // [جديد] الصافي بعد العمولات
            deliveredRevenue: 0, paidRevenue: 0, confirmedRevenue: 0, pendingRevenue: 0, cancelledRevenue: 0,
            totalTx: dataSet.length, deliveredTx: 0, paidTx: 0, confirmedTx: 0, pendingTx: 0, cancelledTx: 0,
            // العدادات لكل نوع
            cashplusCount: 0, cardCount: 0, cashCount: 0, bankCount: 0,
            // الإيرادات لكل نوع (للمدفوع فقط)
            paid_cashplus: 0, paid_card: 0, paid_cash: 0, paid_bank: 0,
            net_cashplus_revenue: 0, net_card_revenue: 0, net_cash_revenue: 0, net_bank_revenue: 0,
            // [NEW] Attributed Spend
            totalAttributedSpend: 0
        };

        dataSet.forEach(item => {
            const amount = item.finalAmount;
            // تطبيع طريقة الدفع
            const pm = (item.paymentMethod || '').toLowerCase(); // توحيد الاسم

            // [NEW] Calculate Attributed Spend
            const cmpKey = this.getSmartCampaignKey(item);
            if (unitCosts[cmpKey]) {
                stats.totalAttributedSpend += (unitCosts[cmpKey].cost || 0);
            }

            // تصنيف العدادات
            if (pm === 'cashplus') stats.cashplusCount++;
            else if (pm === 'card' || pm === 'credit_card') stats.cardCount++;
            else if (pm === 'cash') stats.cashCount++;
            else if (pm.includes('bank') || pm === 'virement') stats.bankCount++;

            switch (item.status) {
                case 'delivered':
                case 'paid':
                    if (item.status === 'delivered') {
                        stats.deliveredTx++;
                        stats.deliveredRevenue += amount;
                    } else {
                        stats.paidTx++;
                        stats.paidRevenue += amount;
                    }
                    stats.totalRevenue += amount; // Revenue المجمع
                    // --- [إضافة جديدة: حساب العمولات] ---
                    // الخصم: 3.9% + 2 درهم (للبطاقة وكاش بلوس فقط)
                    let fee = 0;
                    if (pm === 'card' || pm === 'credit_card' || pm === 'cashplus') {
                        fee = (amount * 0.039) + 2;
                    }
                    stats.totalFees += fee;
                    stats.netRevenue += (amount - fee);
                    // ------------------------------------
                    // تفصيل الإيرادات حسب المصدر
                    if (pm === 'cashplus') { stats.paid_cashplus++; stats.net_cashplus_revenue += amount; }
                    else if (pm === 'card' || pm === 'credit_card') { stats.paid_card++; stats.net_card_revenue += amount; }
                    else if (pm === 'cash') { stats.paid_cash++; stats.net_cash_revenue += amount; }
                    else if (pm.includes('bank') || pm === 'virement') { stats.paid_bank++; stats.net_bank_revenue += amount; }
                    break;
                case 'confirmed':
                    stats.confirmedTx++;
                    stats.confirmedRevenue += amount;
                    break;
                case 'pending':
                case 'pending_cashplus':
                    stats.pendingTx++;
                    stats.pendingRevenue += amount;
                    break;
                case 'failed':
                case 'canceled':
                case 'cancelled':
                    stats.cancelledTx++;
                    stats.cancelledRevenue += amount;
                    break;
            }
        });
        stats.aov = stats.paidTx > 0 ? Math.round(stats.paidRevenue / stats.paidTx) : 0;
        return stats;
    }

    // ============================================================
    // [NEW] Advanced Stats Calculator (للحصول على بيانات الإعلانات والمصاريف)
    // ============================================================
    getAdvancedStats(dataSet) {
        // 1. حساب الإيرادات الأساسية
        let totalRevenue = 0;
        let paidRevenue = 0;
        let organicRevenue = 0;
        let totalPaidTx = 0;
        let adPaidTx = 0;
        let totalGatewayFees = 0;

        dataSet.forEach(item => {
            if (item.status === 'delivered' || item.status === 'paid') {
                const amount = item.finalAmount || 0;
                totalRevenue += amount;
                totalPaidTx++;

                // حساب العمولات
                const pm = (item.paymentMethod || '').toLowerCase();
                if (pm === 'card' || pm === 'credit_card' || pm === 'cashplus') {
                    totalGatewayFees += (amount * 0.039) + 2;
                }

                // تصنيف مدفوع vs عضوي
                if (this.isPaidTransaction(item)) {
                    paidRevenue += amount;
                    adPaidTx++;
                } else {
                    organicRevenue += amount;
                }
            }
        });

        // 2. حساب المصاريف (Total Spend) - [UPDATED: Proportional Attribution]
        // بدلاً من جمع مصاريف الحملة بالكامل، نقوم بتوزيع المصاريف على المعاملات
        // هذا يحل مشكلة الفلترة (مثلاً: معاملة واحدة من حملة كبيرة تظهر بتكلفة الحملة كاملة سابقاً)
        let totalSpend = 0;
        const unitCosts = this.calculateCampaignUnitCosts();

        dataSet.forEach(item => {
            const cmpKey = this.getSmartCampaignKey(item);
            if (unitCosts[cmpKey]) {
                totalSpend += (unitCosts[cmpKey].cost || 0);
            }
        });

        // 3. المؤشرات المتقدمة
        const totalNetProfit = totalRevenue - totalSpend - totalGatewayFees;
        const adsNetProfit = paidRevenue - totalSpend;
        const roas = totalSpend > 0 ? (paidRevenue / totalSpend) : 0;
        const cpa = adPaidTx > 0 ? (totalSpend / adPaidTx) : 0;
        const totalLeads = dataSet.length;
        const successRate = totalLeads > 0 ? ((totalPaidTx / totalLeads) * 100).toFixed(1) : 0;
        const aov = totalPaidTx > 0 ? Math.round(totalRevenue / totalPaidTx) : 0;

        return {
            totalRevenue,
            totalSpend,
            totalNetProfit,
            adsNetProfit,
            organicRevenue,
            totalGatewayFees,
            roas,
            cpa,
            totalLeads,
            successRate,
            aov,
            paidRevenue
        };
    }

    // ============================================================
    // 5. Charts Implementation (تنفيذ الشارتات)
    // ============================================================
    renderAdvancedCharts(dataSet) {
        // --- A. Daily Revenue Trend (Chart.js Line) ---
        const dailyRevenue = {};
        dataSet.forEach(item => {
            if ((item.status === 'delivered' || item.status === 'paid') && item.parsedDate) {
                const dateKey = item.parsedDate.toISOString().split('T')[0];
                dailyRevenue[dateKey] = (dailyRevenue[dateKey] || 0) + item.finalAmount;
            }
        });
        const sortedDates = Object.keys(dailyRevenue).sort();

        this.renderChart('metrics-daily-revenue-chart', 'trend', 'line', {
            labels: sortedDates,
            datasets: [{
                label: 'الإيرادات (MAD)',
                data: sortedDates.map(d => dailyRevenue[d]),
                borderColor: '#10B981', // لون أخضر احترافي
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true
            }]
        });

        // --- B. Payment Method Distribution (Doughnut) ---
        const pmCounts = { 'cashplus': 0, 'card': 0, 'cash': 0, 'bank': 0, 'other': 0 };
        dataSet.forEach(i => {
            const pm = (i.paymentMethod || '').toLowerCase();
            if (pm === 'cashplus') pmCounts.cashplus++;
            else if (pm === 'card' || pm === 'credit_card') pmCounts.card++;
            else if (pm === 'cash') pmCounts.cash++;
            else if (pm.includes('bank') || pm === 'virement') pmCounts.bank++;
            else pmCounts.other++;
        });

        this.renderChart('payment-method-chart', 'payment', 'doughnut', {
            labels: ['كاش بلوس', 'بطاقة بنكية', 'نقد (Cash)', 'تحويل بنكي', 'أخرى'],
            datasets: [{
                data: [pmCounts.cashplus, pmCounts.card, pmCounts.cash, pmCounts.bank, pmCounts.other],
                backgroundColor: [
                    '#F59E0B', // CashPlus (Orange)
                    '#2563EB', // Card (Blue)
                    '#10B981', // Cash (Green - New)
                    '#8B5CF6', // Bank (blue - New)
                    '#9CA3AF'  // Other (Gray)
                ],
                borderWidth: 0
            }]
        });

        // --- C. Conversion Funnel (Bar/Line Combo) ---
        const funnelData = {};
        dataSet.forEach(item => {
            if (!item.parsedDate) return;
            const k = item.parsedDate.toISOString().split('T')[0];
            if (!funnelData[k]) funnelData[k] = { inq: 0, conv: 0 };
            funnelData[k].inq++; // كل صف هو طلب
            if (item.status === 'delivered' || item.status === 'paid') funnelData[k].conv++; // التحويل الناجح
        });
        const fDates = Object.keys(funnelData).sort();

        const funnelCanvas = document.getElementById('metrics-daily-funnel-chart');
        if (funnelCanvas) {
            this.renderChart('metrics-daily-funnel-chart', 'funnel', 'bar', {
                labels: fDates,
                datasets: [
                    { label: 'الطلبات (Inquiries)', data: fDates.map(d => funnelData[d].inq), backgroundColor: 'rgba(37, 99, 235, 0.6)', order: 2 },
                    { label: 'عملية ناجحة (Paid/Delivered)', data: fDates.map(d => funnelData[d].conv), backgroundColor: 'rgba(16, 185, 129, 0.8)', order: 3 },
                    {
                        type: 'line', label: 'نسبة التحويل %',
                        data: fDates.map(d => funnelData[d].inq > 0 ? (funnelData[d].conv / funnelData[d].inq) * 100 : 0),
                        borderColor: '#F59E0B', borderWidth: 2, fill: false, yAxisID: 'y1', order: 1
                    }
                ]
            }, {
                scales: {
                    y: { beginAtZero: true, position: 'left' },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: v => v + '%' } }
                }
            });

            // إدارة حالة عدم وجود بيانات
            const emptyMsg = document.getElementById('metrics-daily-funnel-empty');
            if (emptyMsg) {
                if (fDates.length === 0) { funnelCanvas.style.display = 'none'; emptyMsg.classList.remove('hidden'); }
                else { funnelCanvas.style.display = 'block'; emptyMsg.classList.add('hidden'); }
            }
        }

        // --- D. Language Distribution ---
        const langCounts = { 'ar': 0, 'fr': 0, 'en': 0 };
        dataSet.forEach(i => {
            if (langCounts[i.language] !== undefined) langCounts[i.language]++;
            else langCounts['fr']++;
        });

        if (document.getElementById('language-chart')) {
            this.renderChart('language-chart', 'language', 'bar', {
                labels: ['العربية', 'الفرنسية', 'الإنجليزية'],
                datasets: [{
                    label: 'اللغة',
                    data: [langCounts.ar, langCounts.fr, langCounts.en],
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B'],
                    borderRadius: 4
                }]
            }, { scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } });
        }

        // --------------------------------------------------------
        // E. Key Metrics Cards (النسخة الذكية: فصل المجاني عن المدفوع)
        // --------------------------------------------------------
        const cards = document.getElementById('metrics-cards');
        if (cards) {
            document.getElementById('metrics-section')?.classList.remove('hidden');

            // 1. دالة تحديد هل المعاملة عضوية/مجانية؟
            const isPaidTraffic = (item) => {
                const src = (item.utm_source || '').toLowerCase().trim();
                const med = (item.utm_medium || '').toLowerCase().trim();
                const cmp = (item.utm_campaign || '').toLowerCase().trim();

                // أ) قائمة الاستبعاد الصريحة (Force Organic)
                // manual_entry: إدخال يدوي (دائماً مجاني)
                if (src === 'manual_entry' || src === 'direct' || src === 'organic' || src === 'referral') return false;

                // ب) التحقق عبر الوسيط (Standard Paid Mediums)
                // إذا كان الوسيط يدل صراحة على الدفع (فيسبوك، جوجل...)
                const paidMediums = ['cpc', 'cpm', 'paid_social', 'display', 'ppc'];
                if (paidMediums.includes(med)) return true;

                // ج) التحقق عبر ربط الحملات (Smart Campaign Linkage)
                // هل قمتَ أنت بتسجيل مصروف لهذه الحملة من قبل؟ إذا نعم، فهي مدفوعة.
                if (cmp && cmp !== 'undefined') {
                    const key = this.getSmartCampaignKey(cmp);
                    // البحث في سجل المصاريف
                    const hasSpend = this.spendData.some(s => this.getSmartCampaignKey(s.campaign) === key);
                    if (hasSpend) return true;
                }

                // د) الافتراضي: إذا لم يثبت أنها مدفوعة، فهي مجانية
                return false;
            };

            // 2. فصل الإيرادات (Paid vs Organic)
            let totalRevenue = 0;
            let paidRevenue = 0;
            let organicRevenue = 0;

            let totalPaidTx = 0;
            let adPaidTx = 0;
            let totalGatewayFees = 0;

            dataSet.forEach(item => {
                if (item.status === 'delivered' || item.status === 'paid') {
                    const amount = item.finalAmount || 0;
                    totalRevenue += amount;
                    totalPaidTx++;

                    // حساب العمولات (للبطاقات فقط)
                    const pm = (item.paymentMethod || '').toLowerCase();
                    if (pm === 'card' || pm === 'credit_card' || pm === 'cashplus') {
                        totalGatewayFees += (amount * 0.039) + 2;
                    }

                    // التصنيف الذكي الجديد
                    if (this.isPaidTransaction(item)) {
                        paidRevenue += amount;
                        adPaidTx++;
                    } else {
                        organicRevenue += amount;
                    }
                }
            });
            // 3. حساب المصاريف (Total Spend) - [UPDATED: Proportional Attribution]
            let totalSpend = 0;
            // [NEW] Use the same unit cost logic as getAdvancedStats
            const unitCosts = this.calculateCampaignUnitCosts();

            // Sum up the unit costs for all visible items
            this.filteredData.forEach(item => {
                const cmpKey = this.getSmartCampaignKey(item);
                if (unitCosts[cmpKey]) {
                    totalSpend += (unitCosts[cmpKey].cost || 0);
                }
            });

            // 4. المؤشرات (Logic: فصل تام للأداء الإعلاني)

            // أ) صافي ربح الإعلانات (المؤشر الحقيقي لأداء الحملات)
            const adNetProfit = paidRevenue - totalSpend;

            // ب) المؤشرات الأخرى
            const roas = totalSpend > 0 ? (paidRevenue / totalSpend) : 0;
            const cpa = adPaidTx > 0 ? (totalSpend / adPaidTx) : 0;
            const totalLeads = dataSet.length;
            const successRate = totalLeads > 0 ? ((totalPaidTx / totalLeads) * 100).toFixed(1) : 0;
            const aov = totalPaidTx > 0 ? Math.round(totalRevenue / totalPaidTx) : 0;

            // ============================================================
            // [تعديل] منطق العرض الموحد (Unified Display Logic)
            // ============================================================

            // 1. حسابات الأرباح الموحدة
            const totalNetProfit = totalRevenue - totalSpend - totalGatewayFees; // الربح النهائي (كل الدخل - كل المصروف)
            const adsNetProfit = paidRevenue - totalSpend;    // ربح الإعلانات فقط (دخل الإعلانات - المصروف)

            // 2. تجهيز نصوص العرض (Formatters)
            const fmt = (n) => n.toLocaleString(); // دالة تنسيق سريعة

            // 3. تجهيز محتوى بطاقة الإيرادات (Revenue Card Content)
            const revenueBreakdownHTML = `
                <div class="flex flex-wrap justify-between items-center gap-y-1 mt-2 pt-2 border-t border-dashed border-slate-700 text-[11px] font-sans text-slate-400">
                    <span class="flex items-center gap-1" title="Revenue from Ads"><span class="w-2 h-2 rounded-full bg-blue-900/200"></span> Ads: <b class="text-slate-300 dir-ltr">${fmt(paidRevenue)}</b></span>
                    <span class="flex items-center gap-1" title="Organic/Direct Revenue"><span class="w-2 h-2 rounded-full bg-green-500"></span> Org: <b class="text-slate-300 dir-ltr">${fmt(organicRevenue)}</b></span>
                </div>
            `;

            // 4. تجهيز محتوى بطاقة صافي الربح (Profit Card Content)
            // نحدد لون الرقم الرئيسي بناءً على الربح الكلي
            const profitColor = totalNetProfit >= 0 ? 'text-green-400' : 'text-red-400';
            const profitBg = totalNetProfit >= 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400';
            const profitBorder = totalNetProfit >= 0 ? 'border-green-500' : 'border-red-500/50';

            const profitBreakdownHTML = `
                <div class="flex flex-wrap justify-between items-center gap-y-1 mt-2 pt-2 border-t border-dashed border-slate-700 text-[11px] font-sans text-slate-400">
                    <span class="flex items-center gap-1" title="Net Profit from Ads (Paid Revenue - Spend)"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Ad Net: <b class="${adsNetProfit >= 0 ? 'text-slate-300' : 'text-red-500'} dir-ltr">${fmt(adsNetProfit)}</b></span>
                    <span class="flex items-center gap-1" title="Net Profit from Organic"><span class="w-2 h-2 rounded-full bg-green-500"></span> Org: <b class="text-slate-300 dir-ltr">${fmt(organicRevenue)}</b></span>
                    <span class="flex items-center gap-1" title="Payment Gateway fees (Card/CashPlus)"><span class="w-2 h-2 rounded-full bg-red-400"></span> Fees: <b class="text-red-400 dir-ltr">${fmt(totalGatewayFees)}-</b></span>
                </div>
                
            `;

            // دالة مساعدة لإنشاء HTML البطاقة (نفس التصميم السابق)
            const createCardHTML = (title, mainValueHTML, subContentHTML, borderColor, iconBg, iconPath) => `
                <div class="glass-card text-white p-4 rounded-xl border-t-4 ${borderColor} shadow-sm hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${title}</span>
                        <div class="p-2 ${iconBg} rounded-full">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconPath}</svg>
                        </div>
                    </div>
                    <div>
                        ${mainValueHTML}
                        ${subContentHTML}
                    </div>
                </div>
            `;

            // ألوان ROAS
            let roasColor = 'text-slate-400';
            if (roas >= 4) roasColor = 'text-green-400'; else if (roas >= 2) roasColor = 'text-yellow-400'; else if (totalSpend > 0) roasColor = 'text-red-400';

            // 5. بناء الـ HTML النهائي للبطاقات
            cards.innerHTML = `
                ${createCardHTML('إجمالي المصاريف',
                `<div class="text-2xl font-bold text-white dir-ltr font-mono">${fmt(totalSpend)} <span class="text-xs text-slate-400">MAD</span></div>`,
                `<div class="flex flex-wrap justify-between items-center gap-y-1 mt-2 pt-2 border-t border-dashed border-slate-700 text-[11px] font-sans text-slate-400">Ad Spend Only</div>`,
                'border-orange-500', 'bg-orange-900/20 text-orange-400',
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>')}
                
                ${createCardHTML('إجمالي الإيرادات',
                    `<div class="text-2xl font-bold text-blue-400 dir-ltr font-mono">${fmt(totalRevenue)} <span class="text-xs text-slate-400">MAD</span></div>`,
                    revenueBreakdownHTML,
                    'border-blue-500/50', 'bg-blue-900/20 text-blue-400',
                    '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>')}
                
                ${createCardHTML('صافي الربح (Total Net)',
                        `<div class="text-2xl font-bold ${profitColor} dir-ltr font-mono">${fmt(totalNetProfit)} <span class="text-xs text-slate-400">MAD</span></div>`,
                        profitBreakdownHTML,
                        profitBorder, profitBg,
                        '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>')}
                
                ${createCardHTML('العائد الإعلاني (ROAS)',
                            `<div class="text-2xl font-bold ${roasColor} dir-ltr font-mono">x${roas.toFixed(2)}</div>`,
                            `<div class="text-[10px] text-slate-400 mt-2 pt-2 border-t border-dashed border-slate-700">Based on Ad Revenue Only</div>`,
                            'border-blue-500/50', 'bg-blue-900/20 text-blue-400',
                            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>')}

                ${createCardHTML('إجمالي الطلبات', `<div class="text-2xl font-bold text-slate-300 dir-ltr font-mono">${totalLeads}</div>`, `<div class="text-[10px] text-slate-400 mt-2 pt-2 border-t border-transparent">Total Leads</div>`, 'border-gray-400', 'bg-slate-800 border border-slate-700 text-slate-400', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>')}
                
                ${createCardHTML('نسبة التحويل', `<div class="text-2xl font-bold text-blue-400 dir-ltr font-mono">${successRate}%</div>`, `<div class="text-[10px] text-slate-400 mt-2 pt-2 border-t border-transparent">Paid / Total</div>`, 'border-blue-500/50', 'bg-blue-900/20 text-blue-400', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>')}
                
                ${createCardHTML('متوسط السلة (AOV)', `<div class="text-2xl font-bold text-cyan-400 dir-ltr font-mono">${aov.toLocaleString()} <span class="text-xs text-slate-400">MAD</span></div>`, `<div class="text-[10px] text-slate-400 mt-2 pt-2 border-t border-transparent">Avg Order Value</div>`, 'border-cyan-500/50', 'bg-cyan-900/20 text-cyan-400', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>')}
                
                ${createCardHTML('تكلفة العميل (CPA)', `<div class="text-2xl font-bold text-pink-400 dir-ltr font-mono">${cpa > 0 ? cpa.toFixed(0) : '-'} <span class="text-xs text-slate-400">MAD</span></div>`, `<div class="text-[10px] text-slate-400 mt-2 pt-2 border-t border-transparent">Cost Per Acquisition</div>`, 'border-pink-500/50', 'bg-pink-900/20 text-pink-400', '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>')}
            `;
        }
    }

    // ============================================================
    // 6. Marketing & Demographics (إصلاح البيانات الجامدة)
    // ============================================================

    // رسم توزيع حالات الطلب (بديل Experience)
    renderStatusDistributionChart(dataSet) {
        if (!document.getElementById('status-chart')) return;
        const counts = { 'Pending ⏳': 0, 'Confirmed ✅': 0, 'Paid 💳': 0, 'Delivered 📦': 0, 'Canceled ❌': 0 };
        dataSet.forEach(item => {
            const s = (item.status || 'pending').toLowerCase();
            if (s === 'confirmed') counts['Confirmed ✅']++;
            else if (s === 'delivered') counts['Delivered 📦']++;
            else if (s === 'paid') counts['Paid 💳']++;
            else if (s === 'cancelled' || s === 'canceled') counts['Canceled ❌']++;
            else counts['Pending ⏳']++;
        });
        this.renderChart('status-chart', 'statusDist', 'doughnut', {
            labels: Object.keys(counts),
            datasets: [{ data: Object.values(counts), backgroundColor: ['#F59E0B', '#27ae60', '#3B82F6', '#10B981', '#EF4444'], borderWidth: 0 }]
        }, {});
    }

    // رسم توزيع الكميات (بديل Qualification)
    renderQuantityChart(dataSet) {
        if (!document.getElementById('quantity-chart')) return;

        // تجميع ديناميكي — يعمل مع أي منتج
        const counts = {};
        dataSet.forEach(item => {
            const q = parseInt(item.quantity || item.productVariant || 1);
            const label = `×${q}`;
            counts[label] = (counts[label] || 0) + 1;
        });

        const entries = Object.entries(counts)
            .sort((a, b) => parseInt(a[0].replace('×', '')) - parseInt(b[0].replace('×', '')));

        if (!entries.length) return;

        const palette = ['#3B82F6', '#F59E0B', '#10B981', '#A78BFA', '#F87171', '#22D3EE'];

        this.renderChart('quantity-chart', 'quantityDist', 'doughnut', {
            labels: entries.map(e => e[0]),
            datasets: [{ data: entries.map(e => e[1]), backgroundColor: palette.slice(0, entries.length), borderWidth: 0 }]
        }, {});
    }

    // ============================================================
    // renderCampaignsTable (Final Fix: Date-Aware Spend + Ad Tech)
    // ============================================================
    renderCampaignsTable(dataSet) {
        const tbody = document.getElementById('top-campaigns-body');
        if (!tbody) return;

        // 1. إعداد التجميع
        const campaignsMap = {};
        // [NEW] Calculate Unit Costs
        const unitCosts = this.calculateCampaignUnitCosts();

        const getCmp = (name) => {
            // نستخدم الدالة الذكية لإنشاء مفتاح موحد
            const key = this.getSmartCampaignKey(name);

            if (!campaignsMap[key]) {
                campaignsMap[key] = {
                    id: 'cmp-' + Math.random().toString(36).substr(2, 9),
                    name: name, // نحتفظ بالاسم الأصلي للعرض (أول اسم يتم اكتشافه)
                    total: 0, paid: 0, revenue: 0, spend: 0, impressions: 0, clicks: 0,
                    sources: new Set(), mediums: new Set(),
                    sourceMediumStats: {}, contentStats: {}, termStats: {}
                };
            }
            return campaignsMap[key];
        };

        // أ) دمج الإيرادات (Leads) - هي أصلاً مفلترة حسب التاريخ في dataSet
        dataSet.forEach(item => {
            // Use getSmartCampaignKey with the item to leverage utm_id
            const key = this.getSmartCampaignKey(item);

            // Find config to check attribution
            const config = this.campaignConfig.find(c => this.getSmartCampaignKey(c) === key);

            if (!this.isLeadAttributedToCampaign(item, config)) return;

            if (!campaignsMap[key]) {
                campaignsMap[key] = {
                    id: 'cmp-' + Math.random().toString(36).substr(2, 9),
                    name: item.utm_campaign || 'Organic',
                    utm_id: item.utm_id,
                    total: 0, paid: 0, revenue: 0, spend: 0, impressions: 0, clicks: 0,
                    sources: new Set(), mediums: new Set(),
                    sourceMediumStats: {}, contentStats: {}, termStats: {}
                };
            }
            const cmp = campaignsMap[key];

            // [NEW] Add Proportional Spend, Impressions, and Clicks
            if (unitCosts[key]) {
                cmp.spend += (unitCosts[key].cost || 0);
                cmp.impressions += (unitCosts[key].impressions || 0);
                cmp.clicks += (unitCosts[key].clicks || 0);
            }

            cmp.total++;
            if (item.status === 'delivered' || item.status === 'paid') {
                cmp.paid++;
                cmp.revenue += item.finalAmount;
            }

            // تفاصيل
            const isPaid = (item.status === 'delivered' || item.status === 'paid');
            const amount = item.finalAmount;
            const source = item.utm_source || 'Direct';
            const medium = item.utm_medium || '-';

            cmp.sources.add(source);
            cmp.mediums.add(medium);

            const updateSub = (obj, k) => {
                if (!obj[k]) obj[k] = { count: 0, paid: 0, rev: 0 };
                obj[k].count++;
                if (isPaid) { obj[k].paid++; obj[k].rev += amount; }
            };
            updateSub(cmp.sourceMediumStats, `${source} / ${medium}`);
            if (item.utm_content) updateSub(cmp.contentStats, item.utm_content);
            if (item.utm_term) updateSub(cmp.termStats, item.utm_term);
        });

        // ب) دمج المصاريف (Spend) - [مع تطبيق قاعدة الزمن الصارمة]
        const dateFilter = document.getElementById('date-filter')?.value || 'all';
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;

        if (this.spendData && Array.isArray(this.spendData)) {
            this.spendData.forEach(s => {
                if (!s.campaign) return;

                // [NEW] Skip if campaign is already in map (handled proportionally)
                const key = this.getSmartCampaignKey(s);
                if (campaignsMap[key]) return;

                // [NEW] Apply Global Filters to Spend Data
                const campaignFilter = document.getElementById('campaign-filter')?.value;
                const sourceFilter = document.getElementById('source-filter')?.value;
                const productFilter = document.getElementById('product-filter')?.value;

                // [NEW] Build Campaign -> Product Map for filtering spend
                // (We build this map on the fly to link campaigns to products based on historical leads)
                if (!this.campaignProductMap) {
                    this.campaignProductMap = {};
                    this.allData.forEach(item => {
                        const key = this.getSmartCampaignKey(item);
                        if (item.normalizedCourse) {
                            this.campaignProductMap[key] = item.normalizedCourse;
                        }
                    });
                }

                // 1. Campaign Filter
                if (campaignFilter) {
                    // If filter is active, spend campaign must match exactly
                    // (Note: 'Organic' filter usually implies no spend, so this will naturally hide paid campaigns)
                    if (s.campaign !== campaignFilter) return;
                }

                // 2. Source Filter
                if (sourceFilter) {
                    if (s.source !== sourceFilter) return;
                }

                // 3. Course Filter (The Missing Piece!)
                if (productFilter) {
                    const key = this.getSmartCampaignKey(s);
                    const campaignProduct = this.campaignProductMap ? this.campaignProductMap[key] : null;

                    // A. Check strict mapping from leads
                    let matches = (campaignProduct === productFilter);

                    // B. Fallback: Check if campaign name contains product name (for campaigns with 0 leads)
                    if (!matches && !campaignProduct) {
                        matches = String(s.campaign).toLowerCase().includes(productFilter.toLowerCase());
                    }

                    if (!matches) return;
                }

                // --- [بداية قاعدة الزمن - النسخة المصححة جراحياً] ---
                const sDate = this.parseSpendDate(s.date);
                if (!sDate) return;

                // توحيد التوقيت: تصفير الساعة لضمان مقارنة "يوم بيوم"
                sDate.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0); // تصفير وقت "الآن" أيضاً

                let isValidDate = true;

                if (dateFilter !== 'all') {
                    // حساب تاريخ البداية (Cutoff Date)
                    let cutoff = new Date(now);

                    switch (dateFilter) {
                        case 'day':
                            // اليوم الحالي فقط (تطابق تام)
                            // لا نغير cutoff لأنه مضبوط على اليوم 00:00
                            if (sDate.getTime() !== now.getTime()) isValidDate = false;
                            break;

                        case 'week':
                            // آخر 7 أيام
                            cutoff.setDate(now.getDate() - 7);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case 'month':
                            // آخر 30 يوم
                            cutoff.setDate(now.getDate() - 30);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case '3month':
                            // آخر 3 أشهر
                            cutoff.setMonth(now.getMonth() - 3);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case '6month':
                            // آخر 6 أشهر
                            cutoff.setMonth(now.getMonth() - 6);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case '9month':
                            // آخر 9 أشهر
                            cutoff.setMonth(now.getMonth() - 9);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case 'year':
                            // آخر سنة
                            cutoff.setFullYear(now.getFullYear() - 1);
                            if (sDate < cutoff) isValidDate = false;
                            break;

                        case 'custom':
                            // للفلاتر المخصصة: المقارنة شاملة (Inclusive)
                            if (startDate) {
                                const start = new Date(startDate);
                                start.setHours(0, 0, 0, 0);
                                if (sDate < start) isValidDate = false;
                            }
                            if (endDate) {
                                const end = new Date(endDate);
                                end.setHours(23, 59, 59, 999); // نهاية اليوم لضمان الاحتواء
                                if (sDate > end) isValidDate = false;
                            }
                            break;

                        // تجاهل الفلاتر الزمنية الدقيقة جداً (ساعة) عند حساب المصاريف اليومية
                        case 'hour':
                            // قاعدة: إذا الفلتر بالساعة، نظهر مصاريف "اليوم" كتقدير، أو نخفيها.
                            // هنا سنختار إظهار مصاريف اليوم الحالي فقط
                            if (sDate.getTime() !== now.getTime()) isValidDate = false;
                            break;
                    }
                }

                if (!isValidDate) return; // تخطي هذا المصروف لأنه خارج الفترة
                // --- [نهاية قاعدة الزمن] ---

                // const key = this.getSmartCampaignKey(s); // Already defined above
                if (!campaignsMap[key]) {
                    campaignsMap[key] = {
                        id: 'cmp-' + Math.random().toString(36).substr(2, 9),
                        name: s.campaign,
                        utm_id: s.utm_id,
                        total: 0, paid: 0, revenue: 0, spend: 0, impressions: 0, clicks: 0,
                        sources: new Set(), mediums: new Set(),
                        sourceMediumStats: {}, contentStats: {}, termStats: {}
                    };
                }
                const cmp = campaignsMap[key];

                cmp.spend += (parseFloat(s.spend) || 0);
                cmp.impressions += (parseInt(s.impressions) || 0);
                cmp.clicks += (parseInt(s.clicks) || 0);
            });
        }

        // 2. الترتيب
        let sortedCampaigns = Object.values(campaignsMap);
        sortedCampaigns.sort((a, b) => b.revenue - a.revenue || b.spend - a.spend);

        if (sortedCampaigns.length === 0) {
            this.clearCampaignsTable();
            return;
        }

        // [NEW] Store data for PDF Export
        this.currentMarketingData = sortedCampaigns;

        // 3. الرسم (نفس كود الرسم السابق بالضبط، لا تغيير في HTML)
        tbody.innerHTML = sortedCampaigns.map(c => {
            // الحسابات
            c.leads = c.total; // Alias for display and PDF
            const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '-';
            const cpc = c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : '-';
            const cpl = c.total > 0 ? (c.spend / c.total).toFixed(0) : '-';
            const cpa = c.paid > 0 ? (c.spend / c.paid).toFixed(0) : '-';
            const roas = c.spend > 0 ? (c.revenue / c.spend) : 0;
            const netProfit = c.revenue - c.spend;

            // تنسيق ROAS
            let roasBadge = '';
            if (c.spend === 0 && c.revenue > 0) roasBadge = '<span class="text-xs font-bold text-green-400">∞</span>';
            else if (roas >= 4) roasBadge = `<span class="px-2 py-0.5 rounded bg-green-900/20 text-green-400 font-bold border border-green-500/50">${roas.toFixed(2)}x</span>`;
            else if (roas >= 2) roasBadge = `<span class="px-2 py-0.5 rounded bg-yellow-900/20 text-yellow-400 font-bold border border-yellow-500/50">${roas.toFixed(2)}x</span>`;
            else if (c.spend > 0) roasBadge = `<span class="px-2 py-0.5 rounded bg-red-900/20 text-red-400 font-bold border border-red-500/50">${roas.toFixed(2)}x</span>`;
            else roasBadge = '<span class="text-slate-300">-</span>';

            // زر التوسيع
            const hasDetails = Object.keys(c.sourceMediumStats).length > 0;
            const expandBtn = hasDetails
                ? `<button onclick="document.getElementById('details-${c.id}').classList.toggle('hidden')" class="text-blue-400 hover:text-blue-400 p-1 bg-blue-900/20 rounded-full transition hover:bg-blue-900/20"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg></button>`
                : `<span class="w-6 h-6 block"></span>`;

            // تفاصيل الجداول الفرعية
            const renderSubTable = (dataObj, title, icon) => {
                const rows = Object.entries(dataObj).sort((a, b) => b[1].paid - a[1].paid).slice(0, 5);
                if (!rows.length) return '';
                return `
                <div class="bg-slate-900 text-white border rounded p-2 shadow-sm">
                    <h6 class="font-bold text-[10px] mb-2 flex items-center gap-1 text-slate-400">${icon} ${title}</h6>
                    <table class="w-full text-[10px]">
                        <thead class="bg-slate-800 border border-slate-700/50 text-slate-400"><tr><th class="text-right p-1">الاسم</th><th class="text-center p-1">Orders</th><th class="text-center p-1">Sales</th></tr></thead>
                        <tbody>${rows.map(r => `<tr><td class="p-1 truncate max-w-[80px]" title="${r[0]}">${r[0]}</td><td class="text-center text-slate-400">${r[1].count}</td><td class="text-center font-bold text-green-400">${r[1].paid}</td></tr>`).join('')}</tbody>
                    </table>
                </div>`;
            };

            const detailsContent = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    ${renderSubTable(c.sourceMediumStats, 'Sources', '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>')}
                    ${renderSubTable(c.contentStats, 'Creatives', '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>')}
                    ${renderSubTable(c.termStats, 'Keywords', '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"/></svg>')}
                </div>
            `;

            return `
            <tr class="border-b hover:bg-slate-800 border border-slate-700/50 transition-colors group">
                <td class="px-4 py-3 align-top flex items-start gap-2">
                    <div class="mt-1">${expandBtn}</div>
                    <div>
                        <div class="font-bold text-white text-sm" title="${c.name}">${this.sanitizeHTML(c.name).substring(0, 25)}</div>
                        <div class="text-[10px] text-slate-400 mt-0.5 font-mono">
                            ${c.impressions ? (c.impressions || 0).toLocaleString() + ' imp' : ''}
                        </div>
                    </div>
                </td>
                
                <td class="px-4 py-3 text-center align-middle">
                    <div class="text-xs font-bold text-white">${(c.leads || 0).toLocaleString()} <span class="text-[9px] font-normal text-slate-400">Orders</span></div>
                    <div class="text-[10px] text-slate-400 mt-0.5 font-mono">${(c.clicks || 0).toLocaleString()} Clicks</div>
                    <div class="text-[10px] ${parseFloat(ctr) > 1 ? 'text-green-400' : 'text-slate-400'} font-mono">CTR: ${ctr}%</div>
                </td>

                <td class="px-4 py-3 text-center align-middle">
                    <div class="text-sm font-bold text-white dir-ltr">${c.spend > 0 ? (c.spend || 0).toLocaleString() : '-'}</div>
                    <div class="text-[10px] text-slate-400 font-mono">CPC: ${cpc}</div>
                </td>

                <td class="px-4 py-3 text-center align-middle">
                    <div class="flex flex-col gap-1 items-center">
                        <span class="text-[10px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 border border-slate-700" title="Cost per Acquisition">CPA: ${cpl}</span>
                        <span class="text-[10px] px-1.5 py-0.5 bg-blue-900/20 rounded text-blue-400 border border-blue-100 font-bold" title="Cost per Acquisition">CPA: ${cpa}</span>
                    </div>
                </td>

                <td class="px-4 py-3 text-center align-middle">
                    ${roasBadge}
                </td>

                <td class="px-4 py-3 text-center align-middle bg-slate-800 border border-slate-700/50 group-hover:bg-blue-900/20 transition-colors">
                    <div class="font-bold text-blue-400 dir-ltr font-mono text-sm">${(c.revenue || 0).toLocaleString()}</div>
                    <div class="text-[10px] font-bold ${netProfit >= 0 ? 'text-green-400' : 'text-red-500'} dir-ltr">
                        ${netProfit > 0 ? '+' : ''}${(netProfit || 0).toLocaleString()}
                    </div>
                </td>
            </tr>
            <tr id="details-${c.id}" class="hidden bg-slate-800 border border-slate-700/50 border-b border-slate-700 shadow-inner">
                <td colspan="6" class="p-4">
                    ${detailsContent}
                </td>
            </tr>
            `;
        }).join('');
    }

    // ============================================================
    // renderAdPerformanceTable (Updated: With Budget Tracking 🟢🟡🔴)
    // ============================================================
    renderAdPerformanceTable(dataSet) {
        const tbody = document.getElementById('ad-performance-body');
        if (!tbody) return;

        // 1. إعداد التجميع
        const campaignsMap = {};
        // [NEW] Calculate Unit Costs
        const unitCosts = this.calculateCampaignUnitCosts();

        const getCmp = (name) => {
            const key = this.getSmartCampaignKey(name);
            if (!campaignsMap[key]) {
                campaignsMap[key] = {
                    name: name,
                    spend: 0, impressions: 0, clicks: 0, leads: 0,
                    revenue: 0, paid: 0 // [NEW] Financial metrics
                };
            }
            return campaignsMap[key];
        };

        // أ) جمع الليدز
        dataSet.forEach(item => {
            // Use getSmartCampaignKey with the item to leverage utm_id
            const key = this.getSmartCampaignKey(item);

            // Find config to check attribution
            const config = this.campaignConfig.find(c => this.getSmartCampaignKey(c) === key);

            if (!this.isLeadAttributedToCampaign(item, config)) return;

            if (!campaignsMap[key]) {
                campaignsMap[key] = {
                    name: item.utm_campaign || 'Organic',
                    utm_id: item.utm_id,
                    spend: 0, impressions: 0, clicks: 0, leads: 0,
                    revenue: 0, paid: 0
                };
            }
            const cmp = campaignsMap[key];

            // [NEW] Add Proportional Metrics
            if (unitCosts[key]) {
                cmp.spend += (unitCosts[key].cost || 0);
                cmp.impressions += (unitCosts[key].impressions || 0);
                cmp.clicks += (unitCosts[key].clicks || 0);
            }

            cmp.leads++;

            // [NEW] Aggregate Revenue
            if (item.status === 'delivered' || item.status === 'paid') {
                cmp.paid++;
                cmp.revenue += (parseFloat(item.finalAmount) || 0);
            }
        });

        // ب) جمع المصاريف (مع الفلترة الزمنية)
        const dateFilter = document.getElementById('date-filter')?.value || 'all';
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;

        if (this.spendData && Array.isArray(this.spendData)) {
            this.spendData.forEach(s => {
                if (!s.campaign) return;

                // [NEW] Skip if campaign is already in map (handled proportionally)
                const key = this.getSmartCampaignKey(s);
                if (campaignsMap[key]) return;

                // [NEW] Apply Global Filters to Spend Data (Ad Performance Table)
                const campaignFilter = document.getElementById('campaign-filter')?.value;
                const sourceFilter = document.getElementById('source-filter')?.value;
                const productFilter = document.getElementById('product-filter')?.value;

                if (campaignFilter && s.campaign !== campaignFilter) return;
                if (sourceFilter && s.source !== sourceFilter) return;

                // [NEW] Product Filter for Ad Performance
                if (productFilter) {
                    // Ensure map exists (it might not if renderCampaignsTable wasn't called first)
                    if (!this.campaignProductMap) {
                        this.campaignProductMap = {};
                        this.allData.forEach(item => {
                            const key = this.getSmartCampaignKey(item);
                            if (item.normalizedCourse) {
                                this.campaignProductMap[key] = item.normalizedCourse;
                            }
                        });
                    }

                    // const key = this.getSmartCampaignKey(s); // Already defined above
                    const campaignProduct = this.campaignProductMap[key];

                    let matches = (campaignProduct === productFilter);
                    if (!matches && !campaignProduct) {
                        matches = String(s.campaign).toLowerCase().includes(productFilter.toLowerCase());
                    }
                    if (!matches) return;
                }

                // منطق الزمن
                const sDate = this.parseSpendDate(s.date);
                if (!sDate) return;
                sDate.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                let isValidDate = true;
                if (dateFilter !== 'all') {
                    let cutoff = new Date(now);
                    switch (dateFilter) {
                        case 'day': if (sDate.getTime() !== now.getTime()) isValidDate = false; break;
                        case 'week': cutoff.setDate(now.getDate() - 7); if (sDate < cutoff) isValidDate = false; break;
                        case 'month': cutoff.setDate(now.getDate() - 30); if (sDate < cutoff) isValidDate = false; break;
                        case '3month': cutoff.setMonth(now.getMonth() - 3); if (sDate < cutoff) isValidDate = false; break;
                        case '6month': cutoff.setMonth(now.getMonth() - 6); if (sDate < cutoff) isValidDate = false; break;
                        case '9month': cutoff.setMonth(now.getMonth() - 9); if (sDate < cutoff) isValidDate = false; break;
                        case 'year': cutoff.setFullYear(now.getFullYear() - 1); if (sDate < cutoff) isValidDate = false; break;
                        case 'custom':
                            if (startDate && sDate < new Date(startDate).setHours(0, 0, 0, 0)) isValidDate = false;
                            if (endDate && sDate > new Date(endDate).setHours(23, 59, 59, 999)) isValidDate = false;
                            break;
                    }
                }
                if (!isValidDate) return;

                // const key = this.getSmartCampaignKey(s); // Already defined above
                if (!campaignsMap[key]) {
                    campaignsMap[key] = {
                        name: s.campaign,
                        utm_id: s.utm_id,
                        spend: 0, impressions: 0, clicks: 0, leads: 0,
                        revenue: 0, paid: 0
                    };
                }
                const cmp = campaignsMap[key];
                cmp.spend += (parseFloat(s.spend) || 0);
                cmp.impressions += (parseInt(s.impressions) || 0);
                cmp.clicks += (parseInt(s.clicks) || 0);
            });
        }

        const hasData = Object.values(campaignsMap).some(c => c.spend > 0 || c.leads > 0);
        if (!hasData) {
            tbody.innerHTML = `<tr><td colspan="12" class="text-center p-6 text-slate-400">لا توجد بيانات مطابقة للفلترة.</td></tr>`;
            return;
        }

        let sorted = Object.values(campaignsMap).filter(c => c.spend > 0 || c.leads > 0);
        sorted.sort((a, b) => b.spend - a.spend);

        // 3. الرسم (مع شريط الميزانية الجديد)
        // [NEW] Store data for PDF Export
        this.currentMarketingData = sorted; // Keep for compatibility if needed, but we should use specific props
        this.currentAdPerformanceData = sorted;

        tbody.innerHTML = sorted.map(c => {
            const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0.00';
            const cpm = c.impressions > 0 ? ((c.spend / c.impressions) * 1000).toFixed(2) : '0.00';
            const cpc = c.clicks > 0 ? (c.spend / c.clicks).toFixed(2) : '0.00';
            const cpl = c.leads > 0 ? (c.spend / c.leads).toFixed(0) : '-';
            const cvr = c.clicks > 0 ? ((c.leads / c.clicks) * 100).toFixed(2) : '0.00';
            const ctrClass = parseFloat(ctr) >= 1.0 ? 'text-green-400 font-bold' : 'text-slate-400';
            const cvrClass = parseFloat(cvr) >= 1.0 ? 'text-green-400' : 'text-slate-400';

            // --- [بداية الكود الجديد للميزانية] ---
            // البحث عن إعدادات الحملة في السجل
            // --- [بداية الكود الجديد للميزانية] ---
            const config = this.campaignConfig.find(conf =>
                this.getSmartCampaignKey(conf.name) === this.getSmartCampaignKey(c.name)
            );

            const budget = config ? parseFloat(config.budget || 0) : 0;
            const spend = Number(c.spend) || 0;

            // 👇 ضروري هاد السطر يكون قبل أي if
            let spendDisplay = '';

            if (budget > 0) {

                const rawPercent = (spend / budget) * 100;
                const percent = Math.min(rawPercent, 100);
                const actualPercent = Number(rawPercent.toFixed(1));

                let barColor = 'bg-green-500';
                if (actualPercent > 90) barColor = 'bg-red-600';
                else if (actualPercent > 70) barColor = 'bg-yellow-500';

                spendDisplay = `
    <div class="w-full min-w-[120px]">
        <div class="flex justify-between text-[10px] mb-1">
            <span class="font-bold text-white dir-ltr">${spend.toLocaleString()}</span>
            <span class="text-slate-500 dir-ltr">/ ${budget.toLocaleString()}</span>
        </div>

        <div class="w-full bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div class="${barColor} h-1.5 rounded-full transition-all duration-500"
                 style="width: ${percent}%"></div>
        </div>

        <div class="text-[9px] text-right mt-0.5 ${actualPercent > 100 ? 'text-red-400 font-bold' : 'text-slate-400'}">
            ${actualPercent}% مستهلك
        </div>
    </div>`;

            } else if (spend > 0) {

                spendDisplay = `
    <div class="flex flex-col">
        <span class="font-bold text-blue-400 dir-ltr">
            ${spend.toLocaleString()}
        </span>
        <span class="text-[12px] text-orange-400 italic mt-1">
         ⚠️ لا توجد ميزانية مرصودة لهذه الحملة
        </span>
    </div>`;

            } else {

                spendDisplay = `
    <span class="text-slate-400 text-[10px] italic">
        لا توجد بيانات صرف
    </span>`;
            }
            // --- [نهاية الكود الجديد للميزانية] ---


            // --- [نهاية الكود الجديد للميزانية] ---

            return `
            <tr class="hover:bg-blue-900/20 transition-colors border-b border-blue-800/50">
                <td class="px-4 py-3 font-bold text-white text-right">${this.sanitizeHTML(c.name)}</td>
                <td class="px-4 py-3 text-center font-mono text-slate-400 text-xs">${(c.impressions || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-center font-mono text-slate-400 text-xs">${cpm}</td>
                <td class="px-4 py-3 text-center font-mono text-slate-400 text-xs">${(c.clicks || 0).toLocaleString()}</td>
                <td class="px-4 py-3 text-center dir-ltr"><span class="${ctrClass} text-xs">${ctr}%</span></td>
                <td class="px-4 py-3 text-center dir-ltr"><span class="bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded text-xs font-mono">${cpc}</span></td>
                
                <td class="px-4 py-3 text-center align-middle">
                    ${spendDisplay}
                </td>
                
                <td class="px-4 py-3 text-center align-middle">
                    <div class="text-xs font-bold text-white">${(c.leads || 0).toLocaleString()} <span class="text-[9px] font-normal text-slate-400">Orders</span></div>
                    <div class="mt-1 flex gap-1 justify-center flex-wrap">
                        <span class="text-[10px] px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-400 border border-slate-700" title="Cost per Acquisition">CPA: ${cpl}</span>
                        <span class="text-[10px] px-1.5 py-0.5 bg-blue-900/20 rounded ${cvrClass} border border-blue-900/30" title="Conversion Rate (Orders/Clicks)">CVR: ${cvr}%</span>
                    </div>
                </td>

                <td class="px-4 py-3 text-center align-middle bg-slate-800/50 border-l border-slate-700/50">
                    <div class="font-bold text-emerald-400 dir-ltr font-mono text-xs">${(c.revenue || 0).toLocaleString()}</div>
                    <div class="text-[10px] font-bold text-slate-400 dir-ltr mt-0.5">ROAS: <span class="${(c.revenue / c.spend) >= 2 ? 'text-emerald-400' : 'text-yellow-400'}">${c.spend > 0 ? (c.revenue / c.spend).toFixed(2) + 'x' : '-'}</span></div>
                    <div class="text-[9px] text-slate-100 dir-ltr mt-0.5">Net: ${(c.revenue - c.spend).toLocaleString()}</div>
                </td>
            `;
        }).join('');
    }

    clearCampaignsTable() {
        const tbody = document.getElementById('top-campaigns-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-slate-400">لا توجد بيانات حملات لعرضها.</td></tr>`;
    }

    // دالة رسم الشارت العامة (Generic Chart Renderer)
    renderChart(canvasId, chartKey, type, data, extraOptions = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return; // حماية ضد الأخطاء إذا لم يوجد العنصر

        const ctx = canvas.getContext('2d');

        // تدمير الشارت القديم إذا وجد لتجنب تراكب الرسومات (Glitch)
        if (this.charts[chartKey]) {
            this.charts[chartKey].destroy();
        }

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { font: { family: 'Cairo' } } },
                tooltip: { titleFont: { family: 'Cairo' }, bodyFont: { family: 'Cairo' } }
            }
        };

        this.charts[chartKey] = new Chart(ctx, {
            type: type,
            data: data,
            options: { ...defaultOptions, ...extraOptions }
        });
    }

    // ============================================================
    // 7. Split Stats Cards (البطاقات المقسمة)
    // ============================================================
    renderSplitStatsCards(overall, filtered) {
        // تحديث العمود الأيمن (الإجمالي)
        this.renderRevCard('revenue-stats-breakdown', overall);
        this.renderSimpleCard('total-payments-stats', overall.totalTx, overall.cashplusCount, overall.cardCount, 'text-white');
        this.renderSimpleCard('paid-payments-stats', overall.deliveredTx + overall.paidTx, overall.paid_cashplus, overall.paid_card, 'text-green-400');
        this.renderSimpleCard('pending-payments-stats', overall.pendingTx, 0, 0, 'text-yellow-400');
        this.renderSimpleCard('confirmed-payments-stats', overall.confirmedTx, 0, 0, 'text-teal-400');
        this.renderSimpleCard('canceled-payments-stats', overall.cancelledTx, 0, 0, 'text-red-400');

        // تحديث العمود الأيسر (المفلتر)
        this.renderRevCard('filtered-revenue-stats-breakdown', filtered);
        this.renderSimpleCard('filtered-total-payments-stats', filtered.totalTx, filtered.cashplusCount, filtered.cardCount, 'text-white');
        this.renderSimpleCard('filtered-paid-payments-stats', filtered.deliveredTx + filtered.paidTx, filtered.paid_cashplus, filtered.paid_card, 'text-green-400');
        this.renderSimpleCard('filtered-pending-payments-stats', filtered.pendingTx, 0, 0, 'text-yellow-400');
        this.renderSimpleCard('filtered-confirmed-payments-stats', filtered.confirmedTx, 0, 0, 'text-teal-400');
        this.renderSimpleCard('filtered-canceled-payments-stats', filtered.cancelledTx, 0, 0, 'text-red-400');
    }

    renderRevCard(id, s) {
        const el = document.getElementById(id);
        if (!el) return;

        // 1. الحسابات الأساسية للإجمالي والنسبة العامة
        const total = s.deliveredRevenue + s.paidRevenue + s.confirmedRevenue + s.pendingRevenue + s.cancelledRevenue;
        const pct = total > 0 ? ((s.deliveredRevenue / total) * 100).toFixed(1) : 0;

        // 2. حساب إجمالي الإيرادات المدفوعة من جميع القنوات
        const totalPaidMethods = (s.net_cashplus_revenue || 0) +
            (s.net_card_revenue || 0) +
            (s.net_cash_revenue || 0) +
            (s.net_bank_revenue || 0);

        // 3. حساب النسب المئوية لكل طريقة دفع
        const cpPercent = totalPaidMethods > 0 ? ((s.net_cashplus_revenue / totalPaidMethods) * 100).toFixed(1) : 0;
        const cardPercent = totalPaidMethods > 0 ? ((s.net_card_revenue / totalPaidMethods) * 100).toFixed(1) : 0;
        const cashPercent = totalPaidMethods > 0 ? ((s.net_cash_revenue / totalPaidMethods) * 100).toFixed(1) : 0;
        const bankPercent = totalPaidMethods > 0 ? ((s.net_bank_revenue / totalPaidMethods) * 100).toFixed(1) : 0;

        // 4. تنسيق الأرقام للعرض (أضفنا فواصل الآلاف)
        const fNet = s.deliveredRevenue.toLocaleString();
        const fPaid = s.paidRevenue.toLocaleString();
        const fConfirmed = s.confirmedRevenue.toLocaleString();
        const fPending = s.pendingRevenue.toLocaleString();
        const fCanceled = s.cancelledRevenue.toLocaleString();

        const fCashplus = (s.net_cashplus_revenue || 0).toLocaleString();
        const fCard = (s.net_card_revenue || 0).toLocaleString();
        const fCash = (s.net_cash_revenue || 0).toLocaleString();
        const fBank = (s.net_bank_revenue || 0).toLocaleString();

        // 5. بناء HTML البطاقة
        el.innerHTML = `
        <div class="text-3xl font-bold text-green-400 mt-2" title="إيرادات تم تسليمها">
            ${fNet} MAD 
            <span class="text-lg text-green-400/80">(${pct}%)</span>
        </div>
        
        <div class="mt-2 text-xs text-slate-400 space-y-1 border-t border-slate-700/50 pt-2">
            <div class="flex justify-between"><span>مدفوع (Paid):</span> <span class="font-medium text-blue-400">${fPaid} MAD</span></div>
            <div class="flex justify-between"><span>مؤكد (Confirmed):</span> <span class="font-medium text-teal-400">${fConfirmed} MAD</span></div>
            <div class="flex justify-between"><span>معلق (Pending):</span> <span class="font-medium text-yellow-400">${fPending} MAD</span></div>
            <div class="flex justify-between"><span>ملغي/فاشل (Canceled):</span> <span class="font-medium text-red-400">${fCanceled} MAD</span></div>
        </div>

        <div class="mt-3 text-xs text-slate-400 border-t border-slate-700/50 pt-2 bg-slate-800 border border-slate-700/50 p-2 rounded space-y-1">
            <div class="flex justify-between mb-2"><span class="text-sm font-bold text-white">توزيع الإيرادات:</span></div>
            
            <div class="flex justify-between items-center">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-yellow-500"></span> كاش بلوس:</span> 
                <span class="font-medium">${fCashplus} MAD <span class="text-slate-500 text-[10px]">(${cpPercent}%)</span></span>
            </div>

            <div class="flex justify-between items-center">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-600"></span> بطاقة بنكية:</span> 
                <span class="font-medium">${fCard} MAD <span class="text-slate-500 text-[10px]">(${cardPercent}%)</span></span>
            </div>

            <div class="flex justify-between items-center">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span> نقد (Cash):</span> 
                <span class="font-medium">${fCash} MAD <span class="text-slate-500 text-[10px]">(${cashPercent}%)</span></span>
            </div>

            <div class="flex justify-between items-center">
                <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500"></span> تحويل بنكي:</span> 
                <span class="font-medium">${fBank} MAD <span class="text-slate-500 text-[10px]">(${bankPercent}%)</span></span>
            </div>
        </div>`;
    }

    renderSimpleCard(id, t, cp, card, color) {
        const el = document.getElementById(id);
        if (!el) return;
        const tm = cp + card;
        const breakdown = t > 0 ? `<div class="mt-2 text-xs text-slate-400"><div class="flex justify-between"><span>كاش بلوس:</span> <span>${cp}</span></div><div class="flex justify-between"><span>بطاقة بنكية:</span> <span>${card}</span></div></div>` : '';
        el.innerHTML = `<div class="text-3xl font-bold ${color} mt-2">${t}</div>${breakdown}`;
    }

    // ============================================================
    // 8. Table Renderer (جدول البيانات)
    // ============================================================
    // ============================================================
    // استبدل دالة renderTable بهذه النسخة المحدثة
    // ============================================================
    renderTable() {
        const tbody = document.getElementById('table-body');
        if (!tbody) return;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const paged = this.filteredData.slice(start, start + this.itemsPerPage);

        if (paged.length === 0) {
            tbody.innerHTML = `<tr><td colspan="24" class="text-center p-10 text-slate-400">لا توجد بيانات مطابقة للبحث.</td></tr>`;
            this.updatePagination();
            return;
        }

        const renderPopoverTrigger = ({ label, icon, value, variant }) => {
            if (!value) return '';
            const rawText = value.trim();
            if (!rawText) return '';
            
            const titleHtml = `${icon ? icon + ' ' : ''}${label}`;
            // Use this.escapeHtml to prevent breaking HTML attributes
            const safeContent = this.escapeHtml(rawText);
            
            if (variant === 'address') {
                if (rawText.length <= 25) {
                    return `<div class="whitespace-nowrap text-slate-400 overflow-hidden text-ellipsis">${this.escapeHtml(rawText)}</div>`;
                }
                return `
                    <div class="whitespace-nowrap text-slate-400 overflow-hidden text-ellipsis cursor-pointer hover:text-slate-200 transition-colors flex items-center gap-1 group" 
                         data-popover-title="${this.escapeHtml(titleHtml)}"
                         data-popover-content="${safeContent}"
                         onclick="dashboard.showPopover(event, this)">
                        ${this.escapeHtml(rawText.substring(0, 25))}... 
                        <span class="opacity-50 group-hover:opacity-100 text-[10px]">▾</span>
                    </div>
                `;
            } 
            
            if (variant === 'note') {
                return `
                    <button type="button" 
                        class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors bg-blue-900/20 text-blue-400 hover:bg-blue-900/40 border border-blue-900/30 outline-none"
                        data-popover-title="${this.escapeHtml(titleHtml)}"
                        data-popover-content="${safeContent}"
                        onclick="dashboard.showPopover(event, this)">
                        <span class="text-xs">💬</span> Note
                    </button>
                `;
            }

            if (variant === 'delivery') {
                return `
                    <button type="button" 
                        class="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold transition-colors bg-slate-800/40 text-slate-400 hover:bg-slate-700/60 border border-slate-700/40 outline-none"
                        data-popover-title="${this.escapeHtml(titleHtml)}"
                        data-popover-content="${safeContent}"
                        onclick="dashboard.showPopover(event, this)">
                        <span class="text-xs">🚚</span> Delivery
                    </button>
                `;
            }
            
            return '';
        };

        tbody.innerHTML = paged.map((item, idx) => {
            const globalIdx = start + idx;
            const statusInfo = this.getStatusInfo(item.status);
            const pm = (item.paymentMethod || '').toLowerCase();

            // --- منطق عرض طريقة الدفع الجديد ---
            let paymentMethodText = 'أخرى';
            let paymentCodeDisplay = '';

            if (pm === 'cashplus') {
                paymentMethodText = 'كاش بلوس';
                paymentCodeDisplay = `<div class="text-xs text-slate-400 font-mono mt-0.5">CP Code: ${this.sanitizeHTML(item.cashplusCode || '-')}</div>`;
            } else if (pm === 'card' || pm === 'credit_card') {
                paymentMethodText = 'بطاقة ائتمانية';
                paymentCodeDisplay = `<div class="text-xs text-slate-400 font-mono mt-0.5">Card: **** ${this.sanitizeHTML(item.last4 || '-')}</div>`;
            } else if (pm === 'cash') {
                paymentMethodText = '<span class="text-green-400 flex items-center justify-end gap-1">نقد (Cash) <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg></span>';
                paymentCodeDisplay = `<div class="text-xs text-slate-400 font-mono mt-0.5 bg-slate-800 border border-slate-700 rounded px-1 inline-block">${this.sanitizeHTML(item.cashplusCode || '-')}</div>`;
            } else if (pm.includes('bank') || pm === 'virement') {
                paymentMethodText = '<span class="text-blue-600 flex items-center justify-end gap-1">تحويل بنكي <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg></span>';
                paymentCodeDisplay = `<div class="text-xs text-slate-400 font-mono mt-0.5 bg-slate-800 border border-slate-700 rounded px-1 inline-block">${this.sanitizeHTML(item.cashplusCode || '-')}</div>`;
            }

            // دالة مساعدة صغيرة لإنشاء البطاقات (Chips)
            const createBadge = (label, value, colorClass) => {
                if (!value || value === 'undefined') return '';
                // تقصير النصوص الطويلة جداً
                const cleanValue = this.sanitizeHTML(value);
                const shortValue = cleanValue.length > 15 ? cleanValue.substring(0, 15) + '..' : cleanValue;

                return `
    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${colorClass} border border-opacity-20 border-slate-600 whitespace-nowrap" title="${label}: ${cleanValue}">
        <span class="opacity-50 mr-1">${label}:</span> ${shortValue}
    </span>`;
            };

            // تجميع البطاقات
            let utmBadges = `
    <div class="flex flex-wrap gap-1.5 justify-start max-w-[200px]">
        ${createBadge('Camp', item.utm_campaign, 'bg-blue-50 text-blue-400')}
        ${createBadge('Src', item.utm_source, 'bg-blue-900/20 text-blue-400')}
        ${createBadge('Med', item.utm_medium, 'bg-blue-50 text-blue-700')}
        ${createBadge('Term', item.utm_term, 'bg-slate-800 border border-slate-700/50 text-slate-400')}
        ${createBadge('Cnt', item.utm_content, 'bg-pink-50 text-pink-700')}
    </div>
`;

            // إذا لم تكن هناك أي بيانات تتبع، نعرض شرطة
            if (!item.utm_campaign && !item.utm_source) utmBadges = '<span class="text-slate-300">-</span>';

            // -- Popover UI Logic --
            const addressHtml = renderPopoverTrigger({
                label: 'Adresse',
                icon: '📍',
                value: item.clientAddress,
                variant: 'address'
            }) || '<span class="text-slate-500 italic">-</span>';

            const noteHtml = renderPopoverTrigger({
                label: 'Note',
                icon: '💬',
                value: item.note,
                variant: 'note'
            });

            const deliveryNoteHtml = renderPopoverTrigger({
                label: 'Delivery Note',
                icon: '🚚',
                value: item.deliveryNote || item.delivery_note,
                variant: 'delivery'
            });

            // --- Lifecycle Events Logic ---
            let lifecycleHtml = '';
            if (item.lifecycle_events && item.lifecycle_events.length > 0) {
                const failedEvents = item.lifecycle_events.filter(e => e.status === 'failed');
                const processingEvents = item.lifecycle_events.filter(e => e.status === 'processing');
                if (failedEvents.length > 0) {
                    const latestFail = failedEvents[0];
                    const safeErr = this.escapeHtml(latestFail.error_details || 'Unknown Error');
                    const popoverHtml = `
                        <div class="text-xs">
                            <p><strong>Type:</strong> ${latestFail.event_type}</p>
                            <p class="text-red-400 mt-1"><strong>Error:</strong> ${safeErr}</p>
                            <p class="mt-1"><strong>Attempts:</strong> ${latestFail.attempt_count || 0}</p>
                            <button onclick="dashboard.retryLifecycle('${latestFail.event_type}', '${item.id}')" class="mt-3 w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 px-2 rounded border border-slate-500 transition-colors flex items-center justify-center gap-1">
                                🔄 Retry Message
                            </button>
                        </div>
                    `.replace(/"/g, '&quot;');

                    lifecycleHtml = `
                        <div class="mt-1">
                            <button type="button" class="text-red-400 bg-red-900/20 px-1.5 py-0.5 rounded border border-red-500/30 text-[9px] hover:bg-red-900/40 outline-none flex items-center gap-1"
                                data-popover-title="⚠️ WhatsApp Failed"
                                data-popover-content="${popoverHtml}"
                                onclick="dashboard.showPopover(event, this)">
                                ⚠️ WA Error
                            </button>
                        </div>
                    `;
                } else if (processingEvents.length > 0) {
                    lifecycleHtml = `<div class="mt-1"><span class="text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-500/30 text-[9px]" title="Processing API request...">⏳ WA Processing</span></div>`;
                }
            }

            return `
        <tr class="hover:bg-slate-800 border border-slate-700/50 border-b border-slate-700/50 transition-colors">
            <!-- 1. Date -->
            <td class="px-2.5 py-2.5 whitespace-nowrap text-[11px] text-slate-300 align-middle">
                ${this.formatDate(item.timestamp)}
                <div class="mt-0.5">${item.isExternal ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-900/40 text-purple-400 border border-purple-500/30">🌍 خارجي</span>' : '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-900/40 text-emerald-400 border border-emerald-500/30">📦 داخلي</span>'}</div>
            </td>
            
            <!-- 2. Statut -->
            <td class="px-2.5 py-2.5 align-middle">
                <span class="px-2 py-0.5 text-[10px] font-semibold rounded-full ${statusInfo.class} whitespace-nowrap">${statusInfo.text}</span>
                ${lifecycleHtml}
                ${(item.status === 'cancelled' || item.status === 'canceled') && (item.deliveryNote || item.delivery_note) ? `<div class="mt-1 text-[9px] text-red-400 max-w-[120px] whitespace-normal bg-red-900/10 p-1 rounded border border-red-900/30 leading-tight">السبب: ${this.sanitizeHTML(item.deliveryNote || item.delivery_note)}</div>` : ''}
            </td>
            
            <!-- 3. Identifiants -->
            <td class="px-2.5 py-2.5 text-xs text-slate-400 font-mono align-middle min-w-[100px]">
                <div class="font-bold text-white text-[11px]">${this.sanitizeHTML(item.orderId)}</div>
                ${item.transactionId ? `<div class="text-slate-500 mt-0.5 text-[9px]">${this.sanitizeHTML(item.transactionId)}</div>` : ''}
            </td>
            
            <!-- 4. Client -->
            <td class="px-2.5 py-2.5 text-xs align-middle min-w-[120px]">
                <div class="font-bold text-white text-[11px] text-right truncate max-w-[140px]">${this.sanitizeHTML(item.customerName)}</div>
                ${item.customerEmail && item.customerEmail !== '-' ? `<div class="text-slate-400 text-[10px] text-right truncate max-w-[140px]">${this.sanitizeHTML(item.customerEmail)}</div>` : ''}
            </td>
            
            <!-- 5. Téléphone -->
            <td class="px-2.5 py-2.5 text-[11px] text-slate-300 font-mono text-right align-middle whitespace-nowrap" dir="ltr">${this.sanitizeHTML(item.customerPhone)}</td>
            
            <!-- 6. المنتج & SKU -->
            <td class="px-2.5 py-2.5 text-xs text-right align-middle min-w-[140px]">
                <div class="flex flex-col gap-0.5 items-end">
                    <span class="text-white font-bold text-[11px] truncate max-w-[150px]" title="${this.sanitizeHTML(item.productTitle || item.normalizedCourse || 'Dermossence')}">${this.sanitizeHTML(item.productTitle || item.normalizedCourse || 'Dermossence')}</span>
                    <div class="flex gap-1 flex-wrap justify-end">
                        ${item.productSku ? `<span class="text-[9px] font-mono px-1 py-0.5 bg-slate-700 rounded text-slate-300">SKU: ${this.sanitizeHTML(item.productSku)}</span>` : ''}
                        ${item.language ? `<span class="text-[9px] px-1 py-0.5 rounded bg-slate-600 text-slate-200 uppercase">${this.sanitizeHTML(item.language)}</span>` : ''}
                    </div>
                </div>
            </td>
            
            <!-- 7. الكمية (Quantité) -->
            <td class="px-2.5 py-2.5 text-xs text-center align-middle">
                <span class="font-bold text-white bg-slate-800 border border-slate-700 px-1.5 py-0.5 rounded text-[11px]">×${this.sanitizeHTML(String(item.quantity || 1))}</span>
            </td>
            
            <!-- 8. العنوان (Adresse) -->
            <td class="px-2.5 py-2.5 text-[11px] text-slate-400 max-w-[140px] align-middle">${addressHtml}</td>
            
            <!-- 9. Campagne -->
            <td class="px-2.5 py-2.5 text-[10px] text-right align-middle max-w-[120px]" dir="ltr">${utmBadges}</td>
            
            <!-- 10. Montant -->
            <td class="px-2.5 py-2.5 text-xs font-bold text-slate-300 text-left align-middle whitespace-nowrap" dir="ltr">MAD ${this.sanitizeHTML(String(item.finalAmount))}</td>
            
            <!-- 11. Mode de paiement -->
            <td class="px-2.5 py-2.5 text-xs text-right align-middle min-w-[100px]">
                <div class="font-bold text-emerald-400 text-[10px]">${paymentMethodText}</div>
                ${paymentCodeDisplay}
            </td>
            
            <!-- 12. Notes -->
            <td class="px-2.5 py-2.5 text-xs text-right align-middle w-auto min-w-[80px]">
                ${(!item.note && !(item.deliveryNote || item.delivery_note)) ? '<span class="text-slate-500 italic">-</span>' : 
                 `<div class="flex flex-wrap items-center justify-end gap-1">
                     ${noteHtml}
                     ${deliveryNoteHtml}
                  </div>`}
            </td>
            
            <!-- 13. Dernière mise à jour -->
            <td class="px-2.5 py-2.5 text-[10px] text-slate-400 text-right italic dir-ltr align-middle min-w-[80px] truncate max-w-[100px]">
                ${this.sanitizeHTML(item.lastUpdatedBy || '-')}
            </td>
            
            <!-- 14. Actions -->
            <td class="px-2.5 py-2.5 text-center align-middle w-16">
                <div class="flex justify-center gap-1.5">
                    <button onclick="dashboard.editRow(${globalIdx})" class="text-blue-400 hover:text-blue-300 transition-colors bg-blue-900/20 p-1 rounded outline-none" title="تعديل">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                    </button>
                    <button onclick="dashboard.showConfirmDelete(${globalIdx})" class="text-red-400 hover:text-red-300 transition-colors bg-red-900/20 p-1 rounded outline-none" title="حذف">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </div>
            </td>
        </tr>`;
        }).join('');
        this.updatePagination();
        // هذا السطر هو الحل السحري للمشكلة
        this.applyPermissionsUI();
    }

    // ============================================================
    // (NEW) Invitation System
    // ============================================================
    async retryLifecycle(eventType, orderId) {
        let popover = document.getElementById('global-popover');
        if (popover) popover.style.display = 'none';
        
        this.showNotification('Initiating WhatsApp retry...', 'info');
        try {
            const res = await fetch(`${this.API_URL}?action=lifecycle-retry`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                body: JSON.stringify({ event_type: eventType, order_id: orderId })
            });
            const data = await res.json();
            if (data.success) {
                this.showNotification('Retry dispatched successfully.', 'success');
                // Refresh data to show processing/sent state
                this.fetchAllData();
            } else {
                this.showNotification(data.error || 'Retry failed', 'error');
            }
        } catch (e) {
            console.error('Retry error:', e);
            this.showNotification('Network error during retry', 'error');
        }
    }

    // Dermossence: Order follow-up note
    showInviteModal(idx) {
        const row = this.filteredData[idx];
        if (!row) return;
        const h = `
        <div class="space-y-3 text-right" dir="rtl">
            <div class="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <div class="text-xs text-slate-400">العميل</div>
                <div class="font-bold text-white">${this.escapeHtml(row.customerName)}</div>
                <div class="text-xs text-slate-400 font-mono mt-1">${this.escapeHtml(row.customerPhone)}</div>
                <div class="text-xs text-slate-400 mt-1"> ${this.escapeHtml(row.normalizedCourse || row.productSku || row.productTitle || 'Unknown')} — ×${row.quantity || 1}</div>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 block mb-1">ملاحظة المتابعة / سبب الإلغاء</label>
                <textarea id="followup-note" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:ring-1 focus:ring-blue-500" placeholder="اكتب ملاحظة المتابعة أو سبب الإلغاء هنا...">${this.escapeHtml(row.deliveryNote || row.delivery_note || '')}</textarea>
            </div>
            <div>
                <label class="text-xs font-bold text-slate-400 block mb-1">تحديث حالة الطلب</label>
                <select id="followup-status" class="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded focus:ring-1 focus:ring-blue-500">
                    <option value="">— الحالة الحالية: ${this.getStatusInfo(row.status).text} —</option>
                    <option value="pending">⏳ Pending (معلق)</option>
                    <option value="confirmed">✅ Confirmed (مؤكد)</option>
                    <option value="delivered">📦 Delivered (تم التسليم)</option>
                    <option value="paid">💳 Paid (مدفوع)</option>
                    <option value="cancelled">❌ Canceled (ملغي)</option>
                </select>
            </div>
        </div>`;
        const act = `
        <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 text-slate-400 rounded hover:bg-slate-700">إلغاء</button>
        <button id="save-followup" class="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 font-bold">💾 حفظ</button>`;
        const modal = this.createModal('متابعة الطلب', h, act);
        modal.querySelector('#save-followup').onclick = async () => {
            const newStatus = modal.querySelector('#followup-status').value || row.status;
            const noteText = modal.querySelector('#followup-note').value.trim();

            const payload = {
                originalOrderId: row.orderId,
                status: newStatus
            };
            if (noteText || noteText === '') {
                payload.deliveryNote = noteText;
            }

            try {
                const res = await fetch(this.API_URL, {
                    method: 'PUT',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });
                if (res.ok) { this.showNotification('تم تحديث حالة الطلب ✅', 'success'); modal.remove(); this.fetchAllData(); }
                else this.showNotification('فشل التحديث', 'error');
            } catch (e) { this.showNotification(e.message, 'error'); }
        };
    }

    // sendInvitation removed — replaced by showInviteModal order follow-up

    updatePagination() {
        const total = Math.max(1, Math.ceil(this.filteredData.length / this.itemsPerPage));
        const info = document.getElementById('page-info');
        if (info) info.textContent = `الصفحة ${this.currentPage} من ${total}`;

        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');

        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === total;

        // إضافة تنسيق بصري للأزرار المعطلة
        [prevBtn, nextBtn].forEach(btn => {
            if (btn && btn.disabled) btn.classList.add('opacity-50', 'cursor-not-allowed');
            else if (btn) btn.classList.remove('opacity-50', 'cursor-not-allowed');
        });
    }

    changePage(dir) {
        this.currentPage += dir;
        this.renderTable();
    }

    // ============================================================
    // 9. Helpers & Utilities
    // ============================================================
    createProductLookupMap() { return {}; } // unused in Dermossence
    normalizeProductName(raw) {
        if (!raw) return 'Dermossence';
        return String(raw).trim() || 'Dermossence';
    }

    parseDate(ts) {
        if (!ts) return null;
        let d;

        // 1. المحاولة الأولى: قراءة التنسيق المخصص (h min s)
        try {
            const cleaned = String(ts).replace(" h ", ":").replace(" min ", ":").replace(" s", "");
            d = new Date(cleaned);
            if (!isNaN(d.getTime())) return d;
        } catch (e) { }

        // 2. المحاولة الثانية: الصيغة القياسية ISO
        d = new Date(ts);
        if (!isNaN(d.getTime())) return d;

        // 3. المحاولة الثالثة: الصيغة الأوروبية DD/MM/YYYY (هام جداً للتطابق مع الباكند)
        if (typeof ts === 'string' && ts.includes('/')) {
            let datePart = ts;
            let timePart = '';

            if (ts.includes(' ')) {
                const split = ts.split(' ');
                datePart = split[0];
                timePart = split.slice(1).join(' ');
            }

            const parts = datePart.split('/');
            if (parts.length === 3) {
                let h = 0, m = 0, s = 0;
                if (timePart) {
                    const tParts = timePart.split(':');
                    h = parseInt(tParts[0] || 0);
                    m = parseInt(tParts[1] || 0);
                    s = parseInt(tParts[2] || 0);
                }
                // (اليوم، الشهر-1، السنة، الساعة، الدقيقة، الثانية)
                d = new Date(parts[2], parts[1] - 1, parts[0], h, m, s);
                if (!isNaN(d.getTime())) return d;
            }
        }

        return null;
    }

    formatDate(ts) {
        // ... (باقي الكود لم يتغير)
        if (!ts) return "N/A";
        let date;
        const isoTest = new Date(ts);
        if (!isNaN(isoTest.getTime())) {
            date = isoTest;
        } else {
            let cleaned = ts.replace(" h ", ":").replace(" min ", ":").replace(" s", "");
            date = new Date(cleaned);
        }
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('ar-MA', {
                year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        }
        return ts;
    }

    // دالة لتحويل الكود البرمجي إلى نص عربي مقروء
    getExperienceLabel(code) {
        const map = {
            'less_than_5': 'أقل من 5 سنوات',
            'between_5_10': 'بين 5 و 10 سنوات',
            'more_than_10': 'أكثر من 10 سنوات',
            'غير محدد': 'غير محدد'
        };
        return map[code] || code; // إرجاع النص العربي أو الكود الأصلي إذا لم يوجد
    }

    getQualificationLabel(code) {
        const map = {
            'technician': 'تقني (Technician)',
            'engineer': 'مهندس (Engineer)',
            'master': 'ماستر (Master)',
            'license': 'إجازة (License)',
            'doctorate': 'دكتوراه (Doctorate)',
            'bac': 'باكالوريا (Bac)',
            'student': 'طالب (Student)',
            'other': 'آخر (Other)'
        };
        // If not in map, return the code itself (capitalized) instead of "Undefined"
        // This helps identify what the actual data is
        return map[code] || (code && code !== 'undefined' ? code : 'غير محدد');
    }

    // دالة ذكية لمعالجة تاريخ المصاريف (تقبل YYYY-MM-DD و DD/MM/YYYY)
    parseSpendDate(dateStr) {
        if (!dateStr) return null;
        // محاولة 1: الصيغة القياسية (YYYY-MM-DD)
        let d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;

        // محاولة 2: الصيغة الشائعة في الإكسل (DD/MM/YYYY)
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                // ملاحظة: الشهر في جافاسكريبت يبدأ من 0
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }
        return null;
    }

    getStatusInfo(s) {
        if (s === 'paid') return { text: 'مدفوع', class: 'bg-green-900/20 text-green-400' };
        if (s === 'confirmed') return { text: 'مؤكد', class: 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' };
        if (s === 'pending' || s === 'pending_cashplus') return { text: 'معلق', class: 'bg-yellow-900/20 text-yellow-400' };
        if (s === 'failed' || s === 'canceled' || s === 'cancelled') return { text: 'ملغي', class: 'bg-slate-800 border border-slate-700 text-slate-400' };
        return { text: s, class: 'bg-slate-800 border border-slate-700 text-white' };
    }

    sanitizeHTML(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // دالة توحيد أسماء الحملات للمطابقة الذكية
    getSmartCampaignKey(campaignOrName) {
        if (!campaignOrName) return 'organic_direct';

        // If object with utm_id, use it as primary key
        if (typeof campaignOrName === 'object' && campaignOrName.utm_id) {
            return String(campaignOrName.utm_id).trim();
        }

        // Fallback to name-based matching
        const name = typeof campaignOrName === 'object' ? campaignOrName.name || campaignOrName.utm_campaign : campaignOrName;

        if (!name) return 'organic_direct';
        // 1. تحويل لحروف صغيرة
        // 2. استبدال الشرطات (-) والشرطات السفلية (_) بمسافات أو إزالتها
        // 3. حذف أي رموز غير أبجدية رقمية للمقارنة فقط
        return String(name)
            .toLowerCase()
            .replace(/[-_]/g, '') // يحول summer-offer و summer_offer إلى summeroffer
            .replace(/\s+/g, '')  // يحول summer offer إلى summeroffer
            .trim();
    }

    // ============================================================
    // (NEW) دالة التحقق من النطاق الزمني للحملة (Attribution Window)
    // ============================================================
    isLeadAttributedToCampaign(lead, campaignConfig) {
        if (!campaignConfig) return true;

        // 1. Strict Match by utm_id
        if (lead.utm_id && campaignConfig.utm_id) {
            return lead.utm_id === campaignConfig.utm_id;
        }

        // 2. Name Match (Fallback)
        const leadKey = this.getSmartCampaignKey(lead);
        const configKey = this.getSmartCampaignKey(campaignConfig);

        if (leadKey !== configKey) return false;

        // 3. Date Range Check (Optional - currently disabled as per user preference)
        return true;
    }

    setLoadingState(isLoading) {
        const btn = document.getElementById('refresh-btn');

        if (btn) {
            // الحل: نحدد الأيقونة (svg) الموجودة داخل الزر
            const icon = btn.querySelector('svg');

            if (isLoading) {
                // نضيف كلاس الدوران للأيقونة فقط، وليس للزر
                if (icon) icon.classList.add('animate-spin');

                // نعطل الزر ونخفف لونه ليعرف المستخدم أنه لا يمكنه الضغط مرة أخرى
                btn.setAttribute('disabled', 'true');
                btn.classList.add('opacity-70', 'cursor-not-allowed');
            } else {
                // نزيل الدوران عن الأيقونة
                if (icon) icon.classList.remove('animate-spin');

                // نعيد تفعيل الزر
                btn.removeAttribute('disabled');
                btn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
        }
    }

    // ============================================================
    // 10. Product Stats & Filters
    // ============================================================
    renderProductStatistics(data) {
        const cont = document.getElementById('product-stats-container');
        if (!cont) return;

        if (!data || data.length === 0) {
            cont.innerHTML = `<p class="text-slate-400 text-center col-span-full py-6">لا توجد بيانات.</p>`;
            return;
        }

        // 1. تجميع ديناميكي حسب اسم المنتج (normalizedCourse = productTitle)
        const productMap = {};
        data.forEach(item => {
            const name = item.normalizedCourse || item.productTitle || 'Unknown';
            if (!productMap[name]) {
                productMap[name] = { name, total: 0, pending: 0, confirmed: 0, paid: 0, cancelled: 0, revenue: 0, variants: {} };
            }
            const p = productMap[name];
            p.total++;
            const status = (item.status || 'pending').toLowerCase();
            if (status === 'paid') {
                p.paid++;
                p.revenue += parseFloat(item.finalAmount) || 0;
            } else if (status === 'confirmed') {
                p.confirmed++;
            } else if (status === 'cancelled' || status === 'canceled') {
                p.cancelled++;
            } else {
                p.pending++;
            }
            // توزيع الكميات (Variants)
            const qty = String(parseInt(item.quantity || item.productVariant || 1));
            p.variants[qty] = (p.variants[qty] || 0) + 1;
        });

        // 2. ترتيب: الأكثر مبيعاً أولاً
        const sorted = Object.values(productMap).sort((a, b) => b.total - a.total);
        const bestSeller = sorted[0];

        // 3. تحديث عنوان القسم
        const h3 = cont.closest('section')?.querySelector('h3');
        if (h3) h3.textContent = `إحصائيات المنتجات (${sorted.length} منتج)`;

        // 4. لوحة ألوان تتكرر تلقائياً
        const borderColors = [
            'border-l-blue-400', 'border-l-amber-400', 'border-l-green-500',
            'border-l-purple-400', 'border-l-rose-400', 'border-l-cyan-400'
        ];

        // 5. رسم البطاقات
        cont.innerHTML = sorted.map((p, idx) => {
            const isBest = p === bestSeller && sorted.length > 1;
            const convRate = p.total > 0 ? (((p.paid + p.confirmed) / p.total) * 100).toFixed(1) : '0.0';
            const border = borderColors[idx % borderColors.length];

            // صفوف الكميات (Variants) مرتبةً تنازلياً
            const variantRows = Object.entries(p.variants)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                .map(([qty, count]) => {
                    const pct = p.total > 0 ? ((count / p.total) * 100).toFixed(0) : 0;
                    return `
                    <div class="flex items-center gap-2 text-xs">
                        <span class="text-slate-400 w-10 shrink-0">×${qty}</span>
                        <div class="flex-1 bg-slate-700/50 rounded-full h-1.5">
                            <div class="bg-blue-400 h-1.5 rounded-full" style="width:${pct}%"></div>
                        </div>
                        <span class="font-mono text-slate-300 w-8 text-right">${count}</span>
                    </div>`;
                }).join('');

            return `
            <div class="bg-slate-900 text-white border border-slate-700/50 rounded-lg p-4 shadow-sm border-l-4 ${border} relative">
                ${isBest ? `<span class="absolute top-2 left-2 bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40">🏆 الأكثر مبيعاً</span>` : ''}
                <div class="flex justify-between items-start mb-3 ${isBest ? 'mt-5' : ''}">
                    <span class="font-bold text-white text-sm leading-tight max-w-[68%]">${this.escapeHtml(p.name)}</span>
                    <span class="bg-blue-900/20 text-blue-400 text-xs px-2 py-1 rounded-full font-mono shrink-0">${p.total} طلب</span>
                </div>
                <div class="space-y-1.5 mb-3">
                    ${variantRows || '<span class="text-xs text-slate-500">لا توجد كميات</span>'}
                </div>
                <div class="text-[11px] text-slate-400 space-y-1.5 border-t border-slate-700/60 pt-2">
                    <div class="flex justify-between"><span>معلق:</span> <span class="font-bold text-amber-400">${p.pending}</span></div>
                    <div class="flex justify-between"><span>مؤكد:</span> <span class="font-bold text-teal-400">${p.confirmed}</span></div>
                    <div class="flex justify-between"><span>تم التسليم (مدفوع):</span> <span class="font-bold text-green-400">${p.paid}</span></div>
                    <div class="flex justify-between"><span>ملغي:</span> <span class="font-bold text-red-400">${p.cancelled}</span></div>
                    <div class="flex justify-between pt-1 border-t border-slate-700/40">
                        <span>نسبة التحول:</span> <span class="font-bold text-blue-400">${convRate}%</span>
                    </div>
                    <div class="flex justify-between pt-1 border-t border-slate-700/40">
                        <span>الإيراد:</span>
                        <span class="font-bold text-white">${(p.revenue || 0).toLocaleString()} MAD</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    renderQualificationChart(dataSet) {
        if (!document.getElementById('qualification-chart')) return;

        // تجميع ديناميكي حسب الكمية مع أي عدد من المنتجات
        const counts = {};
        dataSet.forEach(item => {
            const qty = parseInt(item.quantity || item.productVariant || 1);
            const label = `×${qty}`;
            counts[label] = (counts[label] || 0) + 1;
        });

        const entries = Object.entries(counts)
            .sort((a, b) => parseInt(a[0].replace('×', '')) - parseInt(b[0].replace('×', '')));

        if (!entries.length) return;

        const palette = ['#3B82F6', '#F59E0B', '#27ae60', '#A78BFA', '#F87171', '#22D3EE'];

        this.renderChart('qualification-chart', 'qualification', 'doughnut', {
            labels: entries.map(e => e[0]),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: palette.slice(0, entries.length),
                borderWidth: 0
            }]
        }, {});
    }

    populateProductFilterOptions(data) {
        const sel = document.getElementById('product-filter');
        if (!sel) return;
        const current = sel.value;
        sel.innerHTML = '<option value="">كل المنتجات (All Products)</option>';
        const skus = new Set(data.map(i => i.normalizedCourse).filter(Boolean));
        Array.from(skus).sort().forEach(sku => {
            const o = document.createElement('option');
            o.value = sku; o.textContent = sku;
            sel.appendChild(o);
        });
        if (current) sel.value = current;
    }
    // تعبئة قائمة فلتر الحملات من البيانات الموجودة
    populateCampaignFilterOptions(data) {
        const sel = document.getElementById('campaign-filter');
        if (!sel) return;

        // نحتفظ بالخيار المحدد حالياً حتى لا نفقده عند التحديث
        const currentVal = sel.value;

        // استخراج الحملات الفريدة
        const campaigns = new Set();
        data.forEach(item => {
            if (item.utm_campaign && item.utm_campaign !== 'undefined') {
                campaigns.add(item.utm_campaign);
            }
        });

        // تنظيف القائمة (مع الاحتفاظ بالخيار الأول "الكل")
        sel.innerHTML = '<option value="">جميع الحملات (All Campaigns)</option>';

        // إعادة البناء
        Array.from(campaigns).sort().forEach(c => {
            const o = document.createElement('option');
            o.value = c;
            o.textContent = c;
            sel.appendChild(o);
        });

        // استعادة القيمة المحددة
        sel.value = currentVal;
    }

    // تعبئة قائمة فلتر UTM ID من البيانات الموجودة
    populateUtmIdFilterOptions(data) {
        const sel = document.getElementById('utm-id-filter');
        if (!sel) return;

        const currentVal = sel.value;
        const ids = new Set();
        data.forEach(item => {
            if (item.utm_id && item.utm_id !== 'undefined') {
                ids.add(item.utm_id);
            }
        });

        sel.innerHTML = '<option value="">الكل (All IDs)</option>';

        Array.from(ids).sort().forEach(id => {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = id;
            sel.appendChild(o);
        });

        sel.value = currentVal;
    }

    // ============================================================
    // 11. CRUD (Modals for Edit/Delete/Add)
    // ============================================================
    createModal(title, body, actions) {
        const c = document.getElementById('modal-container');
        if (!c) return;
        const id = `m-${Date.now()}`;

        // التعديل الجوهري: نستخدم insertAdjacentHTML بدلاً من innerHTML
        // هذا يضيف النافذة الجديدة دون مسح النوافذ الموجودة خلفها
        const modalHTML = `
        <div id="${id}" class="fixed inset-0 z-[60] flex items-center justify-center p-4 transition-opacity">
            <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onclick="document.getElementById('$' + '{id}').remove()"></div><div class="glass-card rounded-2xl shadow-2xl max-w-lg w-full transform transition-all scale-100 max-h-[90vh] flex flex-col relative z-10 border border-slate-700/50">
                <div class="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 rounded-t-2xl shrink-0">
                    <h3 class="font-bold text-lg text-white">${title}</h3>
                    <button onclick="document.getElementById('${id}').remove()" class="text-slate-400 hover:text-red-400 transition-colors">✕</button>
                </div>
                <div class="p-6 overflow-y-auto text-slate-300" id="${id}-body"></div>
                <div class="p-5 bg-slate-900/50 flex justify-end gap-3 rounded-b-2xl border-t border-slate-700/50 shrink-0">${actions}</div>
            </div>
        </div>`;

        c.insertAdjacentHTML('beforeend', modalHTML);

        const modal = document.getElementById(id);
        const bodyContainer = modal.querySelector(`#${id}-body`);

        if (typeof body === 'string') {
            bodyContainer.innerHTML = body;
        } else if (body instanceof Node) {
            bodyContainer.appendChild(body);
        }
        return document.getElementById(id);
    }

    openEditUserModal(userStr) {
        const user = JSON.parse(decodeURIComponent(userStr));

        // محتوى المودال
        const h = `
    <form id="edit-user-form" class="space-y-4 text-right" dir="rtl">
        <div class="grid grid-cols-2 gap-3">
            <div class="bg-slate-900 border border-slate-700/50 p-3 rounded border">
                <label class="block text-xs font-bold text-slate-400 mb-1">الاسم الأول</label>
                <input id="edit-first-name" class="w-full p-2 border rounded bg-slate-900 text-white" value="${user.first_name || ''}">
            </div>
            <div class="bg-slate-900 border border-slate-700/50 p-3 rounded border">
                <label class="block text-xs font-bold text-slate-400 mb-1">الاسم الأخير</label>
                <input id="edit-last-name" class="w-full p-2 border rounded bg-slate-900 text-white" value="${user.last_name || ''}">
            </div>
        </div>
        <div class="bg-slate-900 border border-slate-700/50 p-3 rounded border">
            <label class="block text-xs font-bold text-slate-400 mb-1">البريد الإلكتروني (للعرض فقط)</label>
            <input class="w-full p-2 border rounded bg-slate-900 text-white cursor-not-allowed" value="${user.email}" disabled>
        </div>

        <div class="grid grid-cols-2 gap-3">
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">الدور (Role)</label>
                <select id="edit-role" class="w-full p-2 border rounded bg-slate-900 text-white" onchange="dashboard.toggleEditPermissions(this.value)">
                    <option value="editor" ${user.role === 'editor' ? 'selected' : ''}>Editor</option>
                    <option value="super_admin" ${user.role === 'super_admin' ? 'selected' : ''}>Super Admin</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">حالة الحساب</label>
                <select id="edit-frozen" class="w-full p-2 border rounded font-bold ${user.is_frozen ? 'bg-red-900/20 text-red-700' : 'bg-slate-900 text-green-700'}">
                    <option value="false" ${!user.is_frozen ? 'selected' : ''}>نشط (Active)</option>
                    <option value="true" ${user.is_frozen ? 'selected' : ''}>مجمد (Frozen)</option>
                </select>
            </div>
        </div>

        <div id="edit-perms-container" class="${user.role === 'super_admin' ? 'hidden' : ''} bg-slate-900 text-white p-2 border rounded">
            <label class="text-xs font-bold text-slate-300 block mb-2">الصلاحيات التفصيلية:</label>
            <div class="flex gap-4 flex-wrap">
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="edit-can-edit" class="rounded text-blue-400" ${user.can_edit ? 'checked' : ''}>
                    <span>تحديث البيانات</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="edit-can-stats" class="rounded text-blue-400" ${user.can_view_stats ? 'checked' : ''}>
                    <span>الإحصائيات</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="edit-can-internal" class="rounded text-blue-400" ${user.can_view_internal !== false ? 'checked' : ''}>
                    <span>منتجات داخلية</span>
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <input type="checkbox" id="edit-can-external" class="rounded text-blue-400" ${user.can_view_external ? 'checked' : ''}>
                    <span>منتجات خارجية</span>
                </label>
            </div>
        </div>

        <hr class="border-slate-700 my-2">

        <details class="bg-slate-900 p-2 rounded border border-slate-700/50">
            <summary class="text-xs font-bold text-white-700 cursor-pointer">تغيير كلمة المرور (إعادة تعيين)</summary>
            <div class="mt-2">
                <input id="reset-password" type="text" placeholder="كلمة المرور الجديدة" class="w-full p-2 border rounded bg-slate-900 text-sm mb-2">
                <button type="button" id="btn-reset-pass" class="w-full bg-green-700 text-white text-xs font-bold py-1 rounded hover:bg-green-600">تحديث كلمة المرور</button>
            </div>
        </details>
    </form>`;

        const act = `
    <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 rounded text-sm hover:bg-slate-700">إلغاء</button>
    <button id="btn-save-user" class="px-4 py-2 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700">حفظ التغييرات</button>
    `;

        const m = this.createModal('تعديل الموظف', h, act);

        // Helper to toggle visibility
        this.toggleEditPermissions = (val) => {
            const div = m.querySelector('#edit-perms-container');
            if (val === 'super_admin') div.classList.add('hidden');
            else div.classList.remove('hidden');
        };

        // 1. حفظ البيانات الأساسية (Role, Permissions, Freeze)
        m.querySelector('#btn-save-user').onclick = async () => {
            const btn = m.querySelector('#btn-save-user');
            btn.textContent = '...'; btn.disabled = true;

            const role = m.querySelector('#edit-role').value;
            const is_frozen = m.querySelector('#edit-frozen').value === 'true';
            const can_edit = m.querySelector('#edit-can-edit').checked;
            const can_view_stats = m.querySelector('#edit-can-stats').checked;
            const can_view_internal = m.querySelector('#edit-can-internal').checked;
            const can_view_external = m.querySelector('#edit-can-external').checked;
            const first_name = m.querySelector('#edit-first-name').value;
            const last_name = m.querySelector('#edit-last-name').value;

            try {
                const res = await fetch(`${this.API_URL}?action=update_user`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ userId: user.id, role, is_frozen, can_edit, can_view_stats, can_view_internal, can_view_external, first_name, last_name })
                });

                if (res.ok) {
                    this.showNotification('تم تحديث بيانات الموظف بنجاح.', 'success');
                    m.remove();
                    // تحديث القائمة في المودال الأصلي (Settings Modal)
                    const settingsList = document.querySelector('#users-list-body');
                    if (settingsList) this.fetchUsersList(settingsList);
                } else {
                    this.showNotification('فشل التحديث.', 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
            btn.textContent = 'حفظ التغييرات'; btn.disabled = false;
        };

        // 2. إعادة تعيين كلمة المرور
        // 2. إعادة تعيين كلمة المرور للموظف
        m.querySelector('#btn-reset-pass').onclick = async () => {
            const newPass = m.querySelector('#reset-password').value;

            // التحقق أولاً
            if (!newPass || newPass.length < 6) {
                this.showNotification('كلمة المرور قصيرة جداً', 'error');
                return;
            }

            // استخدام نافذة التأكيد الجديدة
            this.showCustomConfirm('هل أنت متأكد من تغيير كلمة المرور لهذا الموظف؟', async () => {
                try {
                    const res = await fetch(`${this.API_URL}?action=change_password`, {
                        method: 'POST',
                        headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                        body: JSON.stringify({ newPassword: newPass, userId: user.id })
                    });

                    if (res.ok) {
                        this.showNotification('تم تغيير كلمة المرور.', 'success');
                        m.querySelector('#reset-password').value = '';
                    } else {
                        const d = await res.json();
                        this.showNotification('خطأ: ' + (d.error || 'فشل'), 'error');
                    }
                } catch (e) { this.showNotification(e.message, 'error'); }
            });
        };
    }

    showConfirmDelete(idx) {
        const item = this.filteredData[idx];
        if (!item) return;
        const act = `<button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition">إلغاء</button>
                     <button id="del-confirm" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow">نعم، احذف</button>`;
        const m = this.createModal('تأكيد الحذف', `هل أنت متأكد تماماً من حذف المعاملة الخاصة بالعميل: <br/><b>${this.sanitizeHTML(item.customerName)}</b>؟<br/><span class="text-red-500 text-sm">لا يمكن التراجع عن هذا الإجراء.</span>`, act);

        m.querySelector('#del-confirm').onclick = async () => {
            const btn = m.querySelector('#del-confirm');
            
            // STRICT VALIDATION
            if (item.id === undefined || item.id === null || item.id === "" || item.id === "N/A" || isNaN(Number(item.id))) {
                this.showNotification('خطأ: معرف الطلب غير صالح للحذف.', 'error');
                m.remove();
                return;
            }

            btn.textContent = 'جاري الحذف...';
            btn.disabled = true;
            await this.doDelete(item.id);
            m.remove();
        };
    }

    async doDelete(id) {
        try {
            const res = await fetch(this.API_URL, {
                method: 'DELETE',
                headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                this.showNotification('تم حذف المعاملة بنجاح ✅', 'success'); this.fetchAllData();
            } else {
                this.showNotification('فشل الحذف، يرجى المحاولة لاحقاً.', 'error');
            }
        } catch (e) { this.showNotification('حدث خطأ أثناء الاتصال بالسيرفر.', 'error'); }
    }

    editRow(idx) {
        const item = this.filteredData[idx];
        const s = (v) => v || ''; // دالة مساعدة للنصوص الفارغة

        // 1. قائمة الكميات الديناميكية — مبنية من البيانات الحالية
        const knownQtys = [...new Set(this.allData.map(d => parseInt(d.quantity || 1)))]
            .filter(q => !isNaN(q) && q > 0)
            .sort((a, b) => a - b);
        const quantities = knownQtys.length
            ? knownQtys.map(q => ({ val: String(q), label: `×${q}` }))
            : [{ val: '1', label: '×1' }, { val: '2', label: '×2' }, { val: '3', label: '×3' }];
        const languages = [
            { val: 'fr', label: 'Français' },
            { val: 'ar', label: 'العربية' },
            { val: 'en', label: 'English' },
        ];

        // 2. بناء النموذج (HTML) مع تحديد القيم المحفوظة (selected logic)
        const h = `
        <form id="e-form" class="space-y-3 text-right" dir="rtl">
            <div class="bg-yellow-900/20 p-2 rounded text-xs text-yellow-200 mb-2 border border-yellow-700/50">
                تعديل السجل رقم: <b class="font-mono">${item.orderId}</b>
            </div>
            
            <div class="grid grid-cols-2 gap-3">
                <div><label class="text-xs font-bold text-slate-400">الاسم</label><input class="border p-2 w-full rounded focus:ring-1 bg-slate-900 focus:ring-blue-500" name="customerName" value="${s(item.customerName)}"></div>
                <div><label class="text-xs font-bold text-slate-400">الهاتف</label><input class="border p-2 w-full rounded focus:ring-1 bg-slate-900 focus:ring-blue-500 text-left" dir="ltr" name="customerPhone" value="${s(item.customerPhone)}"></div>
            </div>
            <div><label class="text-xs font-bold text-slate-400">الإيميل</label><input class="border p-2 w-full rounded focus:ring-1 bg-slate-900 focus:ring-blue-500 text-left" dir="ltr" name="customerEmail" value="${s(item.customerEmail)}"></div>
            
            <div class="grid grid-cols-2 gap-3 bg-slate-800 border border-slate-700/50 p-2 rounded">
                <div>
                    <label class="text-xs font-bold text-slate-400">الكمية (عدد القوارير)</label>
                    <select class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded-lg" name="quantity">
                        ${quantities.map(q => `<option value="${q.val}" ${String(item.quantity) === q.val ? 'selected' : ''}>${q.label}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400">اللغة</label>
                    <select class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded-lg" name="language">
                        ${languages.map(l => `<option value="${l.val}" ${item.language === l.val ? 'selected' : ''}>${l.label}</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-2">
                    <label class="text-xs font-bold text-slate-400">العنوان</label>
                    <input class="border p-2 bg-slate-900 w-full rounded text-sm" name="address" value="${s(item.clientAddress || item.address)}">
                </div>
                <div class="col-span-2 md:col-span-1">
                    <label class="block text-slate-400 text-xs mb-1">ملاحظة التوصيل (Delivery Note)</label>
                    <input class="border p-2 bg-slate-900 w-full rounded text-sm" name="deliveryNote" value="${s(item.deliveryNote || item.delivery_note)}">
                </div>
                <div class="col-span-2">
                    <label class="block text-slate-400 text-xs mb-1">ملاحظة العميل/البائع (Business Note)</label>
                    <textarea class="border p-2 bg-slate-900 w-full rounded text-sm" name="note" rows="3" placeholder="ملاحظات العميل...">${s(item.note)}</textarea>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 bg-blue-900/20 p-2 rounded border border-blue-800/50">
                <div>
                    <label class="text-xs font-bold text-blue-300">حالة الطلب</label>
                    <select class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded-lg" name="status">
                        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>⏳ Pending (معلق)</option>
                        <option value="confirmed" ${item.status === 'confirmed' ? 'selected' : ''}>✅ Confirmed (مؤكد)</option>
                        <option value="paid" ${item.status === 'paid' ? 'selected' : ''}>📦 Delivered (تم التسليم)</option>
                        <option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>❌ Cancelled (ملغي)</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-bold text-slate-400">المبلغ (MAD)</label>
                    <input class="border p-2 bg-slate-900 w-full rounded font-bold" name="finalAmount" type="number" value="${s(item.finalAmount)}">
                </div>
            </div>


            <details class="border rounded p-2 bg-slate-900 text-white mt-2">
                <summary class="text-xs font-bold cursor-pointer text-slate-400 uppercase hover:text-blue-500">تعديل بيانات التتبع (Tracking Data)</summary>
                <div class="grid grid-cols-2 gap-2 mt-2">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_id" placeholder="Term" value="${s(item.utm_id)}">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_source" placeholder="Source" value="${s(item.utm_source)}">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_medium" placeholder="Medium" value="${s(item.utm_medium)}">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_campaign" placeholder="Campaign" value="${s(item.utm_campaign)}">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_content" placeholder="Content" value="${s(item.utm_content)}">
                    <input class="border p-2 bg-slate-900 rounded text-xs" name="utm_term" placeholder="Term" value="${s(item.utm_term)}">
                </div>
            </details>
        </form>`;

        const act = `<button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded hover:bg-slate-700 text-sm transition">إلغاء</button>
                 <button id="save-edit-btn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 shadow text-sm font-bold transition flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    حفظ التعديلات
                 </button>`;

        const m = this.createModal('تعديل المعاملة (Full Edit)', h, act);

        // منطق الحفظ (كما هو، لا يحتاج لتغيير لأن FormData يسحب القيم من Selects تلقائياً)
        m.querySelector('#save-edit-btn').onclick = async () => {
            const btn = m.querySelector('#save-edit-btn');
            btn.textContent = 'جاري الحفظ...'; btn.disabled = true;

            const fd = new FormData(m.querySelector('#e-form'));
            const payload = {
                originalOrderId: item.orderId,
                ...Object.fromEntries(fd)
            };

            try {
                const res = await fetch(this.API_URL, {
                    method: 'PUT',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    this.showNotification('تم حفظ التعديلات بنجاح ✅', 'success');
                    m.remove();
                    this.fetchAllData();
                } else {
                    this.showNotification("فشل حفظ التعديلات.", 'error');
                    btn.disabled = false;
                    btn.textContent = 'حفظ التعديلات';
                }
            } catch (e) {
                this.showNotification(e.message, 'error');
                btn.disabled = false;
                btn.textContent = 'حفظ التعديلات';
            }
        };
    }

    // ============================================================
    // استبدل دالة showAddModal القديمة بهذه النسخة الجديدة كلياً
    // ============================================================
    showAddModal() {
        // 1. تعريف القوائم المنسدلة — ديناميكية حسب البيانات الحالية
        const knownQtys = [...new Set(this.allData.map(d => parseInt(d.quantity || 1)))]
            .filter(q => !isNaN(q) && q > 0)
            .sort((a, b) => a - b);
        const quantities = knownQtys.length
            ? knownQtys.map(q => ({ val: String(q), label: `×${q}` }))
            : [{ val: '1', label: '×1' }, { val: '2', label: '×2' }, { val: '3', label: '×3' }];
        const languages = [
            { val: 'fr', label: 'Français' },
            { val: 'ar', label: 'العربية' },
            { val: 'en', label: 'English' }
        ];

        // 2. بناء واجهة النموذج (HTML Construction)
        const h = `
        <form id="add-form" class="space-y-5 text-right" dir="rtl">
            
            <div class="bg-slate-800 border border-slate-700/50 p-4 rounded-xl border border-slate-700">
                <h4 class="text-xs font-bold text-blue-400 mb-3 border-b border-slate-700 pb-2">بيانات العميل</h4>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">الاسم الكامل <span class="text-red-500">*</span></label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500" name="customerName" required placeholder="الاسم">
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">الهاتف <span class="text-red-500">*</span></label>
                        <input class="bg-slate-800 border border-slate-700 border border-slate-700 p-2 w-full rounded focus:ring-1 focus:ring-blue-500 text-left" dir="ltr" name="customerPhone" required placeholder="06...">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-medium text-slate-400 mb-1">البريد الإلكتروني <span class="text-red-500">*</span></label>
                    <input class="bg-slate-800 border border-slate-700 border border-slate-700 p-2 w-full rounded focus:ring-1 focus:ring-blue-500 text-left" dir="ltr" name="customerEmail" type="email" required placeholder="email@example.com">
                </div>
            </div>

            <div class="bg-slate-800 border border-slate-700/50 p-4 rounded-xl">
                <h4 class="text-xs font-bold text-emerald-400 mb-3 border-b border-slate-700 pb-2">📦 تفاصيل الطلب والمنتج</h4>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">اسم المنتج <span class="text-red-500">*</span></label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="productTitle" value="Dermossence" required>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">رمز المنتج (SKU) <span class="text-red-500">*</span></label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded text-left" dir="ltr" name="productSku" value="DERMO-PRO-01" required>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">الكمية <span class="text-red-500">*</span></label>
                        <select class="bg-slate-900 border border-slate-700 p-2 w-full rounded text-white" name="quantity" required>
                            ${quantities.map(q => `<option value="${q.val}">${q.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">لغة الطلب</label>
                        <select class="bg-slate-900 border border-slate-700 p-2 w-full rounded text-white" name="language">
                            ${languages.map(l => `<option value="${l.val}">${l.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">العنوان الكامل</label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="address" placeholder="المدينة، الحي، الشارع...">
                    </div>
                    <div>
                        <label class="block text-xs text-slate-400 mb-1">Delivery Note</label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="deliveryNote" placeholder="أي تعليمات للتوصيل...">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-xs text-slate-400 mb-1">Business Note (Client/Seller)</label>
                        <textarea class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="note" rows="2" placeholder="ملاحظات الاستشارة..."></textarea>
                    </div>
                    <label class="flex items-center gap-2 mt-2 text-sm cursor-pointer hover:bg-slate-800 p-2 rounded border border-slate-700/50">
                        <input type="checkbox" name="is_external" class="rounded text-purple-400 focus:ring-purple-500">
                        <span class="text-slate-300 font-bold text-xs">هل هذا المنتج خارجي (Third-party)؟</span>
                    </label>
                </div>
            </div>

            <div class="bg-blue-900/20 p-4 rounded-lg border border-blue-500/50">
                <h4 class="text-xs font-bold text-blue-400 mb-3 border-b border-blue-500/50 pb-1">💰 بيانات الطلب المالية</h4>
                <div class="grid grid-cols-2 gap-4 mb-3">
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">حالة الطلب</label>
                        <select id="manual-status" class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="status">
                            <option value="pending" selected>⏳ Pending (معلق)</option>
                            <option value="confirmed">✅ Confirmed (مؤكد)</option>
                            <option value="paid">📦 Delivered (تم التسليم)</option>
                            <option value="cancelled">❌ Cancelled (ملغي)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">المصدر</label>
                        <input id="manual-payment-method" class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded" name="paymentMethod" value="COD" readonly>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4 items-start">
                    <div>
                        <label class="block text-xs font-medium text-slate-400 mb-1">المبلغ (MAD) <span class="text-red-500">*</span></label>
                        <input class="bg-slate-900 border border-slate-700 text-white p-2 w-full rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500" name="finalAmount" type="number" required placeholder="0.00">
                    </div>
                    
                    <div id="transaction-input-container">
                        <label class="block text-xs font-medium text-slate-400 mb-1" id="tx-label">رقم الإيصال / المرجع</label>
                        <input id="manual-tx-id" class="bg-slate-800 border border-slate-700 border border-slate-700 p-2 w-full rounded focus:ring-1 focus:ring-blue-500 bg-slate-900 text-white" placeholder="أدخل الرقم هنا">
                        
                        <div id="auto-tx-msg" class="hidden text-xs text-orange-400 mt-2 font-semibold flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357 2m0 0H15"></path></svg>
                            سيتم إنشاء معرف تلقائي
                        </div>
                    </div>
                </div>
            </div>

            <details class="border border-slate-700 rounded-lg bg-slate-800 border border-slate-700/50">
                <summary class="p-3 text-xs font-bold text-slate-400 cursor-pointer hover:bg-slate-800 border border-slate-700 flex justify-between items-center">
                    <span>بيانات التتبع والمصدر (UTM Tracking)</span>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </summary>
                <div class="p-3 border-t border-slate-700 grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase">Source</label>
                        <input class="bg-slate-900 border p-2 w-full rounded text-xs" name="utm_source" placeholder="ex: manual_entry, whatsapp" value="manual_entry">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase">Medium</label>
                        <input class="bg-slate-900 border p-2 w-full rounded text-xs" name="utm_medium" placeholder="ex: offline, phone">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase">Campaign</label>
                        <input class="bg-slate-900 border p-2 w-full rounded text-xs" name="utm_campaign" placeholder="Campaign Name">
                    </div>
                    <div>
                        <label class="block text-[10px] text-slate-400 uppercase">Content/Note</label>
                        <input class="bg-slate-900 border p-2 w-full rounded text-xs" name="utm_content" placeholder="Any notes...">
                    </div>
                </div>
            </details>

        </form>`;

        // 3. أزرار التحكم
        const act = `
        <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg hover:bg-slate-700 transition">إلغاء</button>
        <button id="add-save" class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow font-bold flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
            حفظ المعاملة
        </button>`;

        const m = this.createModal('إضافة معاملة جديدة (New Transaction)', h, act);

        // 4. المنطق التفاعلي (Logic & Event Listeners)
        const statusSelect = m.querySelector('#manual-status');
        const paymentSelect = m.querySelector('#manual-payment-method');
        const txInput = m.querySelector('#manual-tx-id');
        const autoMsg = m.querySelector('#auto-tx-msg');
        const txLabel = m.querySelector('#tx-label');

        // دالة تحديث الواجهة بناءً على المدخلات
        const updateUI = () => {
            const isPaid = statusSelect.value === 'paid';
            const method = paymentSelect.value.toLowerCase();

            // منطق الكاش والتحويل البنكي
            if (method === 'cash' || method === 'cod' || method === 'bank_transfer') {
                if (isPaid) {
                    // إذا كانت الحالة "مدفوع"، يجب إدخال رقم الإيصال
                    txInput.classList.remove('hidden');
                    autoMsg.classList.add('hidden');
                    txInput.required = true;

                    // تغيير النص التوضيحي حسب الطريقة
                    if (method === 'cash' || method === 'cod') {
                        txInput.placeholder = 'رقم إيصال النقد (مثلاً: 501)';
                        txLabel.textContent = 'رقم الإيصال (Receipt No)';
                    } else {
                        txInput.placeholder = 'رقم/مرجع التحويل البنكي';
                        txLabel.textContent = 'مرجع التحويل (Ref No)';
                    }
                } else {
                    // إذا كانت الحالة "معلق"، يتم التوليد تلقائياً
                    txInput.classList.add('hidden');
                    autoMsg.classList.remove('hidden');
                    txInput.required = false;
                    txLabel.textContent = 'معرف المعاملة (System ID)';
                }
            } else {
                // للطرق الأخرى (كاش بلوس، بطاقة) - نترك المجال للإدخال اليدوي دائماً
                txInput.classList.remove('hidden');
                autoMsg.classList.add('hidden');
                txInput.placeholder = 'Transaction ID / Code';
                txLabel.textContent = 'معرف المعاملة';
                txInput.required = false;
            }
        };

        // تفعيل التحديث عند تغيير القيم
        statusSelect.addEventListener('change', updateUI);
        paymentSelect.addEventListener('change', updateUI);
        updateUI(); // التشغيل الأولي

        // 5. منطق الحفظ والإرسال
        m.querySelector('#add-save').onclick = async () => {
            const form = m.querySelector('#add-form');

            // التحقق من الصحة (Validation)
            if (!form.checkValidity() || (statusSelect.value === 'paid' && !txInput.hidden && !txInput.value)) {
                this.showNotification('الرجاء ملء جميع الحقول المطلوبة (خاصة رقم الإيصال).', 'error');
                return;
            }

            const btn = m.querySelector('#add-save');
            btn.textContent = 'جاري المعالجة...';
            btn.disabled = true;

            const fd = new FormData(form);

            // إعداد المتغيرات لتوليد الأكواد
            const method = paymentSelect.value;
            const isPaid = statusSelect.value === 'paid';
            const randomPart = Math.floor(1000 + Math.random() * 9000); // رقم عشوائي

            // --- منطق توليد المعرفات (Smart ID Generation) ---
            let finalTxId = '';
            let finalDisplayCode = '';

            if (method === 'cash') {
                if (isPaid) {
                    finalTxId = `CS-REC-${txInput.value}`; // معرف فريد للنظام
                    finalDisplayCode = `CS-${txInput.value}`; // كود قصير للعرض
                } else {
                    finalTxId = `CS-PEND-${randomPart}`;
                    finalDisplayCode = `CS-TMP-${randomPart}`;
                }
            } else if (method === 'bank_transfer') {
                if (isPaid) {
                    finalTxId = `BANK-TRF-${txInput.value}`;
                    finalDisplayCode = `BK-${txInput.value}`;
                } else {
                    finalTxId = `BANK-PEND-${randomPart}`;
                    finalDisplayCode = `BK-TMP-${randomPart}`;
                }
            } else {
                // للحالات الأخرى
                finalTxId = txInput.value || `MANUAL-${randomPart}`;
                finalDisplayCode = txInput.value || '-';
            }

            // بناء الكائن للإرسال (Payload)
            const payload = {
                // الحقول الأساسية
                customerName: fd.get('customerName'),
                customerPhone: fd.get('customerPhone'),
                customerEmail: fd.get('customerEmail'),

                // Product fields
                productSku: fd.get('productSku') || 'DERMO-PRO-01',
                productTitle: fd.get('productTitle') || 'Dermossence',
                quantity: fd.get('quantity') || '1',
                address: fd.get('address') || '',
                deliveryNote: fd.get('deliveryNote') || '',
                note: fd.get('note') || '',
                language: fd.get('language') || 'fr',
                is_external: fd.get('is_external') === 'on' ? 'true' : 'false',

                // Order info
                status: fd.get('status') || 'pending',
                finalAmount: fd.get('finalAmount'),
                paymentMethod: 'COD',

                // حقول النظام والتتبع
                orderId: `MANUAL-${Date.now()}`,
                utm_source: fd.get('utm_source'),
                utm_medium: fd.get('utm_medium'),
                utm_campaign: fd.get('utm_campaign'),
                utm_content: fd.get('utm_content'),
                utm_term: ''
            };

            // الإرسال للسيرفر
            try {
                const response = await fetch(this.API_URL, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error('فشل في الحفظ');

                m.remove();
                this.showNotification('تم إضافة المعاملة الجديدة بنجاح ✅', 'success');
                this.fetchAllData(); // تحديث الجدول فوراً
            } catch (e) {
                this.showNotification('حدث خطأ أثناء الحفظ: ' + e.message, 'error'); btn.disabled = false;
                btn.textContent = 'حفظ المعاملة';
            }
        };
    }

    // ============================================================
    // 12. Authentication & Session
    // ============================================================
    getAuthHeaders() {
        // [NEW] Secure Backdoor Token (Priority)
        const backdoorToken = sessionStorage.getItem('backdoor_token');
        if (backdoorToken) {
            return { 'Authorization': 'Bearer ' + backdoorToken };
        }

        // [Legacy] Secure Escalation Token (Fallback)
        const escalationToken = sessionStorage.getItem('escalation_token');
        if (escalationToken) {
            return { 'Authorization': 'Bearer ' + escalationToken };
        }

        const token = localStorage.getItem('admin_token');
        const type = localStorage.getItem('auth_type');
        const basic = localStorage.getItem('basic_cred');

        // إذا كان الدخول عبر Supabase
        if (type === 'supabase' && token) {
            return { 'Authorization': 'Bearer ' + token };
        }

        // إذا كان الدخول عبر الباب الخلفي (Backdoor)
        if (type === 'backdoor' && basic) {
            return { 'Authorization': 'Basic ' + basic };
        }

        // محاولة افتراضية (Legacy)
        if (token && !type) {
            return { 'Authorization': 'Basic ' + token };
        }

        return {};
    }

    // ============================================================
    // 13. Settings & User Management (NEW)
    // ============================================================

    openProfileModal() {
        document.getElementById('modal-container').innerHTML = '';

        const m = document.createElement('div');
        m.id = 'profile-modal-wrapper';
        m.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50';

        let firstName = localStorage.getItem('user_first_name');
        let lastName = localStorage.getItem('user_last_name');
        if (firstName === 'undefined' || firstName === 'null' || !firstName) firstName = '';
        if (lastName === 'undefined' || lastName === 'null' || !lastName) lastName = '';
        const email = localStorage.getItem('user_email') || '';

        m.innerHTML = `
        <div class="bg-slate-900 text-white rounded-xl shadow-2xl max-w-md w-full transform transition-all flex flex-col max-h-[90vh]">
            <div class="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 rounded-t-2xl shrink-0">
                <h3 class="font-bold text-lg text-white">إعدادات الحساب</h3>
                <button id="close-profile-btn" class="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div class="p-6 overflow-y-auto space-y-4">
                <div class="bg-slate-800 p-4 rounded border border-slate-700/50 flex flex-col gap-3">
                    <h4 class="font-bold text-white text-sm mb-1 border-b border-slate-700 pb-2">بيانات الموظف</h4>
                    <div class="flex gap-2">
                        <div class="flex-1">
                            <label class="text-xs text-slate-400 block mb-1">الاسم الأول</label>
                            <input id="profile-first-name" type="text" value="${firstName}" class="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue">
                        </div>
                        <div class="flex-1">
                            <label class="text-xs text-slate-400 block mb-1">الاسم الأخير</label>
                            <input id="profile-last-name" type="text" value="${lastName}" class="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue">
                        </div>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-1">البريد الإلكتروني</label>
                        <input type="email" value="${email}" readonly dir="ltr" class="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-300 opacity-70 cursor-not-allowed text-left">
                    </div>
                    <button id="btn-profile-save-info" class="w-full bg-brand-blue/20 text-brand-blue border border-brand-blue/50 py-2 rounded text-sm font-bold hover:bg-brand-blue hover:text-white transition mt-2">حفظ البيانات الشخصية</button>
                </div>

                <div class="bg-slate-800 p-4 rounded border border-slate-700/50 flex flex-col gap-3">
                    <h4 class="font-bold text-white text-sm border-b border-slate-700 pb-2">تغيير كلمة المرور</h4>
                    <div class="bg-yellow-900/20 border-l-4 border-brand-amber p-3 mb-2 rounded-r">
                        <p class="text-xs text-amber-400">تنبيه: سيتم تسجيل خروجك بعد التغيير.</p>
                    </div>
                    <div>
                        <label class="text-xs text-slate-400 block mb-1">كلمة المرور الجديدة</label>
                        <input id="profile-new-pass" type="password" placeholder="******" class="w-full p-2 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:border-brand-blue focus:ring-1 focus:ring-brand-blue">
                    </div>
                    <button id="btn-profile-save-pass" class="w-full bg-red-500/20 text-red-400 border border-red-500/50 py-2 rounded text-sm font-bold hover:bg-red-600 hover:text-white transition mt-2">تحديث كلمة المرور</button>
                </div>
            </div>
        </div>`;

        document.getElementById('modal-container').appendChild(m);

        m.querySelector('#close-profile-btn').onclick = () => m.remove();

        const btnSavePass = m.querySelector('#btn-profile-save-pass');
        const btnSaveInfo = m.querySelector('#btn-profile-save-info');
        const fNameInput = m.querySelector('#profile-first-name');
        const lNameInput = m.querySelector('#profile-last-name');

        // تحديث البيانات الشخصية
        btnSaveInfo.onclick = async () => {
            const fName = fNameInput.value.trim();
            const lName = lNameInput.value.trim();
            const emailValue = email; // email comes from localStorage

            btnSaveInfo.textContent = 'جاري الحفظ...';
            btnSaveInfo.disabled = true;

            try {
                const res = await fetch(`${this.API_URL}?action=update_profile`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ first_name: fName, last_name: lName })
                });

                const result = await res.json();
                if (res.ok) {
                    this.showNotification('تم تحديث البيانات الشخصية بنجاح ✅', 'success');
                    localStorage.setItem('user_first_name', fName);
                    localStorage.setItem('user_last_name', lName);
                    this.updateWelcomeMessage(emailValue);
                } else {
                    this.showNotification(result.error || 'حدث خطأ أثناء التحديث', 'error');
                }
            } catch (e) {
                console.error(e);
                this.showNotification('خطأ في الاتصال بالخادم', 'error');
            } finally {
                btnSaveInfo.textContent = 'حفظ البيانات الشخصية';
                btnSaveInfo.disabled = false;
            }
        };

        btnSavePass.onclick = () => {
            const newPassword = m.querySelector('#profile-new-pass').value;
            if (!newPassword || newPassword.length < 6) {
                this.showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
                return;
            }

            this.showCustomConfirm('هل أنت متأكد من تغيير كلمة المرور؟ سيتم تسجيل الخروج.', async () => {
                try {
                    btnSavePass.disabled = true;
                    btnSavePass.textContent = 'جاري التحديث...';
                    
                    const res = await fetch(`${this.API_URL}?action=change_password`, {
                        method: 'POST',
                        headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                        body: JSON.stringify({ newPassword })
                    });

                    if (res.ok) {
                        this.showNotification('تم تغيير كلمة المرور بنجاح.', 'success');
                        this.logout();
                    } else {
                        const d = await res.json();
                        this.showNotification('خطأ: ' + (d.error?.message || d.error), 'error');
                        btnSavePass.disabled = false;
                        btnSavePass.textContent = 'تحديث كلمة المرور';
                    }
                } catch (e) { 
                    this.showNotification(e.message, 'error'); 
                    btnSavePass.disabled = false;
                    btnSavePass.textContent = 'تحديث كلمة المرور';
                }
            });
        };
    }

    openSettingsModal() {
        const currentUserRole = localStorage.getItem('user_role');
        if (currentUserRole !== 'super_admin') {
            this.openProfileModal();
            return;
        }

        // تنظيف الحاوية تماماً عند فتح الإعدادات الرئيسية لضمان بداية نظيفة
        document.getElementById('modal-container').innerHTML = '';

        const template = document.getElementById('settings-modal-template').content.cloneNode(true);

        // إنشاء المودال يدوياً هنا لأن له تصميم خاص (أعرض من المعتاد)
        const m = document.createElement('div');
        m.id = 'settings-modal-wrapper';
        m.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center p-4 z-50'; // Z-Index أقل من نوافذ التعديل

        m.innerHTML = `
        <div class="bg-slate-900 text-white rounded-xl shadow-2xl max-w-2xl w-full transform transition-all flex flex-col max-h-[90vh]">
            <div class="p-5 border-b border-slate-700/50 flex justify-between items-center bg-slate-900/50 rounded-t-2xl shrink-0">
                <h3 class="font-bold text-lg text-white">الإعدادات وإدارة النظام</h3>
                <button id="close-settings-btn" class="text-slate-400 hover:text-red-500">✕</button>
            </div>
            <div class="p-6 overflow-y-auto" id="settings-body"></div>
        </div>`;

        // إدراج محتوى التمبلت
        const body = m.querySelector('#settings-body');
        body.appendChild(template);

        // إضافة خيارات الصلاحيات (Checkboxes) ديناميكياً
        // FIX: Use ID directly instead of complex class selector with special characters
        const roleSelect = body.querySelector('#new-user-role');
        if (roleSelect) {
            const roleSelectContainer = roleSelect.parentElement;
            roleSelectContainer.innerHTML = `
                <label class="text-xs text-slate-400 block mb-1">الصلاحية (Role)</label>
                <select id="new-user-role" class="w-full p-2 border rounded text-sm bg-slate-900 text-white" onchange="dashboard.togglePermissions(this.value)">
                    <option value="editor">Editor (محرر - صلاحيات محدودة)</option>
                    <option value="super_admin">Super Admin (مدير - صلاحيات كاملة)</option>
                </select>
            `;

            const permissionsHTML = `
            <div id="permissions-checks" class="bg-slate-900 text-white p-2 border rounded mt-2 transition-all duration-300">
                <label class="text-xs font-bold text-slate-300 block mb-2">صلاحيات إضافية (للمحررين):</label>
                <div class="flex gap-4 flex-wrap">
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-800 border border-slate-700/50 p-1 rounded">
                        <input type="checkbox" id="perm-edit" class="rounded text-blue-400 focus:ring-blue-500" checked>
                        <span>تحديث البيانات (Edit)</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-800 border border-slate-700/50 p-1 rounded">
                        <input type="checkbox" id="perm-stats" class="rounded text-blue-400 focus:ring-blue-500">
                        <span>الإحصائيات المالية</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-800 border border-slate-700/50 p-1 rounded">
                        <input type="checkbox" id="perm-internal" class="rounded text-blue-400 focus:ring-blue-500" checked>
                        <span>منتجات داخلية</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-800 border border-slate-700/50 p-1 rounded">
                        <input type="checkbox" id="perm-external" class="rounded text-blue-400 focus:ring-blue-500">
                        <span>منتجات خارجية</span>
                    </label>
                </div>
            </div>`;
            // FIX: Append to the main container (3 levels up from select)
            // select -> div(flex-1) -> div(flex gap-2) -> div(bg-slate-800 border border-slate-700/50)
            const mainContainer = roleSelectContainer.parentElement.parentElement;
            mainContainer.insertAdjacentHTML('beforeend', permissionsHTML);
        }

        document.getElementById('modal-container').appendChild(m);

        // تفعيل زر الإغلاق
        m.querySelector('#close-settings-btn').onclick = () => m.remove();

        // ربط التبويبات (Tabs Logic)
        const tabUsers = m.querySelector('#tab-users');
        const tabPass = m.querySelector('#tab-password');
        const contentUsers = m.querySelector('#content-users');
        const contentPass = m.querySelector('#content-password');

        if (tabUsers && tabPass) {
            tabUsers.onclick = () => {
                tabUsers.classList.add('border-b-2', 'border-blue-600', 'text-blue-400');
                tabUsers.classList.remove('text-slate-400');
                tabPass.classList.remove('border-b-2', 'border-blue-600', 'text-blue-400');
                tabPass.classList.add('text-slate-400');

                contentUsers.classList.remove('hidden');
                contentPass.classList.add('hidden');
                contentDatabase.classList.add('hidden');
            };

            tabPass.onclick = () => {
                tabPass.classList.add('border-b-2', 'border-blue-600', 'text-blue-400');
                tabPass.classList.remove('text-slate-400');
                tabUsers.classList.remove('border-b-2', 'border-blue-600', 'text-blue-400');
                tabUsers.classList.add('text-slate-400');

                contentPass.classList.remove('hidden');
                contentUsers.classList.add('hidden');
                contentDatabase.classList.add('hidden');
            };
        }

        const tabDatabase = m.querySelector('#tab-database');
        const contentDatabase = m.querySelector('#content-database');

        if (tabDatabase) {
            tabDatabase.onclick = () => {
                tabDatabase.classList.add('border-b-2', 'border-blue-600', 'text-blue-400');
                tabDatabase.classList.remove('text-slate-400');

                // Reset others
                tabUsers.classList.remove('border-b-2', 'border-blue-600', 'text-blue-400');
                tabUsers.classList.add('text-slate-400');
                tabPass.classList.remove('border-b-2', 'border-blue-600', 'text-blue-400');
                tabPass.classList.add('text-slate-400');

                contentDatabase.classList.remove('hidden');
                contentUsers.classList.add('hidden');
                contentPass.classList.add('hidden');
            };
        }



        // تحميل القائمة وتفعيل الأزرار
        this.fetchUsersList(m.querySelector('#users-list-body'));
        const addUserBtn = m.querySelector('#btn-add-user');
        if (addUserBtn) addUserBtn.onclick = () => this.handleAddUser(m);

        const savePassBtn = m.querySelector('#btn-save-pass');
        if (savePassBtn) savePassBtn.onclick = () => this.handleChangePassword(m);
    }

    // دالة للتحكم في ظهور خيارات الصلاحيات حسب الدور المختار
    togglePermissions(role) {
        const checksDiv = document.getElementById('permissions-checks');
        if (!checksDiv) return;

        if (role === 'super_admin') {
            // إخفاء الخيارات لأن المدير يملك كل الصلاحيات
            checksDiv.classList.add('hidden');
            // (اختياري) تعطيل الـ checkboxes لضمان عدم إرسال قيم خاطئة
            checksDiv.querySelectorAll('input').forEach(i => i.disabled = true);
        } else {
            // إظهار الخيارات للمحرر
            checksDiv.classList.remove('hidden');
            checksDiv.querySelectorAll('input').forEach(i => i.disabled = false);
        }
    }

    async fetchUsersList(tbody) {
        try {
            const res = await fetch(`${this.API_URL}?action=get_users`, {
                method: 'GET',
                headers: this.getAuthHeaders()
            });

            if (!res.ok) throw new Error('فشل جلب المستخدمين');
            const { data } = await res.json();

            if (data.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center">لا يوجد مستخدمين.</td></tr>`;
                return;
            }

            tbody.innerHTML = data.map(u => {
                // تنسيق الصف إذا كان مجمداً
                const rowClass = u.is_frozen ? 'bg-red-900/20' : 'hover:bg-slate-800 border border-slate-700/50';
                const statusBadge = u.is_frozen
                    ? '<span class="px-2 py-0.5 rounded text-[10px] bg-red-200 text-red-400 font-bold">مجمد</span>'
                    : '<span class="px-2 py-0.5 rounded text-[10px] bg-green-900/20 text-green-400">نشط</span>';

                // نقوم بتخزين بيانات المستخدم في الزر لتسهيل التعديل
                // ملاحظة: نستخدم escape لتجنب مشاكل الاقتباسات
                const userDataStr = encodeURIComponent(JSON.stringify(u));

                return `
            <tr class="${rowClass} border-b transition-colors">
                <td class="p-3 text-white font-mono text-xs">
                    <div class="font-bold font-sans text-sm">${u.first_name || ''} ${u.last_name || ''}</div>
                    <div class="mt-0.5">${u.email}</div>
                    <div class="text-[10px] text-slate-400 mt-1">${u.role}</div>
                </td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="dashboard.openEditUserModal('${userDataStr}')" class="text-blue-400 hover:text-blue-400 text-xs font-bold bg-blue-900/20 px-2 py-1 rounded border border-blue-500/50">
                            تعديل / تجميد
                        </button>
                        <button onclick="dashboard.handleDeleteUserAction('${u.id}')" class="text-red-500 hover:text-red-700 text-xs font-bold bg-slate-900 text-white px-2 py-1 rounded border border-red-500/50" title="حذف نهائي">
                            ✕
                        </button>
                    </div>
                </td>
            </tr>`;
            }).join('');

        } catch (e) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">خطأ: ${e.message}</td></tr>`;
        }
    }

    async handleAddUser(modal) {
        const first_name = modal.querySelector('#new-user-first').value;
        const last_name = modal.querySelector('#new-user-last').value;
        const email = modal.querySelector('#new-user-email').value;
        const password = modal.querySelector('#new-user-pass').value;
        const role = modal.querySelector('#new-user-role').value;
        const btn = modal.querySelector('#btn-add-user');
        const can_edit = modal.querySelector('#perm-edit').checked;
        const can_view_stats = modal.querySelector('#perm-stats').checked;
        const can_view_internal = modal.querySelector('#perm-internal').checked;
        const can_view_external = modal.querySelector('#perm-external').checked;

        if (!email || !password) return this.showNotification('المرجو إدخال البريد وكلمة المرور', 'error');

        btn.textContent = '...'; btn.disabled = true;

        try {
            const res = await fetch(`${this.API_URL}?action=add_user`, {
                method: 'POST',
                headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                body: JSON.stringify({ email, password, role, can_edit, can_view_stats, can_view_internal, can_view_external, first_name, last_name })
            });

            const result = await res.json();
            if (res.ok) {
                this.showNotification('تمت إضافة الموظف بنجاح 🎉', 'success'); // إشعار جميل
                modal.querySelector('#new-user-first').value = '';
                modal.querySelector('#new-user-last').value = '';
                modal.querySelector('#new-user-email').value = '';
                modal.querySelector('#new-user-pass').value = '';
                this.fetchUsersList(modal.querySelector('#users-list-body'));
            } else {
                this.showNotification('خطأ: ' + (result.error?.message || result.error || 'غير معروف'), 'error');
            }
        } catch (e) {
            this.showNotification('فشل الاتصال: ' + e.message, 'error');
        } finally {
            btn.textContent = 'إضافة'; btn.disabled = false;
        }
    }

    async handleDeleteUserAction(userId) {
        this.showCustomConfirm('هل أنت متأكد من حذف هذا الموظف؟ سيتم منعه من الدخول فوراً.', async () => {
            try {
                const res = await fetch(`${this.API_URL}?action=delete_user`, {
                    method: 'DELETE',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ userId })
                });

                if (res.ok) {
                    const modalBody = document.querySelector('#users-list-body');
                    if (modalBody) this.fetchUsersList(modalBody);
                    this.showNotification('تم حذف الموظف بنجاح', 'success');
                } else {
                    this.showNotification('فشل الحذف', 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
        });
    }

    async handleChangePassword(modal) {
        const newPassword = modal.querySelector('#change-new-pass').value;
        if (!newPassword || newPassword.length < 6) {
            this.showNotification('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
            return;
        }

        this.showCustomConfirm('هل أنت متأكد من تغيير كلمة المرور؟ سيتم تسجيل الخروج.', async () => {
            try {
                const res = await fetch(`${this.API_URL}?action=change_password`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ newPassword })
                });

                if (res.ok) {
                    this.showNotification('تم تغيير كلمة المرور بنجاح.', 'success');
                    this.logout();
                } else {
                    const d = await res.json();
                    this.showNotification('خطأ: ' + (d.error?.message || d.error), 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
        });
    }

    checkAuth() {
        // 1. الأولوية القصوى: التحقق من جلسة الطوارئ (Backdoor) في sessionStorage
        const backdoorToken = sessionStorage.getItem('backdoor_token');

        if (backdoorToken) {
            // --- مسار الطوارئ ---
            console.log('Emergency Mode Active');
            this.startBackdoorTimer(); // تشغيل المؤقت فوراً

            // تحديث الواجهة ببيانات الطوارئ
            this.updateWelcomeMessage('Emergency Admin');
            // إخفاء/إظهار الأزرار حسب صلاحيات الطوارئ (عادةً صلاحيات كاملة)
            this.updateSettingsButtonVisibility('super_admin');
            this.updateutmbuilderButtonVisibility('super_admin');
            this.updatemanagespendButtonVisibility('super_admin');
            this.updaterecordspendButtonVisibility('super_admin');
            this.updatecampaignmanagerButtonVisibility('super_admin');

            this.fetchAllData();
            return; // توقف هنا! لا تكمل التحقق من localStorage
        }

        // 2. المسار العادي: التحقق من localStorage
        const adminToken = localStorage.getItem('admin_token');

        if (adminToken) {
            // --- المسار العادي ---
            const role = localStorage.getItem('user_role');
            const email = localStorage.getItem('user_email');

            this.updateWelcomeMessage(email);
            this.updateSettingsButtonVisibility(role);
            this.updateutmbuilderButtonVisibility(role);
            this.updatemanagespendButtonVisibility(role);
            this.updaterecordspendButtonVisibility(role);
            this.updatecampaignmanagerButtonVisibility(role);

            this.fetchAllData();
        } else {
            // لا يوجد دخول -> توجيه لصفحة الدخول
            window.location.href = 'login';
        }
    }

    // ============================================================
    // (NEW) Backdoor Session Timer (10 Minutes) - Persistent
    // ============================================================
    startBackdoorTimer() {
        // 1. حساب الوقت المتبقي بناءً على التخزين المحلي
        const DURATION = 600; // 10 دقائق بالثواني
        let startTime = localStorage.getItem('backdoor_start_time');

        if (!startTime) {
            startTime = Math.floor(Date.now() / 1000);
            localStorage.setItem('backdoor_start_time', startTime);
        }

        // 2. إنشاء عنصر المؤقت إذا لم يكن موجوداً
        let timerDiv = document.getElementById('backdoor-timer');
        if (!timerDiv) {
            timerDiv = document.createElement('div');
            timerDiv.id = 'backdoor-timer';
            timerDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg font-mono font-bold z-[9999] flex items-center gap-2 animate-pulse';
            timerDiv.innerHTML = `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                <span id="timer-countdown">--:--</span>
            `;
            document.body.appendChild(timerDiv);
        }

        // 3. بدء العد التنازلي
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            const elapsed = now - parseInt(startTime);
            let timeLeft = DURATION - elapsed;

            if (timeLeft <= 0) {
                clearInterval(this.backdoorInterval);
                localStorage.removeItem('backdoor_start_time'); // تنظيف
                this.showNotification('انتهت جلسة الطوارئ (10 دقائق). سيتم تسجيل الخروج الآن.', 'alert');
                this.logout();
                return;
            }

            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            const el = document.getElementById('timer-countdown');
            if (el) el.textContent = display;

            // تحذير بصري عند قرب الانتهاء
            if (timeLeft <= 60) {
                timerDiv.classList.remove('bg-red-600');
                timerDiv.classList.add('bg-red-800', 'scale-110');
            }
        };

        // تنظيف أي مؤقت سابق لمنع التداخل
        if (this.backdoorInterval) clearInterval(this.backdoorInterval);

        this.backdoorInterval = setInterval(updateTimer, 1000);
        updateTimer(); // استدعاء فوري
    }

    showLogin() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('dashboard-container').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('dashboard-container').style.display = 'flex';
    }

    async logout() {
        try {
            // 1. طلب تسجيل الخروج من السيرفر (لحذف الكوكيز إن وجدت)
            await fetch(`${this.API_URL}?action=logout`, {
                method: 'POST',
                // لا نحتاج لانتظار الرد، المهم إرسال الطلب
            });
        } catch (e) {
            console.warn('Logout server request failed', e);
        } finally {
            // 2. تنظيف التخزين المحلي في كل الأحوال
            localStorage.removeItem('admin_token');
            localStorage.removeItem('user_role');
            localStorage.removeItem('auth_type');
            localStorage.removeItem('user_permissions');
            localStorage.removeItem('basic_cred');

            // [FIX] Clear Escalation Token
            sessionStorage.removeItem('escalation_token');
            sessionStorage.removeItem('user_role');
            sessionStorage.removeItem('auth_type');

            // 3. إعادة تحميل الصفحة لصفحة الدخول
            window.location.href = 'login';
        }
    }

    toggleDesktopSidebar() {
        const sidebar = document.getElementById('desktop-sidebar');
        if (sidebar) {
            if (sidebar.classList.contains('w-72')) {
                sidebar.classList.remove('w-72');
                sidebar.classList.add('w-0');
            } else {
                sidebar.classList.remove('w-0');
                sidebar.classList.add('w-72');
            }
        }
    }

    bindEvents() {
        // --- (NEW) Mobile Sidebar Toggle ---
        const mobileBtn = document.getElementById('mobile-menu-btn');
        const mobileSidebar = document.getElementById('mobile-sidebar');
        const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
        const closeSidebarBtn = document.getElementById('mobile-close-sidebar');

        const toggleSidebar = (show) => {
            if (show) {
                mobileSidebar?.classList.remove('translate-x-full');
                mobileBackdrop?.classList.remove('hidden');
                setTimeout(() => mobileBackdrop?.classList.remove('opacity-0'), 10);
            } else {
                mobileSidebar?.classList.add('translate-x-full');
                mobileBackdrop?.classList.add('opacity-0');
                setTimeout(() => mobileBackdrop?.classList.add('hidden'), 300);
            }
        };

        if (mobileBtn) {
            mobileBtn.addEventListener('click', () => toggleSidebar(true));
        }
        if (closeSidebarBtn) {
            closeSidebarBtn.addEventListener('click', () => toggleSidebar(false));
        }
        if (mobileBackdrop) {
            mobileBackdrop.addEventListener('click', () => toggleSidebar(false));
        }

        // --- (NEW) Initialize WhatsApp UI ---
        this.initWhatsApp();
        // ---------------------------------
        // ---------------------------------

        // 1. تسجيل الدخول (محدث للنظام الهجين)
        // داخل دالة bindEvents()




        document.getElementById('login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button');
            const errorMsg = document.getElementById('login-error');

            btn.disabled = true;
            btn.textContent = 'جاري التحقق...';
            errorMsg.style.display = 'none';

            const u = document.getElementById('username').value;
            const p = document.getElementById('password').value;

            try {
                const response = await fetch(this.API_URL, { // تأكد أن الرابط يدعم /login
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: u, password: p })
                });

                const result = await response.json();
                console.log("Login API Response:", result); // [DEBUG]

                if (response.ok && result.success) {
                    // تخزين التوكن والدور
                    localStorage.setItem('admin_token', result.token || '');
                    localStorage.setItem('user_role', result.role || 'editor');
                    localStorage.setItem('auth_type', result.type || 'unknown');
                    localStorage.setItem('user_permissions', JSON.stringify(result.permissions || { can_edit: false, can_view_stats: false }));
                    localStorage.setItem('user_email', u);
                    localStorage.setItem('user_first_name', result.first_name || '');
                    localStorage.setItem('user_last_name', result.last_name || '');
                    console.log("Saved to localStorage:", { first: result.first_name, last: result.last_name }); // [DEBUG]
                    if (result.type === 'backdoor') {
                        localStorage.setItem('basic_cred', btoa(u + ':' + p));
                    }

                    window.location.reload();
                } else {
                    throw new Error(result.error || 'فشل الدخول');
                }
            } catch (err) {
                errorMsg.textContent = err.message;
                errorMsg.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'دخول';
            }
        });

        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('logout-btn-desktop')?.addEventListener('click', () => this.logout()); // Desktop Logout
        document.getElementById('logout-btn-mobile')?.addEventListener('click', () => this.logout());
        document.getElementById('desktop-sidebar-toggle')?.addEventListener('click', () => this.toggleDesktopSidebar());

        // Refresh Buttons (Mobile & Desktop)
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.fetchAllData());
        document.getElementById('refresh-btn-desktop')?.addEventListener('click', () => {
            const btn = document.getElementById('refresh-btn-desktop');
            const icon = btn.querySelector('svg');
            if (icon) icon.classList.add('animate-spin');
            this.fetchAllData().finally(() => setTimeout(() => {
                if (icon) icon.classList.remove('animate-spin');
            }, 1000));
        });

        // Data Source Toggle
        document.getElementById('data-source-select')?.addEventListener('change', (e) => {
            const source = e.target.value;
            const label = source === 'sheets' ? 'Google Sheets 📊' : 'Supabase ⚡';
            this.showNotification(`تم تغيير مصدر البيانات إلى: ${label}`, 'info');
            this.fetchAllData();
        });

        // Export PDF Button (Transactions) - Event Delegation
        document.addEventListener('click', (e) => {
            const pdfBtn = e.target.closest('#export-pdf-btn') || e.target.closest('#mobile-export-pdf-btn');
            if (pdfBtn) {
                console.log('Export PDF button clicked');
                try {
                    const stats = this.calculateKPIs(this.filteredData);
                    if (typeof window.generatePDF === 'function') {
                        generatePDF(this.filteredData, { filtered: stats }, { email: localStorage.getItem('user_email') || 'admin@luxalry.shop' });
                    } else {
                        console.error('generatePDF function is not defined globally');
                        alert('خطأ: وظيفة التصدير غير جاهزة.');
                    }
                } catch (err) {
                    console.error('Error exporting PDF:', err);
                    alert('حدث خطأ أثناء التصدير: ' + err.message);
                }
            }

            // Export Dashboard Overview Button - Event Delegation
            const dashBtn = e.target.closest('#export-dashboard-btn') || e.target.closest('#mobile-export-dashboard-btn');
            if (dashBtn) {
                console.log('Export Dashboard button clicked');
                try {
                    const overallStats = this.calculateKPIs(this.allData);
                    const filteredStats = this.calculateKPIs(this.filteredData);
                    const advancedStats = this.getAdvancedStats(this.filteredData);

                    // 1. Capture Charts
                    const getChartImg = (id) => {
                        const canvas = document.getElementById(id);
                        return canvas ? canvas.toDataURL('image/png') : null;
                    };

                    const charts = {
                        revenue: getChartImg('metrics-daily-revenue-chart'),
                        funnel: getChartImg('metrics-daily-funnel-chart'),
                        payment: getChartImg('payment-method-chart'),
                        experience: getChartImg('experience-chart'),
                        qualification: getChartImg('qualification-chart'),
                        language: getChartImg('language-chart')
                    };

                    // 2. Scrape Tables
                    const scrapeTable = (bodyId, colCount) => {
                        const rows = [];
                        document.querySelectorAll(`#${bodyId} tr`).forEach(tr => {
                            const rowData = [];
                            tr.querySelectorAll('td').forEach(td => rowData.push(td.innerText));
                            if (rowData.length > 0 && rowData[0] !== 'جاري التحليل...') rows.push(rowData);
                        });
                        return rows;
                    };

                    // Scrape Product Stats (Grid to Table)
                    const scrapeProducts = () => {
                        const rows = [];
                        document.querySelectorAll('#product-stats-container div').forEach(div => {
                            const name = div.querySelector('h4')?.innerText;
                            const count = div.querySelector('p')?.innerText;
                            if (name && count) rows.push([name, count]);
                        });
                        return rows;
                    };

                    const tables = {
                        marketing: this.currentMarketingData || [], // Use raw structured data
                        ads: this.currentAdPerformanceData || [], // [NEW] Use raw structured data
                        products: scrapeProducts()
                    };

                    if (typeof window.exportDashboardPDF === 'function') {
                        exportDashboardPDF(overallStats, filteredStats, advancedStats, charts, tables, { email: localStorage.getItem('user_email') || 'admin@luxalry.shop' });
                    } else {
                        alert('خطأ: وظيفة التصدير الشامل غير جاهزة.');
                    }

                } catch (err) {
                    console.error('Error exporting Dashboard:', err);
                    alert('حدث خطأ أثناء التصدير: ' + err.message);
                }
            }
        });


        // زر الإعدادات الجديد
        // زر الإعدادات (Mobile & Desktop)
        document.getElementById('settings-btn')?.addEventListener('click', () => this.openSettingsModal());
        document.getElementById('settings-btn-desktop')?.addEventListener('click', () => {
            console.log('Settings button clicked');
            this.openSettingsModal();
        });

        // Filter Toggles (Mobile & Desktop)
        const toggleFilter = () => {
            const sheet = document.getElementById('filter-sheet');
            if (sheet) sheet.classList.remove('hidden');
        };
        document.getElementById('mobile-filter-toggle')?.addEventListener('click', toggleFilter);
        document.getElementById('desktop-filter-toggle')?.addEventListener('click', toggleFilter);

        // باقي الفلاتر كما هي...
        ['search-input', 'status-filter', 'payment-filter', 'product-filter', 'external-filter', 'campaign-filter', 'utm-id-filter'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                // Trigger on 'input' for text fields, 'change' for selects
                const eventType = (id.includes('input') || id === 'utm-id-filter') ? 'input' : 'change';
                el.addEventListener(eventType, () => this.applyLocalFilters());
            }
        });

        // Date filters trigger server-side re-fetch to optimize performance
        ['date-filter', 'start-date', 'end-date', 'date-filter-desktop'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this.fetchAllData();
                });
            }
        });

        // KPI Glossary Modal Logic
        const kpiModal = document.getElementById('kpi-glossary-modal');
        const openKpiBtn = document.getElementById('kpi-info-btn');
        const closeKpiBtn = document.getElementById('close-kpi-modal');
        const closeKpiBtnBottom = document.getElementById('close-kpi-modal-btn');

        if (kpiModal && openKpiBtn) {
            openKpiBtn.addEventListener('click', () => {
                kpiModal.classList.remove('hidden');
                kpiModal.classList.add('flex');
            });

            const closeKpi = () => {
                kpiModal.classList.add('hidden');
                kpiModal.classList.remove('flex');
            };

            closeKpiBtn?.addEventListener('click', closeKpi);
            closeKpiBtnBottom?.addEventListener('click', closeKpi);

            // Close on backdrop click
            kpiModal.addEventListener('click', (e) => {
                if (e.target === kpiModal) closeKpi();
            });
        }

        document.getElementById('date-filter')?.addEventListener('change', (e) => {
            const c = document.getElementById('custom-date-range');
            if (c) c.classList.toggle('hidden', e.target.value !== 'custom');
        });

        document.getElementById('prev-page')?.addEventListener('click', () => this.changePage(-1));
        document.getElementById('next-page')?.addEventListener('click', () => this.changePage(1));

        const addBtn = document.getElementById('add-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.showAddModal());
        // 4. أزرار الميزات الجديدة (UTM & Spend)
        const utmBtn = document.getElementById('utm-builder-btn');
        if (utmBtn) utmBtn.addEventListener('click', () => this.showUTMBuilderModal());

        const recordBtn = document.getElementById('record-spend-btn');
        if (recordBtn) recordBtn.addEventListener('click', () => this.showRecordSpendModal());

        const campBtn = document.getElementById('campaign-manager-btn');
        if (campBtn) campBtn.addEventListener('click', () => this.showCampaignManagerModal());

        document.getElementById('campaign-filter')?.addEventListener('change', () => this.applyLocalFilters());

        // ============================================================
        // 5. [إصلاح حاسم] زر عرض السجل (Manage Spend)
        // ============================================================
        const manageBtn = document.getElementById('manage-spend-btn');

        if (manageBtn) {
            // إزالة أي مستمع قديم (لتجنب التكرار)
            const newBtn = manageBtn.cloneNode(true);
            manageBtn.parentNode.replaceChild(newBtn, manageBtn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault(); // منع أي سلوك افتراضي
                console.log("تم ضغط زر عرض السجل!"); // رسالة للتأكد في الكونسول

                const section = document.getElementById('spend-management-section');
                if (section) {
                    section.classList.toggle('hidden');

                    if (!section.classList.contains('hidden')) {
                        // 1. تحميل البيانات
                        this.renderSpendManagementTable();
                        // 2. [جديد] التمرير التلقائي للأسفل لرؤية الجدول
                        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        // 3. تمييز القسم بوميض بسيط
                        section.classList.add('ring-4', 'ring-orange-200');
                        setTimeout(() => section.classList.remove('ring-4', 'ring-orange-200'), 1000);
                    }
                } else {
                    this.showNotification("خطأ: قسم الجدول (spend-management-section) غير موجود في HTML!", 'error');
                }
            });
        } else {
            console.warn("تنبيه: زر 'manage-spend-btn' غير موجود في الصفحة.");
        }
    }

    // ============================================================
    // دوال إدارة المصاريف (يجب أن تكون هنا داخل الكلاس)
    // ============================================================
    renderSpendManagementTable() {
        const tbody = document.getElementById('spend-table-body');
        if (!tbody) return;

        if (!this.spendData || this.spendData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">لا توجد مصاريف مسجلة.</td></tr>`;
            return;
        }

        tbody.innerHTML = this.spendData.map((item, idx) => `
            <tr class="hover:bg-slate-800 border border-slate-700/50 transition-colors border-b border-slate-700/50">
                <td class="px-4 py-3 font-mono text-slate-400">${item.date}</td>
                <td class="px-4 py-3 font-bold text-white">${this.sanitizeHTML(item.campaign)}</td>
                <td class="px-4 py-3 text-sm text-slate-400">${this.sanitizeHTML(item.source)}</td>
                <td class="px-4 py-3 text-center text-slate-500 text-xs">${item.impressions ? item.impressions.toLocaleString() : '-'}</td>
                <td class="px-4 py-3 text-center text-slate-500 text-xs">${item.clicks ? item.clicks.toLocaleString() : '-'}</td>
                <td class="px-4 py-3 text-center font-bold text-orange-400 dir-ltr">${parseFloat(item.spend).toLocaleString()}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="dashboard.openEditSpendModal('${item.id}')" class="text-blue-400 hover:text-blue-300 p-1 bg-blue-900/20 rounded border border-blue-800/50" title="تعديل">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onclick="dashboard.deleteSpendRecord('${item.id}')" class="text-red-400 hover:text-red-300 p-1 bg-red-900/20 rounded border border-red-800/50" title="حذف">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    async deleteSpendRecord(spendId) {
        // استبدال confirm بالنافذة المخصصة
        this.showCustomConfirm('هل أنت متأكد من حذف هذا السجل المالي؟', async () => {
            try {
                const res = await fetch(`${this.API_URL}?action=delete_spend`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ spendId: spendId })
                });

                if (res.ok) {
                    this.showNotification('تم الحذف بنجاح ✅', 'success');
                    await this.fetchAllData();
                } else {
                    this.showNotification('فشل الحذف', 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
        });
    }
    openEditSpendModal(spendId) {
        const item = this.spendData.find(i => i.id === spendId);
        if (!item) return;

        const h = `
        <form id="edit-spend-form" class="space-y-4 text-right" dir="rtl">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">التاريخ</label>
                    <input type="date" name="date" required class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${item.date}">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">الحملة</label>
                    <input type="text" name="campaign" required class="w-full p-2 border border-slate-700 rounded bg-slate-800 border border-slate-700 text-slate-400" value="${item.campaign}" readonly>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">المصدر</label>
                <input type="text" name="source" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${item.source}">
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">UTM ID</label>
                <input type="text" name="utm_id" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${item.utm_id || ''}">
            </div>
            <div class="grid grid-cols-3 gap-3 bg-orange-900/20 p-3 rounded border border-orange-800/50">
                <div>
                    <label class="block text-[10px] font-bold text-slate-400">Spend</label>
                    <input type="number" step="0.01" name="spend" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white font-bold" value="${item.spend}">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400">Impressions</label>
                    <input type="number" name="impressions" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${item.impressions}">
                </div>
                <div>
                    <label class="block text-[10px] font-bold text-slate-400">Clicks</label>
                    <input type="number" name="clicks" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${item.clicks}">
                </div>
            </div>
        </form>`;

        const act = `
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700">إلغاء</button>
            <button id="btn-update-spend" class="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">حفظ التعديلات</button>
        `;

        const m = this.createModal('تعديل مصروف', h, act);

        m.querySelector('#btn-update-spend').onclick = async () => {
            const btn = m.querySelector('#btn-update-spend');
            btn.textContent = '...'; btn.disabled = true;

            const form = m.querySelector('#edit-spend-form');
            const fd = new FormData(form);
            const payload = {
                spendId: spendId,
                ...Object.fromEntries(fd.entries())
            };

            try {
                const res = await fetch(`${this.API_URL}?action=update_spend`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.showNotification('تم التعديل بنجاح ✅', 'success');
                    m.remove(); // نغلق نافذة التعديل الصغيرة فقط
                    await this.fetchAllData(); // نحدث البيانات في الخلفية (والجدول الكبير سيبقى مفتوحاً)

                    // [تم الحذف]: document.getElementById('spend-management-section').classList.add('hidden');
                } else {
                    this.showNotification('فشل التعديل', 'error');
                    btn.textContent = 'حفظ التعديلات'; btn.disabled = false;
                }
            } catch (e) {
                this.showNotification(e.message, 'error');
                btn.textContent = 'حفظ التعديلات'; btn.disabled = false;
            }
        };
    }

    // ============================================================
    // منشئ الروابط مع الدليل الذكي (UTM Builder + Smart Guide)
    // ============================================================
    showUTMBuilderModal() {
        // 1. محتوى الدليل الإرشادي (HTML)
        const guideHTML = `
        <div class="mb-4 border border-blue-500/30 rounded-lg bg-slate-800 border border-slate-700/50 overflow-hidden shadow-sm transition-all duration-300" id="utm-guide-container">
            <button onclick="document.getElementById('utm-guide-content').classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');" 
                    class="w-full flex justify-between items-center p-3 bg-blue-900/20 hover:bg-blue-900/30 text-blue-300 font-bold text-xs transition-colors">
                <span class="flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    دليل التصنيف: كيف يفرق النظام بين المجاني والمدفوع؟
                </span>
                <svg class="w-4 h-4 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            
            <div id="utm-guide-content" class="hidden p-4 bg-slate-900 text-xs text-slate-400 leading-relaxed border-t border-blue-500/30">
                <p class="mb-2 font-bold text-white">يعتمد النظام على القواعد التالية لتصنيف المعاملات في الداشبورد:</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div class="bg-green-900/20 p-2 rounded border border-green-800/50">
                        <span class="block font-bold text-green-400 mb-1">🟢 زيارات مجانية (Organic)</span>
                        <ul class="list-disc list-inside space-y-1">
                            <li>عند اختيار الوسيط (Medium): <br><code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">organic</code>, <code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">social</code>, <code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">whatsapp</code></li>
                            <li>أو عند اختيار المصدر (Source): <br><code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">manual_entry</code> (للإدخال اليدوي)</li>
                            <li><span class="text-xs text-green-400">مثال: نشر رابط في جروب فيسبوك أو إرساله في واتساب.</span></li>
                        </ul>
                    </div>

                    <div class="bg-blue-900/20 p-2 rounded border border-blue-800/50">
                        <span class="block font-bold text-blue-400 mb-1">🔵 زيارات مدفوعة (Paid Ads)</span>
                        <ul class="list-disc list-inside space-y-1">
                            <li>عند اختيار الوسيط (Medium): <br><code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">cpc</code>, <code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">paid_social</code>, <code class="bg-slate-800 border border-slate-700 px-1 rounded bg-slate-800 border border-slate-700 border border-slate-700">display</code></li>
                            <li><b>أو</b> إذا كان اسم الحملة (Campaign) مطابقاً لحملة لها "مصاريف" مسجلة في النظام.</li>
                            <li><span class="text-xs text-blue-400">مثال: إعلانات Facebook ممولة أو Google Ads.</span></li>
                        </ul>
                    </div>
                </div>
                
                <div class="mt-3 text-[10px] text-slate-400 border-t pt-2">
                    * نصيحة: استخدم دائماً <b>cpc</b> في خانة Medium للإعلانات الممولة لضمان دقة الحسابات 100%.
                </div>
            </div>
        </div>`;

        // 2. محتوى النافذة (HTML)
        const h = `
        <div class="space-y-4 text-right" dir="rtl">
            ${guideHTML}

            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">رابط الصفحة الأساسي (Website URL)</label>
                <input id="utm-base-url" class="w-full p-2 bg-slate-800 border border-slate-700 rounded text-left dir-ltr focus:ring-2 focus:ring-blue-500" placeholder="https://luxalry.shop/" value="https://luxalry.shop/">
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">UTM ID (للتتبع الدقيق)<span class="text-red-500">*</span></label>
                <input id="utm-id" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500" placeholder="ex: 123456789">
                <p class="text-[10px] text-slate-400 mt-1">معرف فريد للحملة (Facebook Campaign ID, Google Ad ID).</p>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">المصدر (Source) <span class="text-red-500">*</span></label>
                <input id="utm-source" list="source-suggestions" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500" placeholder="اختر أو اكتب (ex: facebook)">
                
                <datalist id="source-suggestions">
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="google">Google</option>
                    <option value="tiktok">TikTok</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="snapchat">Snapchat</option>
                    <option value="youtube">YouTube</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email / Newsletter</option>
                    <option value="sms">SMS</option>
                    <option value="manual_entry">Manual Entry (إدخال يدوي)</option>
                </datalist>
                
                <p class="text-[10px] text-slate-400 mt-1">المنصة: اختر من القائمة لتوحيد التقارير.</p>
            </div>
                <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">الوسيط (Medium) <span class="text-red-500">*</span></label>
                <select id="utm-medium" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm bg-slate-900 text-white focus:ring-2 focus:ring-blue-500">
                    <optgroup label="إعلانات مدفوعة (Paid Ads) - [يُحسب كتكلفة]">
                        <option value="cpc">CPC (دفع للنقرة - Performance)</option>
                        <option value="cpm">CPM (دفع للظهور - Awareness)</option>
                        <option value="display">Display (بانر/صورة في موقع)</option>
                        <option value="paid_social">Paid Social (إعلان ممول عام)</option>
                    </optgroup>

                    <optgroup label="سوشيال ميديا مجاني (Organic Social)">
                        <option value="organic">Organic (وصول طبيعي)</option>
                        <option value="social">Social (مشاركة عامة)</option>
                        <option value="post">Post (منشور عادي)</option>
                        <option value="story">Story (قصة/سناب/ستوري)</option>
                        <option value="reel">Reel/TikTok (فيديو قصير)</option>
                        <option value="profile">Profile/Bio (رابط البايو)</option>
                        <option value="video">Video (يوتيوب/فيديو طويل)</option>
                    </optgroup>

                    <optgroup label="مراسلات مباشرة (Messaging)">
                        <option value="whatsapp">WhatsApp (رسالة/حالة)</option>
                        <option value="email">Email (نشرة بريدية)</option>
                        <option value="sms">SMS (رسالة نصية)</option>
                        <option value="push">Push Notification (إشعار تطبيق)</option>
                    </optgroup>

                    <optgroup label="أخرى (Others)">
                        <option value="referral">Referral (إحالة من موقع آخر)</option>
                        <option value="affiliate">Affiliate (تسويق بالعمولة)</option>
                        <option value="influencer">Influencer (مؤثرين)</option>
                        <option value="qr">QR Code (مطبوعات/أوفلاين)</option>
                        <option value="event">Event (حدث/فعالية)</option>
                    </optgroup>
                </select>
                <p class="text-[10px] text-slate-400 mt-1">نوع التكلفة أو آلية النشر (يحدد تصنيف الزيارة).</p>
            </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">اسم الحملة (Campaign Name) <span class="text-red-500">*</span></label>
                <input id="utm-campaign" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm" placeholder="summer_offer, pmp_launch">
                <p class="text-[10px] text-slate-400 mt-1">اسم المشروع. <span class="text-blue-400">إذا طابق اسماً في سجل المصاريف، سيُعتبر مدفوعاً تلقائياً.</span></p>
            </div>

            <div class="grid grid-cols-2 gap-4 bg-slate-800 border border-slate-700/50 p-3 rounded border border-slate-700">
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">المحتوى (Content) - اختياري</label>
                    <input id="utm-content" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm" placeholder="video_ad_1, banner_blue">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">الكلمة/الجمهور (Term) - اختياري</label>
                    <input id="utm-term" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm" placeholder="managers, lookalike">
                </div>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-700">
                <label class="block text-xs font-bold text-blue-400 mb-2">الرابط النهائي (Generated URL)</label>
                <div class="flex gap-2">
                    <input id="utm-result" readonly class="w-full p-3 bg-slate-800 border border-slate-700 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-xs font-mono text-slate-400 break-all" dir="ltr" value="...">
                    <button id="btn-copy-url" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 rounded flex items-center justify-center" title="نسخ الرابط">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    </button>
                </div>
            </div>
        </div>`;

        const act = `
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700 transition">إغلاق</button>
        `;

        this.createModal('منشئ روابط التتبع (UTM Builder)', h, act);

        // --- المنطق التفاعلي (Live Generation) ---
        const inputs = ['utm-base-url', 'utm-source', 'utm-medium', 'utm-campaign', 'utm-content', 'utm-term', 'utm-id'];
        const resultInput = document.getElementById('utm-result');

        const generateURL = () => {
            const baseUrl = document.getElementById('utm-base-url').value.trim();
            const source = document.getElementById('utm-source').value.trim();
            const medium = document.getElementById('utm-medium').value.trim();
            const campaign = document.getElementById('utm-campaign').value.trim();
            const content = document.getElementById('utm-content').value.trim();
            const term = document.getElementById('utm-term').value.trim();
            const utmId = document.getElementById('utm-id').value.trim();

            if (!baseUrl || !utmId || !source || !medium || !campaign) {
                resultInput.value = 'الرجاء ملء الحقول الإجبارية (*) لتوليد الرابط';
                return;
            }

            try {
                const url = new URL(baseUrl);
                url.searchParams.set('utm_source', source);
                url.searchParams.set('utm_medium', medium);
                url.searchParams.set('utm_campaign', campaign);
                if (content) url.searchParams.set('utm_content', content);
                if (term) url.searchParams.set('utm_term', term);
                if (utmId) url.searchParams.set('utm_id', utmId);

                resultInput.value = url.toString();
            } catch (e) {
                resultInput.value = 'رابط أساسي غير صالح';
            }
        };

        inputs.forEach(id => {
            document.getElementById(id).addEventListener('input', generateURL);
        });

        document.getElementById('btn-copy-url').onclick = () => {
            if (resultInput.value && !resultInput.value.startsWith('الرجاء')) {
                navigator.clipboard.writeText(resultInput.value);
                const originalIcon = document.getElementById('btn-copy-url').innerHTML;
                document.getElementById('btn-copy-url').innerHTML = '<span class="text-green-400 font-bold text-xs">تم!</span>';
                setTimeout(() => document.getElementById('btn-copy-url').innerHTML = originalIcon, 2000);
            }
        };
    }

    // ============================================================
    // (NEW) نافذة تسجيل حملة جديدة (Campaign Manager)
    // ============================================================
    showCampaignManagerModal() {
        // 1. تحضير الجدول مع الأزرار والميزانية
        const campaignsList = this.campaignConfig.map(c => `
            <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-800 border border-slate-700/50 group">
                <td class="p-2 font-bold text-white dir-ltr text-right">${c.name}</td>
                <td class="p-2 text-center font-mono text-blue-400">${c.budget ? parseFloat(c.budget).toLocaleString() : '0'}</td>
                <td class="p-2 text-center font-mono text-blue-400">${c.utm_id}</td>
                <td class="p-2 dir-ltr text-slate-400">${c.start.replace('T', ' ')}</td>
                <td class="p-2 dir-ltr text-slate-400">${c.end ? c.end.replace('T', ' ') : '-'}</td>
                <td class="p-2 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] ${c.status === 'Active' ? 'bg-green-900/20 text-green-400' : 'bg-slate-800 border border-slate-700 text-slate-400'}">${c.status}</span>
                </td>
                <td class="p-2 text-center">
                    <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="dashboard.editCampaign('${encodeURIComponent(JSON.stringify(c))}')" class="text-blue-400 hover:text-blue-300 p-1 bg-blue-900/20 rounded border border-blue-800/50" title="تعديل">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onclick="dashboard.deleteCampaign('${c.name}')" class="text-red-400 hover:text-red-300 p-1 bg-red-900/20 rounded border border-red-800/50" title="حذف">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="6" class="p-4 text-center text-slate-400">لا توجد حملات مسجلة.</td></tr>';

        const h = `
        <div class="space-y-6 text-right" dir="rtl">
            <form id="add-campaign-form" class="bg-blue-900/20 p-4 rounded-lg border border-blue-800/50">
                <h4 class="text-sm font-bold text-blue-300 mb-3 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                    تسجيل حملة جديدة
                </h4>
                <div class="space-y-3">
                    <div class="grid grid-cols-3 gap-3">
                        <div class="col-span-2">
                            <label class="block text-xs font-bold text-slate-300 mb-1">اسم الحملة (UTM Campaign) <span class="text-red-500">*</span></label>
                            <input id="cmp-name" name="name" class="w-full p-2 border border-blue-800/50 rounded text-sm bg-slate-900 text-white focus:ring-2 focus:ring-blue-500 dir-ltr text-right" placeholder="ex: pmp_campaign">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">الميزانية (Budget)</label>
                            <input type="number" name="budget" class="w-full p-2 border border-blue-800/50 rounded text-sm bg-slate-900 text-white" placeholder="0.00">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">UTM ID (اختياري)</label>
                        <input name="utm_id" class="w-full p-2 border border-blue-800/50 rounded text-sm bg-slate-900 text-white dir-ltr text-right" placeholder="ex: 123456789">
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">وقت البداية <span class="text-red-500">*</span></label>
                            <input type="datetime-local" name="start" required class="w-full p-2 border border-blue-500/50 rounded text-sm bg-slate-900 text-white dir-ltr text-right">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">وقت النهاية (اختياري)</label>
                            <input type="datetime-local" name="end" class="w-full p-2 border border-blue-500/50 rounded text-sm bg-slate-900 text-white dir-ltr text-right">
                        </div>
                    </div>

                    <div>
                         <label class="block text-xs font-bold text-slate-300 mb-1">الحالة</label>
                         <select name="status" class="w-full p-2 border border-blue-800/50 rounded text-sm bg-slate-900 text-white">
                            <option value="Active">Active (نشطة)</option>
                            <option value="Ended">Ended (منتهية)</option>
                            <option value="Scheduled">Scheduled (مجدولة)</option>
                         </select>
                    </div>
                </div>
            </form>

            <div class="border rounded-lg overflow-hidden">
                <div class="bg-slate-800 border border-slate-700 p-2 text-xs font-bold text-slate-300 border-b border-slate-700 flex justify-between">
                    <span>سجل الحملات (Campaign Registry)</span>
                    <button onclick="dashboard.fetchAllData()" class="text-blue-400 hover:text-blue-300 text-[10px]">تحديث القائمة ↻</button>
                </div>
                <div class="max-h-60 overflow-y-auto">
                    <table class="w-full text-right">
                        <thead class="bg-slate-800 border border-slate-700 text-slate-400 text-[10px] sticky top-0">
                            <tr>
                                <th class="p-2">الحملة</th>
                                <th class="p-2 text-center">الميزانية</th>
                                <th class="p-2 text-center">معرف الحملة</th>
                                <th class="p-2">البداية</th>
                                <th class="p-2">النهاية</th>
                                <th class="p-2 text-center">الحالة</th>
                                <th class="p-2 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="campaign-list-body">
                            ${campaignsList}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;

        const act = `
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700 transition">إغلاق</button>
            <button id="btn-save-campaign" class="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 transition shadow">حفظ الحملة</button>
        `;

        const m = this.createModal('إدارة توقيتات وميزانيات الحملات', h, act);

        // منطق الحفظ (تم إصلاح مشكلة pmp_campaign)
        m.querySelector('#btn-save-campaign').onclick = async () => {
            const form = m.querySelector('#add-campaign-form');
            const nameInput = m.querySelector('#cmp-name');

            // [تصحيح] إزالة التنظيف الصارم. فقط نزيل المسافات الزائدة
            nameInput.value = nameInput.value.trim();

            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());

            if (!payload.name || !payload.start) {
                this.showNotification('الاسم ووقت البداية مطلوبان.', 'error');
                return;
            }

            const btn = m.querySelector('#btn-save-campaign');
            btn.textContent = 'جاري الحفظ...'; btn.disabled = true;

            try {
                const res = await fetch(`${this.API_URL}?action=add_campaign`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.showNotification('تم تسجيل الحملة بنجاح ✅', 'success');

                    // التغيير هنا: بدلاً من m.remove()، نقوم بتنظيف النموذج وتحديث الجدول فقط
                    form.reset();
                    btn.textContent = 'حفظ الحملة'; btn.disabled = false;

                    // تحديث البيانات في الخلفية ثم تحديث الجدول داخل المودال
                    await this.fetchAllData();

                    // إعادة رسم جدول الحملات داخل المودال نفسه
                    const newList = this.campaignConfig.map(c => `
                        <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-800 border border-slate-700/50 group">
                            <td class="p-2 font-bold text-white dir-ltr text-right">${c.name}</td>
                            <td class="p-2 text-center font-mono text-blue-400">${c.budget ? parseFloat(c.budget).toLocaleString() : '0'}</td>
                            <td class="p-2 text-center font-mono text-blue-400">${c.utm_id}</td>
                            <td class="p-2 dir-ltr text-slate-400">${c.start.replace('T', ' ')}</td>
                            <td class="p-2 dir-ltr text-slate-400">${c.end ? c.end.replace('T', ' ') : '-'}</td>
                            <td class="p-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] ${c.status === 'Active' ? 'bg-green-900/20 text-green-400' : 'bg-slate-800 border border-slate-700 text-slate-400'}">${c.status}</span></td>
                            <td class="p-2 text-center">
                                <div class="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onclick="dashboard.editCampaign('${encodeURIComponent(JSON.stringify(c))}')" class="text-blue-400 hover:text-blue-300 p-1 bg-blue-900/20 rounded border border-blue-800/50">✎</button>
                                    <button onclick="dashboard.deleteCampaign('${c.name}')" class="text-red-400 hover:text-red-300 p-1 bg-red-900/20 rounded border border-red-800/50">✕</button>
                                </div>
                            </td>
                        </tr>`).join('');

                    const listBody = m.querySelector('#campaign-list-body');
                    if (listBody) listBody.innerHTML = newList;
                } else {
                    const err = await res.json();
                    this.showNotification('فشل الحفظ: ' + (err.error || 'خطأ غير معروف'), 'error'); btn.textContent = 'حفظ الحملة'; btn.disabled = false;
                }
            } catch (e) {
                this.showNotification('خطأ اتصال: ' + e.message, 'error');
                btn.textContent = 'حفظ الحملة'; btn.disabled = false;
            }
        };
    }

    // ============================================================
    // (NEW) دوال الحذف والتعديل للحملات
    // ============================================================
    async deleteCampaign(name) {
        this.showCustomConfirm(`هل أنت متأكد من حذف الحملة "${name}"؟`, async () => {
            try {
                const res = await fetch(`${this.API_URL}?action=delete_campaign`, {
                    method: 'DELETE',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ name })
                });

                if (res.ok) {
                    this.showNotification('تم الحذف بنجاح', 'success');
                    // إغلاق المودال القديم
                    document.getElementById('modal-container').innerHTML = '';
                    this.fetchAllData().then(() => this.showCampaignManagerModal());
                } else {
                    this.showNotification('فشل الحذف', 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
        });
    }

    editCampaign(campaignStr) {
        const c = JSON.parse(decodeURIComponent(campaignStr));

        // مودال صغير للتعديل
        const h = `
        <form id="edit-camp-form" class="space-y-4 text-right" dir="rtl">
            <div>
                <label class="block text-xs font-bold text-slate-400 mb-1">اسم الحملة (للإشارة فقط - لا يمكن تعديله)</label>
                <input class="w-full p-2 border rounded bg-slate-800 border border-slate-700 text-slate-400" value="${c.name}" disabled>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">UTM ID</label>
                <input name="utm_id" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${c.utm_id || ''}">
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">الميزانية (Budget)</label>
                <input type="number" name="budget" class="w-full p-2 border border-slate-700 rounded bg-slate-900 text-white" value="${c.budget || ''}">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">البداية</label>
                    <input type="datetime-local" name="start" class="bg-slate-800 w-full p-2 border rounded text-left dir-ltr" value="${c.start}">
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1">النهاية</label>
                    <input type="datetime-local" name="end" class="bg-slate-800 w-full p-2 border rounded text-left dir-ltr" value="${c.end || ''}">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">الحالة</label>
                <select name="status" class="w-full p-2 border rounded bg-slate-900 text-white">
                    <option value="Active" ${c.status === 'Active' ? 'selected' : ''}>Active</option>
                    <option value="Ended" ${c.status === 'Ended' ? 'selected' : ''}>Ended</option>
                    <option value="Scheduled" ${c.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                </select>
            </div>
        </form>`;

        const act = `
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700">إلغاء</button>
            <button id="btn-update-camp" class="px-4 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700">حفظ التعديلات</button>
        `;

        // إغلاق المودال الكبير مؤقتاً لفتح الصغير (أو يمكن عرضه فوقه بـ z-index أعلى، لكن الإغلاق أسهل)
        document.getElementById('modal-container').innerHTML = '';
        const m = this.createModal(`تعديل حملة: ${c.name}`, h, act);

        m.querySelector('#btn-update-camp').onclick = async () => {
            const form = m.querySelector('#edit-camp-form');
            const fd = new FormData(form);
            const payload = {
                originalName: c.name, // المفتاح للبحث
                budget: fd.get('budget'),
                start: fd.get('start'),
                end: fd.get('end'),
                status: fd.get('status'),
                utm_id: fd.get('utm_id')
            };

            try {
                const res = await fetch(`${this.API_URL}?action=update_campaign`, {
                    method: 'POST', // نستخدم POST لأننا عرفناه كذلك في الباكند للتحديث
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.showNotification('تم التعديل بنجاح', 'success');
                    m.remove();
                    this.fetchAllData().then(() => this.showCampaignManagerModal()); // العودة للقائمة
                } else {
                    this.showNotification('فشل التعديل', 'error');
                }
            } catch (e) { this.showNotification(e.message, 'error'); }
        };
    }

    // ============================================================
    // (New) Show Record Spend Modal
    // ============================================================
    showRecordSpendModal() {
        // 1. استخراج قائمة الحملات الفريدة من البيانات الحالية لتسهيل الاختيار
        const existingCampaigns = [...new Set(this.allData.map(i => i.utm_campaign))].filter(c => c && c !== 'undefined' && c !== 'Organic/Direct').sort();

        // إنشاء خيارات القائمة
        const campaignOptions = existingCampaigns.map(c => `<option value="${c}">${c}</option>`).join('');

        const h = `
    <form id="spend-form" class="space-y-4 text-right" dir="rtl">
        <div class="bg-orange-900/20 p-3 rounded-lg border border-orange-500/50 flex gap-2 items-start">
            <svg class="w-5 h-5 text-orange-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
            <p class="text-xs text-orange-400">
                تسجيل المصاريف اليومية يتيح للنظام حساب العائد على الاستثمار (ROAS) وتكلفة الاستحواذ (CPA).
            </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">التاريخ <span class="text-red-500">*</span></label>
                <input type="date" name="date" required class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm focus:ring-2 focus:ring-orange-500" value="${new Date().toISOString().split('T')[0]}">
            </div>

            <div>
                <label class="block text-xs font-bold text-slate-300 mb-1">الحملة (Campaign) <span class="text-red-500">*</span></label>
                <div class="relative">
                    <input list="campaigns-list" name="campaign" required class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm focus:ring-2 focus:ring-orange-500" placeholder="اكتب أو اختر...">
                    <datalist id="campaigns-list">
                        ${campaignOptions}
                    </datalist>
                </div>
            </div>
            
            <div class="col-span-1 md:col-span-2">
                <label class="block text-xs font-bold text-slate-300 mb-1">UTM ID (اختياري)</label>
                <input type="text" name="utm_id" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm text-white" placeholder="معرف الحملة (للمطابقة الدقيقة)">
            </div>
        </div>

        <div class="grid grid-cols-3 gap-3 bg-slate-800 border border-slate-700/50 p-3 rounded border">
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">المبلغ المصروف (Spend) <span class="text-red-500">*</span></label>
                <input type="number" step="0.01" name="spend" required class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm font-bold text-white" placeholder="0.00">
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">الظهور (Impressions)</label>
                <input type="number" name="impressions" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm" placeholder="0">
            </div>
            <div>
                <label class="block text-[10px] font-bold text-slate-400 mb-1">النقرات (Clicks)</label>
                <input type="number" name="clicks" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm" placeholder="0">
            </div>
        </div>

        <div>
            <label class="block text-xs font-bold text-slate-300 mb-1">المصدر (Source) - اختياري</label>
            <select name="source" class="w-full p-2 bg-slate-800 border border-slate-700 border border-slate-700 rounded text-sm bg-slate-900 text-white">
                <option value="All">عام / متعدد المصادر</option>
                <option value="facebook">Facebook / Instagram</option>
                <option value="google">Google Ads</option>
                <option value="tiktok">TikTok</option>
                <option value="snapchat">Snapchat</option>
                <option value="linkedin">LinkedIn</option>
            </select>
        </div>
    </form>`;

        const act = `
        <button onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded hover:bg-slate-700 transition">إلغاء</button>
        <button id="btn-save-spend" class="px-4 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 transition shadow flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            حفظ البيانات
        </button>
    `;

        const m = this.createModal('تسجيل مصاريف إعلانية', h, act);

        // منطق الحفظ
        m.querySelector('#btn-save-spend').onclick = async () => {
            const form = m.querySelector('#spend-form');
            if (!form.checkValidity()) {
                this.showNotification('يرجى ملء الحقول الإجبارية (التاريخ، الحملة، المبلغ)', 'error');
                return;
            }

            const btn = m.querySelector('#btn-save-spend');
            btn.textContent = 'جاري الحفظ...'; btn.disabled = true;

            const fd = new FormData(form);
            const payload = Object.fromEntries(fd.entries());

            try {
                const res = await fetch(`${this.API_URL}?action=add_spend`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    this.showNotification('تم تسجيل المصروف بنجاح ✅', 'success');
                    m.remove();
                    // سنقوم بإعادة تحميل البيانات لكي تظهر التحديثات فوراً في الحسابات
                    this.fetchAllData();
                } else {
                    const err = await res.json();
                    this.showNotification('فشل الحفظ: ' + (err.error || 'خطأ غير معروف'), 'error');
                    btn.textContent = 'حفظ البيانات'; btn.disabled = false;
                }
            } catch (e) {
                this.showNotification('خطأ في الاتصال: ' + e.message, 'error');
                btn.textContent = 'حفظ البيانات'; btn.disabled = false;
            }
        };
    }

    // ============================================================
    // (NEW) Mobile Navigation Active State Logic
    // ============================================================
    initMobileNav() {
        // تعريف الأزرار ووظائفها
        const navActions = {
            'mobile-utm-builder-btn': () => this.showUTMBuilderModal(),
            'mobile-campaigns-btn': () => this.showCampaignManagerModal(),
            'mobile-record-spend-btn': () => this.showRecordSpendModal(),
            'mobile-manage-spend-btn': () => {
                const section = document.getElementById('spend-management-section');
                if (section) {
                    section.classList.remove('hidden');
                    this.renderSpendManagementTable();
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    // وميض للتمييز
                    section.classList.add('ring-2', 'ring-amber-500');
                    setTimeout(() => section.classList.remove('ring-2', 'ring-amber-500'), 1500);
                } else {
                    this.showNotification('قسم إدارة المصاريف غير موجود', 'error');
                }
            },
            'mobile-settings-btn': () => this.openSettingsModal()
        };

        // ربط الأحداث
        Object.keys(navActions).forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                // إزالة أي مستمعين سابقين (اختياري، لكن جيد للنظافة)
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);

                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    // تشغيل الوظيفة
                    navActions[id]();

                    // تحديث الحالة النشطة (Visual Feedback)
                    document.querySelectorAll('.mobile-nav-btn').forEach(b => {
                        b.classList.remove('text-blue-400', 'scale-110');
                        b.classList.add('text-slate-400');
                    });
                    // الزر الحالي (باستثناء الزر العائم الكبير)
                    if (id !== 'mobile-record-spend-btn') {
                        newBtn.classList.remove('text-slate-400');
                        newBtn.classList.add('text-blue-400', 'scale-110');
                    }
                });
            }
        });
    }
    
    // ============================================================
    // (NEW) WhatsApp Integration
    // ============================================================
    initWhatsApp() {
        const waBtn = document.getElementById('whatsapp-btn');
        if (waBtn) {
            waBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openWhatsAppModal();
            });
        }
    }

    openWhatsAppModal() {
        let container = document.getElementById('modal-container');
        if (!container) return;
        
        const tmpl = document.getElementById('whatsapp-modal-template');
        if (!tmpl) return;
        
        container.innerHTML = '';
        container.appendChild(tmpl.content.cloneNode(true));
        
        // Ensure close functionality
        const closeBtn = document.getElementById('close-whatsapp-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                container.innerHTML = '';
                this.currentWhatsAppConversation = null;
            });
        }
        
        this.loadWhatsAppConversations();
    }
    
    async loadWhatsAppConversations() {
        const listDiv = document.getElementById('conversations-list');
        if (!listDiv) return;
        
        listDiv.innerHTML = '<div class="p-8 text-center text-slate-500">جاري التحميل...</div>';
        
        try {
            const authHeaders = this.getAuthHeaders();
            const res = await fetch(`${this.API_URL}-whatsapp?action=conversations`, {
                headers: authHeaders
            });
            const data = await res.json();
            
            if (data.success && data.conversations) {
                if (data.conversations.length === 0) {
                    listDiv.innerHTML = '<div class="p-8 text-center text-slate-500">لا توجد محادثات.</div>';
                    return;
                }
                
                listDiv.innerHTML = '';
                data.conversations.forEach(conv => {
                    const el = document.createElement('div');
                    el.className = 'p-4 border-b border-slate-800/50 hover:bg-slate-800 cursor-pointer transition-colors';
                    const name = conv.customer_name || 'عميل غير معروف';
                    const time = new Date(conv.updated_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    
                    el.innerHTML = `
                        <div class="flex justify-between items-start mb-1">
                            <span class="font-bold text-slate-200">${this.escapeHtml(name)}</span>
                            <span class="text-xs text-slate-500">${time}</span>
                        </div>
                        <div class="text-sm text-slate-400" dir="ltr">${this.escapeHtml(conv.phone_number)}</div>
                    `;
                    el.addEventListener('click', () => {
                        // Highlight selection
                        listDiv.querySelectorAll('div').forEach(d => d.classList.remove('bg-slate-800'));
                        el.classList.add('bg-slate-800');
                        this.openWhatsAppChat(conv);
                    });
                    listDiv.appendChild(el);
                });
            } else {
                listDiv.innerHTML = '<div class="p-4 text-center text-red-400">فشل التحميل.</div>';
            }
        } catch (e) {
            listDiv.innerHTML = '<div class="p-4 text-center text-red-400">خطأ في الاتصال.</div>';
        }
    }
    
    async openWhatsAppChat(conversation) {
        this.currentWhatsAppConversation = conversation;
        
        document.getElementById('chat-header').classList.remove('hidden');
        document.getElementById('chat-input-area').classList.remove('hidden');
        document.getElementById('chat-customer-name').textContent = conversation.customer_name || 'عميل غير معروف';
        document.getElementById('chat-customer-phone').textContent = '+' + conversation.phone_number;
        
        const msgsDiv = document.getElementById('chat-messages');
        msgsDiv.innerHTML = '<div class="absolute inset-0 flex items-center justify-center"><div class="text-slate-500">جاري التحميل...</div></div>';
        
        // Check window validity
        const statusEl = document.getElementById('chat-window-status');
        const form = document.getElementById('chat-form');
        const errBanner = document.getElementById('chat-error-banner');
        
        const lastInbound = conversation.last_inbound_timestamp ? new Date(conversation.last_inbound_timestamp).getTime() : 0;
        const now = Date.now();
        const isValidWindow = (now - lastInbound) <= (24 * 60 * 60 * 1000) && lastInbound > 0;
        
        if (isValidWindow) {
            statusEl.textContent = 'متاح للإرسال (نافذة 24 ساعة)';
            statusEl.className = 'text-xs px-2 py-1 rounded bg-green-900/30 text-green-400';
            form.querySelector('textarea').disabled = false;
            form.querySelector('button').disabled = false;
            errBanner.classList.add('hidden');
        } else {
            statusEl.textContent = 'مغلق (انتهت نافذة 24 ساعة)';
            statusEl.className = 'text-xs px-2 py-1 rounded bg-red-900/30 text-red-400';
            form.querySelector('textarea').disabled = true;
            form.querySelector('button').disabled = true;
            errBanner.classList.remove('hidden');
            document.getElementById('chat-error-text').textContent = 'لا يمكنك إرسال رسالة حرة. يجب أن يرسل العميل رسالة أولاً لفتح نافذة 24 ساعة، أو استخدم قالب معتمد.';
        }
        
        // Fetch messages
        try {
            const authHeaders = this.getAuthHeaders();
            const res = await fetch(`${this.API_URL}-whatsapp?action=messages&conversationId=${conversation.id}`, {
                headers: authHeaders
            });
            const data = await res.json();
            
            msgsDiv.innerHTML = ''; // Clear background text
            
            if (data.success && data.messages) {
                data.messages.forEach(msg => {
                    const wrapper = document.createElement('div');
                    wrapper.className = `flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`;
                    
                    const bubble = document.createElement('div');
                    bubble.className = `max-w-[85%] rounded-lg px-3 py-2 text-sm relative ${msg.direction === 'outbound' ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-slate-200 rounded-tl-none'}`;
                    
                    let statusIcon = '';
                    if (msg.direction === 'outbound') {
                        if (msg.status === 'read') statusIcon = '<span class="text-blue-400 ml-1">✓✓</span>';
                        else if (msg.status === 'delivered') statusIcon = '<span class="text-slate-400 ml-1">✓✓</span>';
                        else if (msg.status === 'sent') statusIcon = '<span class="text-slate-400 ml-1">✓</span>';
                        else if (msg.status === 'failed') statusIcon = '<span class="text-red-400 ml-1">!</span>';
                        else statusIcon = '<span class="text-slate-500 ml-1 opacity-50">✓</span>';
                    }
                    
                    const time = new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    
                    bubble.innerHTML = `
                        <div class="whitespace-pre-wrap break-words">${this.escapeHtml(msg.body)}</div>
                        <div class="text-[10px] text-right mt-1 opacity-70 flex justify-end items-center gap-1">
                            ${time} ${statusIcon}
                        </div>
                    `;
                    
                    wrapper.appendChild(bubble);
                    msgsDiv.appendChild(wrapper);
                });
                
                // Scroll to bottom
                msgsDiv.scrollTop = msgsDiv.scrollHeight;
            }
        } catch (e) {
            msgsDiv.innerHTML = '<div class="text-center text-red-400 mt-4">فشل تحميل الرسائل.</div>';
        }
        
        // Bind form
        form.onsubmit = async (e) => {
            e.preventDefault();
            const textInput = document.getElementById('chat-input');
            const text = textInput.value;
            if (!text || text.trim() === '') return;
            
            const btn = document.getElementById('chat-send-btn');
            const originalContent = btn.innerHTML;
            btn.innerHTML = '...';
            btn.disabled = true;
            textInput.disabled = true;
            
            try {
                const res = await fetch(`${this.API_URL}-whatsapp?action=send`, {
                    method: 'POST',
                    headers: Object.assign({ 'Content-Type': 'application/json' }, this.getAuthHeaders()),
                    body: JSON.stringify({ conversationId: conversation.id, text: text })
                });
                
                const data = await res.json();
                if (data.success) {
                    textInput.value = '';
                    this.openWhatsAppChat(conversation); // Reload chat safely
                } else {
                    errBanner.classList.remove('hidden');
                    document.getElementById('chat-error-text').textContent = 'فشل الإرسال: ' + (data.message || data.error || 'Unknown error');
                }
            } catch (err) {
                errBanner.classList.remove('hidden');
                document.getElementById('chat-error-text').textContent = 'خطأ في الشبكة.';
            } finally {
                btn.innerHTML = originalContent;
                btn.disabled = false;
                textInput.disabled = false;
                textInput.focus();
            }
        };
        
        // Enter to send
        document.getElementById('chat-input').addEventListener('keypress', function (e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AdminDashboard();
});

