// ==UserScript==
// @name         Bitrix24 Auto-Filter & Scheduled Sync (Hooks + Full UI Control + Excel Export All)
// @namespace    http://tampermonkey.net/
// @version      6.5.1
// @description  Глобальні хуки + Динамічне додавання Канбан-груп через UI + Експорт у Excel (ВСІ 4 звіти)
// @author       Valeriy
// @match        https://portal.viyar.ua/*
// @match        https://marushchakvaleriy-alt.github.io/modern-load-manager/*
// @match        http://localhost:*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================================
    // БЛОК 1: ГЛОБАЛЬНІ ХУКИ ТА ЗБЕРЕЖЕННЯ КАНБАНУ
    // =========================================================================
    let globalKanbanDb = {};
    try { globalKanbanDb = JSON.parse(GM_getValue('bx_kanban_hooks_db', '{}')); } catch(e){}

    function saveHooksDb() { 
        GM_setValue('bx_kanban_hooks_db', JSON.stringify(globalKanbanDb)); 
    }

    function scanCurrentKanbanDom(customDoc) {
        try {
            var doc = customDoc || document;
            var columns = doc.querySelectorAll('.main-kanban-column, [data-role="column"], .tasks-kanban-column, [data-type="column"]');
            var count = 0;
            columns.forEach(function(col) {
                var titleEl = col.querySelector('.main-kanban-column-title, .kanban-column-title, [data-role="column-title"], .tasks-kanban-column-title, h4, h3, .title');
                var rawStageName = (titleEl ? titleEl.innerText : '').trim();
                var stageName = rawStageName.replace(/\s*\(\d+\)$/, '').replace(/\s+\d+$/, '').trim();
                if (!stageName) return;

                var items = col.querySelectorAll('.main-kanban-item, [data-id], .tasks-kanban-item, [data-item-id]');
                items.forEach(function(item) {
                    var rawId = item.getAttribute('data-id') || item.getAttribute('data-item-id') || '';
                    var cleanId = String(rawId || '').replace(/^[^\d]+/, '').replace(/[^\d]+$/, '');
                    if (cleanId && /^\d+$/.test(cleanId)) {
                        globalKanbanDb[cleanId] = stageName;
                        count++;
                    }
                });
            });
            if (count > 0) {
                console.log('[Bitrix Kanban DOM] Зчитано ' + count + ' задач. Всього в базі:', Object.keys(globalKanbanDb).length);
                saveHooksDb();
            }
        } catch(e) {}
    }

    function analyzeBitrixNetworkTraffic(text) {
        if (!text) return;
        try {
            let data = null;
            try { data = JSON.parse(text); } catch(e) {}

            let cols = null;
            let items = null;

            if (data && typeof data === 'object') {
                if (data.data && data.data.columns && data.data.items) {
                    cols = data.data.columns;
                    items = data.data.items;
                } else if (data.columns && data.items) {
                    cols = data.columns;
                    items = data.items;
                } else if (data.data) {
                    cols = data.data.columns || (data.data.grid && data.data.grid.columns);
                    items = data.data.items || (data.data.grid && data.data.grid.items);
                }
            }

            if (!cols || !items) {
                let colsMatch = text.match(/"columns"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\](?=\s*,\s*"|\s*\}))/);
                let itemsMatch = text.match(/"items"\s*:\s*(\[\s*\{[\s\S]*?\}\s*\](?=\s*,\s*"|\s*\}))/);
                if (colsMatch && itemsMatch) {
                    try {
                        cols = JSON.parse(colsMatch[1]);
                        items = JSON.parse(itemsMatch[1]);
                    } catch(e) {}
                }
            }

            if (Array.isArray(cols) && Array.isArray(items)) {
                let stages = {};
                cols.forEach(c => { 
                    if (c && c.id) {
                        var rawName = String(c.name || c.title || '').trim();
                        stages[c.id] = rawName.replace(/\s*\(\d+\)$/, '').replace(/\s+\d+$/, '').trim();
                    }
                });

                let added = 0;
                items.forEach(item => {
                    let rawId = String(item.id || '').replace(/^[^\d]+/, '');
                    let colId = item.columnId || item.stageId || item.statusId;
                    if (rawId && colId && stages[colId]) {
                        globalKanbanDb[rawId] = stages[colId];
                        added++;
                    }
                });
                if (added > 0) {
                    console.log(`[Bitrix Kanban Hook] Збережено ${added} статусів задач у базу! Всього в базі: ${Object.keys(globalKanbanDb).length}`);
                    saveHooksDb();
                }
            }
        } catch(e) {
            console.error('[Bitrix Kanban Hook Error]', e);
        }
    }

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._reqUrl = url;
        return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', function() {
            try { 
                if (this.responseText && this._reqUrl && (this._reqUrl.includes('kanban') || this._reqUrl.includes('tasks'))) {
                    analyzeBitrixNetworkTraffic(this.responseText); 
                }
            } catch(e) {}
        });
        return origSend.apply(this, arguments);
    };

    const origFetch = window.fetch;
    window.fetch = async function() {
        const response = await origFetch.apply(this, arguments);
        try {
            const url = arguments[0] instanceof Request ? arguments[0].url : arguments[0];
            if (url && typeof url === 'string' && (url.includes('kanban') || url.includes('tasks'))) {
                const clone = response.clone();
                clone.text().then(text => analyzeBitrixNetworkTraffic(text)).catch(e=>{});
            }
        } catch(e){}
        return response;
    };

    var currentHost = window.location.hostname;
    document.addEventListener("DOMContentLoaded", function() {

        // =========================================================================
        // БЛОК 2: ДІЇ НА САЙТІ VIYAR LOAD PLANNER
        // =========================================================================
        if (currentHost.includes('github.io') || currentHost.includes('localhost')) {
            var isDelivering = false;
            async function checkAndDeliverData() {
                if (isDelivering) return;
                isDelivering = true;
                try {
                    var depts = ['design', 'construction'];
                    for (var i = 0; i < depts.length; i++) {
                        var dept = depts[i];
                        var key = 'LM_SHARED_PROJECTS_' + dept.toUpperCase();
                        var rawProjects = GM_getValue(key, null);
                        if (rawProjects) {
                            var parsed = typeof rawProjects === 'string' ? JSON.parse(rawProjects) : rawProjects;
                            var projects = Array.isArray(parsed) ? parsed : (parsed && parsed.projects ? parsed.projects : []);
                            var targetDept = parsed && parsed.department ? parsed.department : dept;
                            if (Array.isArray(projects) && projects.length > 0) {
                                window.postMessage({ type: 'BITRIX_AUTO_SYNC', projects: projects, department: targetDept }, '*');
                                GM_setValue(key, null);
                                await new Promise(r => setTimeout(r, 1500));
                            }
                        }
                    }
                } finally { isDelivering = false; }
            }
            setInterval(checkAndDeliverData, 1000);
            setTimeout(checkAndDeliverData, 500);
            return;
        }

        // =========================================================================
        // БЛОК 3: ДОПОМІЖНІ ФУНКЦІЇ БІТРІКС24
        // =========================================================================
        function formatDateUA(date) {
            var d = String(date.getDate()).padStart(2, '0');
            var m = String(date.getMonth() + 1).padStart(2, '0');
            return d + '.' + m + '.' + date.getFullYear();
        }
        function formatDateISO(dateStr) {
            if (!dateStr || dateStr === '-') return null;
            var parts = dateStr.split(' ')[0].split(/[./-]/);
            if (parts.length === 3) return parts[0].length === 4 ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}` : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            return dateStr;
        }
        function mapBitrixStatus(statusStr, completedDate) {
            if (completedDate && completedDate !== '-' && completedDate !== '') return 'completed';
            var s = String(statusStr || '').toLowerCase();
            if (s.includes('заверш') || s.includes('complete')) return 'completed';
            if (s.includes('просроч') || s.includes('overdue')) return 'overdue';
            if (s.includes('ждет') || s.includes('awaiting')) return 'waiting';
            return 'active';
        }
        function getPeriodDates(preset) {
            var now = new Date();
            var from = new Date(), to = new Date();
            if (preset === 'current_month') {
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else if (preset === 'prev_month') {
                from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                to = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (preset === 'last_30') {
                from = new Date(now.getTime() - 30 * 86400000);
                to = now;
            }
            return { from: formatDateUA(from), to: formatDateUA(to) };
        }
        function findReportTable(doc) {
            var d = doc || document;
            return d.querySelector('table.reports-list-table') || d.querySelector('table.reports-view-table') || d.querySelector('table[id*="report"]') || d.querySelector('.reports-content table') || d.querySelector('table.main-grid-table');
        }
        function isValidTaskRow(tr) {
            var text = (tr.innerText || '').toLowerCase().trim();
            if (!text || (text.includes('название') && text.includes('статус')) || (text.includes('назва') && text.includes('стан')) || text.includes('страницы:') || text.includes('всего:')) return false;
            var tds = tr.querySelectorAll('td');
            if (tds.length < 3) return false;
            var firstCellText = (tds[0]?.innerText || '').trim();
            return !(!firstCellText || firstCellText === '—' || firstCellText === '-');
        }

        function parseDocToProjects(doc, defaultDepartment) {
            var table = findReportTable(doc);
            if (!table) return [];
            var headerCells = Array.from(table.querySelectorAll('th, thead tr td, tr:first-child td'));
            if (headerCells.length === 0) headerCells = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));
            var headers = headerCells.map(th => (th.innerText || '').trim().toLowerCase().replace(/[\s\u00A0]+/g, ' '));
            function getColIndex(keywords) { return headers.findIndex(h => keywords.some(k => h.includes(k.toLowerCase()) || h.replace(/\s+/g, '').includes(k.toLowerCase().replace(/\s+/g, '')))); }

            var idIdx = getColIndex(['id', 'айді', 'номер']);
            var nameIdx = getColIndex(['название', 'назва', 'задача']);
            var statusIdx = getColIndex(['статус', 'стан']);
            var createdIdx = getColIndex(['дата создания']);
            var deadlineIdx = getColIndex(['крайний срок']);
            var completedIdx = getColIndex(['дата завершения']);
            var plannedIdx = getColIndex(['планируемые трудозатраты']);
            var spentIdx = getColIndex(['затраченное время']);
            var respIdx = getColIndex(['ответственный']);
            var creatorIdx = getColIndex(['постановщик', 'постановник', 'создатель', 'автор', 'creator', 'створив', 'поставив', 'хто поставив', 'ким створено']);
            console.log('[Bitrix Parser] Заголовки звіту:', headers);
            console.log('[Bitrix Parser] Колонка постановника (індекс):', creatorIdx, creatorIdx !== -1 ? headers[creatorIdx] : 'НЕ ЗНАЙДЕНО');
            var pointsIdx = getColIndex(['point', 'поинты']);
            var typeIdx = getColIndex(['категорія', 'категория', 'вид работ']);
            var dirIdx = getColIndex(['напрямок']);
            var itemsIdx = getColIndex(['виріб+кількість', 'виріб']);

            if (nameIdx === -1) nameIdx = idIdx === 0 ? 1 : 0;
            if (statusIdx === -1) statusIdx = 1;

            var rows = Array.from(table.querySelectorAll('tr')).filter(isValidTaskRow);
            return rows.map(function (tr, idx) {
                var tds = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
                var rawId = idIdx !== -1 ? (tds[idIdx] || '').trim() : '';
                if (!rawId) {
                    var taskLink = tr.querySelector('a[href*="/tasks/task/view/"]');
                    if (taskLink) { var matchId = taskLink.href.match(/view\/(\d+)/); if (matchId) rawId = matchId[1]; }
                }
                var cleanId = String(rawId || '').replace(/^[^\d]+/, '');
                var name = (tds[nameIdx] || (idIdx === 0 ? tds[1] : tds[0]) || '').trim();
                if (!name || name === '—') return null;

                var kanbanStageStr = '';
                if (cleanId && globalKanbanDb[cleanId]) {
                    kanbanStageStr = globalKanbanDb[cleanId];
                }

                return {
                    id: cleanId ? 'btx-' + cleanId : 'btx-auto-' + Date.now() + '-' + idx,
                    bitrixId: cleanId,
                    externalId: cleanId,
                    name: name,
                    status: mapBitrixStatus(tds[statusIdx], tds[completedIdx]),
                    assignedEmployee: tds[respIdx] || 'Не призначено',
                    creator: creatorIdx !== -1 ? (tds[creatorIdx] || '') : '',
                    points: Number(tds[pointsIdx]) || 1,
                    plannedTime: tds[plannedIdx] || '',
                    spentTime: tds[spentIdx] || '',
                    direction: tds[dirIdx] || 'Загальне',
                    taskType: tds[typeIdx] || '',
                    itemsInfo: itemsIdx !== -1 ? (tds[itemsIdx] || '') : '',
                    kanbanStage: kanbanStageStr,
                    department: defaultDepartment || 'design',
                    startDate: tds[createdIdx] ? formatDateISO(tds[createdIdx]) : null,
                    deadline: tds[deadlineIdx] ? formatDateISO(tds[deadlineIdx]) : null,
                    completedAt: tds[completedIdx] ? formatDateISO(tds[completedIdx]) : null,
                    type: 'bitrix',
                    importedAt: new Date().toISOString()
                };
            }).filter(Boolean);
        }

        // =========================================================================
        // БЛОК 4: ЕКСПОРТ В EXCEL / CSV
        // =========================================================================
        function downloadProjectsAsExcelCsv(projects, filename) {
            if (!projects || projects.length === 0) {
                alert('Немає даних для вивантаження!');
                return;
            }

            var headers = [
                'Відділ',
                'ID задачі',
                'Назва проєкту/задачі',
                'Канбан-статус',
                'Статус звіту',
                'Постановник',
                'Відповідальний',
                'Поінти',
                'Напрямок',
                'Вид робіт / Категорія',
                'Виріб+кількість',
                'Дата створення',
                'Крайній термін',
                'Дата завершення'
            ];

            var rows = [headers];
            var withKanbanCount = 0;

            projects.forEach(function (p) {
                if (p.kanbanStage) withKanbanCount++;
                var deptLabel = p.departmentName || (p.department === 'construction' ? 'Конструювання' : 'Проєктування');
                rows.push([
                    deptLabel,
                    p.bitrixId || p.externalId || '',
                    (p.name || '').replace(/"/g, '""'),
                    (p.kanbanStage || 'НЕ ВКАЗАНО').replace(/"/g, '""'),
                    (p.status || '').replace(/"/g, '""'),
                    (p.creator || '').replace(/"/g, '""'),
                    (p.assignedEmployee || '').replace(/"/g, '""'),
                    p.points || 0,
                    (p.direction || '').replace(/"/g, '""'),
                    (p.taskType || '').replace(/"/g, '""'),
                    (p.itemsInfo || '').replace(/"/g, '""'),
                    p.startDate || '',
                    p.deadline || '',
                    p.completedAt || ''
                ]);
            });

            var csvContent = '\uFEFF' + rows.map(function (e) {
                return e.map(function (cell) {
                    return '"' + String(cell).replace(/\n/g, ' ').replace(/\r/g, '') + '"';
                }).join(';');
            }).join('\r\n');

            var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            var link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', (filename || 'viyar_projects_all_' + formatDateUA(new Date())) + '.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log(`[Excel Export] Завантажено ${projects.length} задач. З них з Канбан-статусом: ${withKanbanCount}`);
            alert(`Файл успішно сформовано!\nУсього задач у вивантаженні: ${projects.length}\nЗі знайденим Канбан-статусом: ${withKanbanCount} із ${projects.length}\n\nФайл .CSV завантажено.`);
        }

        // =========================================================================
        // БЛОК 5: КЕРУВАННЯ ЗБЕРЕЖЕНИМИ ДАНИМИ
        // =========================================================================
        function getSavedReportUrls(dept) {
            var raw = GM_getValue('bx_saved_reports_' + (dept || 'design'), null);
            try { return raw ? JSON.parse(raw) : []; } catch(e) { return []; }
        }

        function saveCurrentReportUrl(dept) {
            var currentList = getSavedReportUrls(dept);
            var url = new URL(window.location.href);
            url.searchParams.delete('PAGEN_1');
            url.searchParams.delete('F_DATE_FROM');
            url.searchParams.delete('F_DATE_TO');
            url.searchParams.delete('F_DATE_TYPE');
            var cleanUrlStr = url.toString();
            if (!currentList.includes(cleanUrlStr)) currentList.push(cleanUrlStr);
            GM_setValue('bx_saved_reports_' + (dept || 'design'), JSON.stringify(currentList));
            return currentList.length;
        }

        function clearSavedReportUrls(dept) {
            GM_setValue('bx_saved_reports_' + (dept || 'design'), JSON.stringify([]));
        }

        function getSavedKanbanGroups() {
            var raw = GM_getValue('bx_saved_kanban_groups', '[]');
            try { return JSON.parse(raw); } catch(e) { return []; }
        }

        function saveCurrentKanbanGroup() {
            var match = window.location.href.match(/group\/(\d+)/);
            if (!match) {
                alert('Не вдалося знайти ID групи. Переконайтеся, що ви знаходитеся на сторінці робочої групи (Канбан).');
                return getSavedKanbanGroups().length;
            }
            var groupId = match[1];
            var groups = getSavedKanbanGroups();
            if (!groups.includes(groupId)) {
                groups.push(groupId);
                GM_setValue('bx_saved_kanban_groups', JSON.stringify(groups));
                scanCurrentKanbanDom();
                alert('Групу ' + groupId + ' успішно додано! Задач у базі Канбану зараз: ' + Object.keys(globalKanbanDb).length);
            } else {
                scanCurrentKanbanDom();
                alert('Група ' + groupId + ' вже у списку. Статуси оновлено! Всього в базі: ' + Object.keys(globalKanbanDb).length);
            }
            return groups.length;
        }

        function clearSavedKanbanGroups() {
            GM_setValue('bx_saved_kanban_groups', '[]');
        }

        // =========================================================================
        // БЛОК 6: ПАНЕЛЬ КЕРУВАННЯ
        // =========================================================================
        function createControlPanel() {
            if (document.getElementById('bx-auto-panel')) return;

            var fab = document.createElement('div');
            fab.id = 'bx-auto-fab';
            fab.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 99999; background: #2563eb; color: white; padding: 10px 16px; border-radius: 30px; cursor: pointer; display: flex; gap: 8px; font-weight: bold; font-family: Arial; font-size: 13px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);';
            fab.innerHTML = '<span>🔄</span><span>Синхронізація</span><span id="bx-fab-status" style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px;">Готово</span>';

            var panel = document.createElement('div');
            panel.id = 'bx-auto-panel';
            panel.style.cssText = 'display: none; position: fixed; bottom: 80px; left: 20px; z-index: 99999; background: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); font-family: Arial; font-size: 13px; flex-direction: column; gap: 10px; width: 330px;';

            fab.onclick = () => panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';

            document.body.appendChild(fab);
            document.body.appendChild(panel);

            var savedInterval = GM_getValue('bx_auto_sync_interval_mins', 10);
            var designUrls = getSavedReportUrls('design');
            var constrUrls = getSavedReportUrls('construction');
            var kanbanGroups = getSavedKanbanGroups();
            var kanbanCount = Object.keys(globalKanbanDb).length;
            var totalReportsCount = designUrls.length + constrUrls.length || 1;

            panel.innerHTML = `
                <div style="font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: center;">
                    <span>ViYar Sync</span><span style="font-size: 10px; color: #94a3b8;">v6.5.1 (Постановник + Канбан)</span>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>📅 Період:</strong>
                    <select id="bx-period-select" style="padding: 4px; font-size: 12px; border-radius: 4px;">
                        <option value="current_month">Поточний місяць</option>
                        <option value="prev_month">Минулий місяць</option>
                        <option value="last_30">Останні 30 днів</option>
                    </select>
                </div>

                <!-- ПРОЄКТУВАННЯ -->
                <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <strong style="color: #1e40af;">📐 Проєктування:</strong>
                        <span id="bx-design-status" style="font-weight: bold; color: #1e3a8a;">${designUrls.length > 0 ? designUrls.length + ' звіт(и)' : 'Поточна'}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button id="bx-btn-add-design" style="flex: 1; border: 1px solid #93c5fd; background: #ffffff; padding: 3px; font-size: 10px; cursor: pointer; border-radius: 4px;">➕ Додати звіт</button>
                        <button id="bx-btn-reset-design" style="background: #fee2e2; border: 1px solid #fca5a5; padding: 3px; cursor: pointer; border-radius: 4px;">❌</button>
                    </div>
                    <button id="bx-btn-sync-design" style="background: #2563eb; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">⚡ Відправити Проєктування</button>
                </div>

                <!-- КОНСТРУЮВАННЯ -->
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <strong style="color: #166534;">🛠️ Конструювання:</strong>
                        <span id="bx-constr-status" style="font-weight: bold; color: #14532d;">${constrUrls.length > 0 ? constrUrls.length + ' звіт(и)' : 'Поточна'}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button id="bx-btn-add-constr" style="flex: 1; border: 1px solid #86efac; background: #ffffff; padding: 3px; font-size: 10px; cursor: pointer; border-radius: 4px;">➕ Додати звіт</button>
                        <button id="bx-btn-reset-constr" style="background: #fee2e2; border: 1px solid #fca5a5; padding: 3px; cursor: pointer; border-radius: 4px;">❌</button>
                    </div>
                    <button id="bx-btn-sync-constr" style="background: #16a34a; color: white; border: none; padding: 6px; border-radius: 4px; cursor: pointer; font-weight: bold;">🛠️ Відправити Конструювання</button>
                </div>

                <!-- КАНБАН ГРУПИ -->
                <div style="background: #fffbeb; border: 1px solid #fde68a; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; justify-content: space-between; font-size: 11px;">
                        <strong style="color: #b45309;">📋 Канбан групи:</strong>
                        <span id="bx-kanban-status" style="font-weight: bold; color: #92400e;">${kanbanGroups.length > 0 ? kanbanGroups.length + ' груп(и)' : 'Не додано'}</span>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button id="bx-btn-add-kanban" style="flex: 1; border: 1px solid #fcd34d; background: #ffffff; padding: 3px; font-size: 10px; cursor: pointer; border-radius: 4px;">➕ Додати поточну групу</button>
                        <button id="bx-btn-reset-kanban" style="background: #fee2e2; border: 1px solid #fca5a5; padding: 3px; cursor: pointer; border-radius: 4px;">❌</button>
                    </div>
                    <button id="bx-btn-check-kanban" style="background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 4px; border-radius: 4px; font-size: 11px; cursor: pointer;">🔍 Перевірити Канбан в базі (<span id="bx-kanban-count-span">${kanbanCount}</span>)</button>
                </div>

                <!-- ВИВАНТАЖЕННЯ EXCEL (ВСІ 4 ЗВІТИ) -->
                <button id="bx-btn-export-all-csv" style="background: #059669; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 6px rgba(5,150,105,0.3);">
                    <span>📥</span><span>Скачати Excel (ВСІ ${totalReportsCount} звіти)</span>
                </button>

                <!-- ВИВАНТАЖЕННЯ EXCEL (ЛИШЕ ПОТОЧНИЙ ЗВІТ) -->
                <button id="bx-btn-export-single-csv" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; padding: 4px; border-radius: 4px; cursor: pointer; font-size: 11px;">
                    📄 Скачати тільки поточний звіт
                </button>

                <button id="bx-btn-sync-all" style="background: #a855f7; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold;">✨ Синхронізувати ОБИДВА</button>

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-top: 4px;">
                    <strong>⏱️ Автосинхр:</strong>
                    <div><input type="number" id="bx-sync-interval-input" value="${savedInterval}" style="width: 35px; text-align: center; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px;"> хв</div>
                </div>

                <div style="font-size: 11px; text-align: center; border-top: 1px solid #edeef0; padding-top: 4px;">
                    <span id="bx-sync-status">Готово</span>
                </div>
            `;

            // Обробники Проєктування
            document.getElementById('bx-btn-add-design').onclick = () => {
                document.getElementById('bx-design-status').innerText = saveCurrentReportUrl('design') + ' звіт(и)';
            };
            document.getElementById('bx-btn-reset-design').onclick = () => {
                clearSavedReportUrls('design');
                document.getElementById('bx-design-status').innerText = 'Поточна';
            };
            document.getElementById('bx-btn-sync-design').onclick = () => runDirectAutoSync(true, 'design');

            // Обробники Конструювання
            document.getElementById('bx-btn-add-constr').onclick = () => {
                document.getElementById('bx-constr-status').innerText = saveCurrentReportUrl('construction') + ' звіт(и)';
            };
            document.getElementById('bx-btn-reset-constr').onclick = () => {
                clearSavedReportUrls('construction');
                document.getElementById('bx-constr-status').innerText = 'Поточна';
            };
            document.getElementById('bx-btn-sync-constr').onclick = () => runDirectAutoSync(true, 'construction');

            // Обробники Канбану
            document.getElementById('bx-btn-add-kanban').onclick = () => {
                document.getElementById('bx-kanban-status').innerText = saveCurrentKanbanGroup() + ' груп(и)';
                document.getElementById('bx-kanban-count-span').innerText = Object.keys(globalKanbanDb).length;
            };
            document.getElementById('bx-btn-reset-kanban').onclick = () => {
                clearSavedKanbanGroups();
                document.getElementById('bx-kanban-status').innerText = 'Не додано';
                alert('Список відстежуваних Канбан-груп очищено!');
            };
            document.getElementById('bx-btn-check-kanban').onclick = async () => {
                await prefetchTargetGroups();
                var keys = Object.keys(globalKanbanDb);
                var sample = keys.slice(0, 10).map(k => `#${k}: ${globalKanbanDb[k]}`).join('\n');
                alert(`У локальній базі Канбану збережено: ${keys.length} задач.\n\nПерші приклади:\n${sample || 'Поки що порожньо. Перейдіть на сторінку Канбану і натисніть "Додати поточну групу"!'}`);
            };

            // Експорт ВСІХ звітів у CSV (Excel)
            document.getElementById('bx-btn-export-all-csv').onclick = async () => {
                var btn = document.getElementById('bx-btn-export-all-csv');
                btn.innerText = '⏳ Збираю всі звіти...';
                try {
                    await prefetchTargetGroups();
                    var dates = getSelectedDates();
                    var allCombinedProjects = [];

                    var designUrls = getSavedReportUrls('design');
                    if (designUrls.length === 0) designUrls = [window.location.href];
                    var designProjects = await fetchProjectsForUrls(designUrls, dates);
                    designProjects.forEach(p => p.departmentName = 'Проєктування');
                    allCombinedProjects = allCombinedProjects.concat(designProjects);

                    var constrUrls = getSavedReportUrls('construction');
                    if (constrUrls.length > 0) {
                        var constrProjects = await fetchProjectsForUrls(constrUrls, dates);
                        constrProjects.forEach(p => p.departmentName = 'Конструювання');
                        allCombinedProjects = allCombinedProjects.concat(constrProjects);
                    }

                    // Також зберігаємо в буфер синхронізації для веб-додатку
                    if (designProjects.length > 0) {
                        GM_setValue('LM_SHARED_PROJECTS_DESIGN', JSON.stringify({ projects: designProjects, department: 'design' }));
                    }
                    if (constrProjects && constrProjects.length > 0) {
                        GM_setValue('LM_SHARED_PROJECTS_CONSTRUCTION', JSON.stringify({ projects: constrProjects, department: 'construction' }));
                    }

                    downloadProjectsAsExcelCsv(allCombinedProjects, 'viyar_all_reports_' + formatDateUA(new Date()));
                } catch(e) {
                    alert('Помилка експорту: ' + e.message);
                } finally {
                    btn.innerHTML = `<span>📥</span><span>Скачати Excel (ВСІ ${totalReportsCount} звіти)</span>`;
                }
            };

            // Експорт ТІЛЬКИ поточного звіту
            document.getElementById('bx-btn-export-single-csv').onclick = () => {
                var currentProjects = parseDocToProjects(document);
                downloadProjectsAsExcelCsv(currentProjects, 'viyar_current_report_' + formatDateUA(new Date()));
            };

            document.getElementById('bx-btn-sync-all').onclick = () => runDirectAutoSync(true, 'all');

            document.getElementById('bx-sync-interval-input').oninput = function() {
                GM_setValue('bx_auto_sync_interval_mins', Math.max(1, parseInt(this.value) || 10));
            };
        }

        // =========================================================================
        // БЛОК 7: ЛОГІКА СИНХРОНІЗАЦІЇ
        // =========================================================================
        async function prefetchTargetGroups() {
            let groups = getSavedKanbanGroups();
            for (let gid of groups) {
                try {
                    // Спроба 1: REST API Bitrix24 — найнадійніший спосіб отримати стадії
                    try {
                        // Отримуємо стадії канбану групи
                        let stagesRes = await fetch(`/rest/tasks.task.list?GROUP_ID=${gid}&select[]=ID&select[]=STAGE_ID&select[]=STATUS&FILTER[GROUP_ID]=${gid}&PAGEN_1=1&NAV_PARAMS[nPageSize]=200`, { credentials: 'same-origin' });
                        let stagesJson = await stagesRes.json();
                        analyzeBitrixNetworkTraffic(JSON.stringify(stagesJson));
                    } catch(e) {}

                    // Спроба 2: Kanban HTML сторінка
                    let res = await fetch(`/workgroups/group/${gid}/tasks/kanban/`, { credentials: 'same-origin' });
                    let text = await res.text();
                    analyzeBitrixNetworkTraffic(text);

                    // Якщо відповідь HTML - парсимо DOM
                    if (text.includes('main-kanban') || text.includes('tasks-kanban') || text.includes('data-id')) {
                        let doc = new DOMParser().parseFromString(text, 'text/html');
                        scanCurrentKanbanDom(doc);
                    }

                    // Спроба 3: Список задач групи
                    let resList = await fetch(`/workgroups/group/${gid}/tasks/`, { credentials: 'same-origin' });
                    let textList = await resList.text();
                    analyzeBitrixNetworkTraffic(textList);
                } catch(e) { }
            }
            var countEl = document.getElementById('bx-kanban-count-span');
            if (countEl) countEl.innerText = Object.keys(globalKanbanDb).length;
        }

        async function fetchProjectsForUrls(urlsToFetch, dates) {
            var allProjects = [];
            for (var u = 0; u < urlsToFetch.length; u++) {
                var page = 1;
                while (page <= 50) {
                    try {
                        var baseUrl = new URL(urlsToFetch[u]);
                        baseUrl.protocol = window.location.protocol;
                        baseUrl.host = window.location.host;
                        baseUrl.searchParams.set('set_filter', 'Y');
                        baseUrl.searchParams.set('F_DATE_TYPE', 'interval');
                        baseUrl.searchParams.set('F_DATE_FROM', dates.from);
                        baseUrl.searchParams.set('F_DATE_TO', dates.to);
                        baseUrl.searchParams.set('PAGEN_1', page);

                        var response = await fetch(baseUrl.toString(), { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
                        var htmlText = await response.text();
                        var doc = new DOMParser().parseFromString(htmlText, 'text/html');

                        var pageProjects = parseDocToProjects(doc);
                        if (pageProjects.length === 0) break;

                        allProjects = allProjects.concat(pageProjects);
                        if (!doc.querySelector(`a[href*="PAGEN_1=${page + 1}"], .modern-page-next`) || pageProjects.length < 5) break;
                        page++;
                    } catch (err) { break; }
                }
            }
            return allProjects;
        }

        async function runDirectAutoSync(isManual = false, targetDeptOverride = 'all') {
            var statusEl = document.getElementById('bx-sync-status');
            var fabStatus = document.getElementById('bx-fab-status');
            if (statusEl) statusEl.innerText = '⏳ Зчитування...';
            if (fabStatus) fabStatus.innerText = '⏳ Зчитування...';

            try {
                let groups = getSavedKanbanGroups();
                if (groups.length > 0) {
                    if (statusEl) statusEl.innerText = `⏳ Опитування Канбану (${groups.length})...`;
                    await prefetchTargetGroups();
                }

                var dates = getSelectedDates();
                var departmentsToSync = (!isManual || targetDeptOverride === 'all') ? ['design', 'construction'] : [targetDeptOverride];
                var grandTotalCount = 0;
                var grandKanbanCount = 0;
                var grandCreatorCount = 0;

                for (var d = 0; d < departmentsToSync.length; d++) {
                    var dept = departmentsToSync[d];
                    var urlsToFetch = getSavedReportUrls(dept);
                    if (urlsToFetch.length === 0) urlsToFetch = [window.location.href];

                    var deptProjects = await fetchProjectsForUrls(urlsToFetch, dates);

                    if (deptProjects.length > 0) {
                        grandTotalCount += deptProjects.length;
                        deptProjects.forEach(p => { 
                            p.department = dept;
                            if (p.kanbanStage) grandKanbanCount++; 
                            if (p.creator) grandCreatorCount++;
                        });

                        GM_setValue('LM_SHARED_PROJECTS_' + dept.toUpperCase(), JSON.stringify({ projects: deptProjects, department: dept }));
                        if (departmentsToSync.length > 1) await new Promise(r => setTimeout(r, 2000));
                    }
                }

                GM_setValue('lm_last_sync_time', Date.now());
                if (statusEl) statusEl.innerText = `✅ Готово (${grandTotalCount})`;
                if (fabStatus) fabStatus.innerText = `✅ Готово`;
                if (isManual) {
                    var creatorMsg = grandCreatorCount > 0
                        ? `З постановником: ${grandCreatorCount} із ${grandTotalCount}`
                        : `⚠️ Постановника НЕ виявлено! Перевірте, чи є колонка "Постановщик" або "Постановник" у звіті Бітрікс.`;
                    alert(`Успішно зібрано ${grandTotalCount} задач та відправлено у React!\nЗ Канбан-статусом: ${grandKanbanCount} із ${grandTotalCount}\n${creatorMsg}`);
                }

            } catch (err) {
                if (statusEl) statusEl.innerText = '❌ Помилка';
                if (fabStatus) fabStatus.innerText = '❌ Помилка';
            }
        }

        function getSelectedDates() {
            var select = document.getElementById('bx-period-select');
            return getPeriodDates(select ? select.value : 'current_month');
        }

        function checkScheduledAutoSync() {
            var lastSync = GM_getValue('lm_last_sync_time', null);
            var intervalMs = (GM_getValue('bx_auto_sync_interval_mins', 10) || 10) * 60 * 1000;
            if (!lastSync || (Date.now() - Number(lastSync)) > intervalMs) runDirectAutoSync();
        }

        function updateCountdown() {
            var lastSync = GM_getValue('lm_last_sync_time', null);
            var statusEl = document.getElementById('bx-sync-status');
            var fabStatus = document.getElementById('bx-fab-status');

            if (lastSync && statusEl && !statusEl.innerText.includes('⏳') && !statusEl.innerText.includes('❌')) {
                var leftMs = (GM_getValue('bx_auto_sync_interval_mins', 10) * 60 * 1000) - (Date.now() - Number(lastSync));
                if (leftMs <= 0) {
                    statusEl.innerText = '⏳ Запуск...';
                    if (fabStatus) fabStatus.innerText = '⏳ Запуск...';
                } else {
                    var leftSecs = Math.floor(leftMs / 1000);
                    var str = Math.floor(leftSecs / 60) + 'хв ' + (leftSecs % 60) + 'с';
                    statusEl.innerText = 'Наступна: ' + str;
                    if (fabStatus) fabStatus.innerText = str;
                }
            }
        }

        setTimeout(function () {
            createControlPanel();
            scanCurrentKanbanDom();
            setInterval(scanCurrentKanbanDom, 3000);
            checkScheduledAutoSync();
            setInterval(checkScheduledAutoSync, 5000);
            setInterval(updateCountdown, 1000);
        }, 1500);
    });
})();
