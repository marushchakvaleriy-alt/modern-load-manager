// ==UserScript==
// @name         Bitrix24 Auto-Filter & Scheduled Sync
// @namespace    http://tampermonkey.net/
// @version      5.6.1
// @description  Розумний захист від перехресного завантаження та рознесена автосинхронізація (Проєктування + Конструювання)
// @author       You
// @match        https://portal.viyar.ua/*
// @match        https://marushchakvaleriy-alt.github.io/modern-load-manager/*
// @match        http://localhost:*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// ==/UserScript==

(function () {
    'use strict';

    var currentHost = window.location.hostname;

    // =========================================================================
    // БЛОК 1: ДІЇ НА САЙТІ VIYAR LOAD PLANNER
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
                            console.log('[Tampermonkey Bridge] Відправляємо у React:', projects.length, 'задач, відділ:', targetDept);
                            window.postMessage({ type: 'BITRIX_AUTO_SYNC', projects: projects, department: targetDept }, '*');
                            GM_setValue(key, null);
                            await new Promise(function (r) { setTimeout(r, 1500); });
                        }
                    }
                }

                // Зворотна сумісність (Legacy)
                var rawLegacy = GM_getValue('LM_SHARED_PROJECTS', null);
                if (rawLegacy) {
                    var parsedL = typeof rawLegacy === 'string' ? JSON.parse(rawLegacy) : rawLegacy;
                    var projectsL = Array.isArray(parsedL) ? parsedL : (parsedL && parsedL.projects ? parsedL.projects : []);
                    var deptL = parsedL && parsedL.department ? parsedL.department : 'design';
                    if (Array.isArray(projectsL) && projectsL.length > 0) {
                        console.log('[Tampermonkey Bridge Legacy] Відправляємо у React:', projectsL.length, 'задач, відділ:', deptL);
                        window.postMessage({ type: 'BITRIX_AUTO_SYNC', projects: projectsL, department: deptL }, '*');
                        GM_setValue('LM_SHARED_PROJECTS', null);
                    }
                }
            } catch (e) {
                console.error('[Tampermonkey Bridge] Помилка:', e);
            } finally {
                isDelivering = false;
            }
        }

        setInterval(checkAndDeliverData, 1000);
        setTimeout(checkAndDeliverData, 500);
        return;
    }

    // =========================================================================
    // БЛОК 2: ДІЇ НА САЙТІ БІТРІКС24 (portal.viyar.ua)
    // =========================================================================
    function formatDateUA(date) {
        var d = String(date.getDate()).padStart(2, '0');
        var m = String(date.getMonth() + 1).padStart(2, '0');
        var y = date.getFullYear();
        return d + '.' + m + '.' + y;
    }

    function formatDateISO(dateStr) {
        if (!dateStr || dateStr === '-') return null;
        var parts = dateStr.split(' ')[0].split(/[./-]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
        return dateStr;
    }

    function mapBitrixStatus(statusStr, completedDate) {
        if (completedDate && completedDate !== '-' && completedDate !== '') return 'completed';
        var s = String(statusStr || '').toLowerCase();
        if (s.includes('заверш') || s.includes('complete')) return 'completed';
        if (s.includes('просроч') || s.includes('overdue') || s.includes('протермін')) return 'overdue';
        if (s.includes('ждет') || s.includes('awaiting') || s.includes('очікує')) return 'waiting';
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
        return d.querySelector('table.reports-list-table') ||
            d.querySelector('table.reports-view-table') ||
            d.querySelector('table[id*="report"]') ||
            d.querySelector('.reports-content table') ||
            d.querySelector('.reports-list-table-container table') ||
            d.querySelector('table.main-grid-table');
    }

    function isValidTaskRow(tr) {
        var text = (tr.innerText || '').toLowerCase().trim();
        if (!text) return false;
        if (text.includes('название') && text.includes('статус')) return false;
        if (text.includes('назва') && text.includes('стан')) return false;
        if (text.includes('страницы:') || text.includes('сторінки:')) return false;
        if (text.includes('предыдущая') || text.includes('следующая') || text.includes('ctrl')) return false;
        if (text.includes('всего:') || text.includes('всего') || text.includes('итого') || text.includes('разом') || text.includes('всього')) return false;

        var tds = tr.querySelectorAll('td');
        if (tds.length < 3) return false;

        var firstCellText = (tds[0]?.innerText || '').trim();
        if (!firstCellText || firstCellText === '—' || firstCellText === '-' || /^[\s—-]+$/.test(firstCellText)) return false;

        return true;
    }

    function parseDocToProjects(doc) {
        var table = findReportTable(doc);
        if (!table) return [];

        var headerCells = Array.from(table.querySelectorAll('th, thead tr td, tr:first-child td'));
        if (headerCells.length === 0) {
            headerCells = Array.from(table.querySelectorAll('tr:first-child th, tr:first-child td'));
        }

        var headers = headerCells.map(function (th) {
            return (th.innerText || '').trim().toLowerCase().replace(/[\s\u00A0]+/g, ' ');
        });

        function getColIndex(keywords) {
            return headers.findIndex(function (h) {
                var cleanH = h.replace(/\s+/g, '');
                return keywords.some(function (k) {
                    var cleanK = k.toLowerCase().replace(/\s+/g, '');
                    return h.indexOf(k.toLowerCase()) !== -1 || cleanH.indexOf(cleanK) !== -1;
                });
            });
        }

        var nameIdx = getColIndex(['название', 'назва', 'задача']);
        var statusIdx = getColIndex(['статус', 'стан']);
        var createdIdx = getColIndex(['дата создания', 'дата створення']);
        var deadlineIdx = getColIndex(['крайний срок', 'крайній термін']);
        var completedIdx = getColIndex(['дата завершения', 'дата завершення']);
        var plannedIdx = getColIndex(['планируемые трудозатраты', 'план. час']);
        var spentIdx = getColIndex(['затраченное время', 'витрачений час']);
        var respIdx = getColIndex(['ответственный', 'відповідальний']);
        var pointsIdx = getColIndex(['point', 'поинты', 'поінти']);
        var typeIdx = getColIndex(['категорія', 'категория', 'category', 'розробка/правка', 'правка/нова', 'розробка нового', 'вид работ', 'вид робіт']);
        var dirIdx = getColIndex(['напрямок', 'направление']);
        var itemsIdx = getColIndex(['виріб+кількість', 'виріб + кількість', 'виріб/кількість', 'виріб', 'изделие', 'product', 'вирібкількість']);

        if (nameIdx === -1) nameIdx = 0;
        if (statusIdx === -1) statusIdx = 1;
        if (createdIdx === -1) createdIdx = 2;
        if (deadlineIdx === -1) deadlineIdx = 3;
        if (completedIdx === -1) completedIdx = 4;
        if (plannedIdx === -1) plannedIdx = 5;
        if (spentIdx === -1) spentIdx = 6;
        if (respIdx === -1) respIdx = 8;
        if (pointsIdx === -1) pointsIdx = 11;
        if (itemsIdx === -1) {
            if (headers.length > 15) itemsIdx = 15;
            else if (headers.length > 14) itemsIdx = 14;
        }
        if (typeIdx === -1) {
            if (itemsIdx > 0) typeIdx = itemsIdx - 1;
            else if (headers.length > 14) typeIdx = 14;
            else typeIdx = 12;
        }
        if (dirIdx === -1) dirIdx = 13;

        var rows = Array.from(table.querySelectorAll('tr')).filter(isValidTaskRow);

        return rows.map(function (tr, idx) {
            var tds = Array.from(tr.querySelectorAll('td')).map(function (td) { return td.innerText.trim(); });

            var name = (tds[nameIdx] || tds[0] || '').trim();
            if (!name || name === '—' || name === '-' || /^[\s—-]+$/.test(name)) {
                name = tds.find(function (t) { return t && t.length > 2 && t !== '—' && t !== '-' && !/^[\s—-]+$/.test(t); }) || '';
            }
            if (!name || name === '—' || name === '-' || /^[\s—-]+$/.test(name)) return null;

            var statusStr = tds[statusIdx] || '';
            var createdDate = tds[createdIdx] || null;
            var deadlineDate = tds[deadlineIdx] || null;
            var completedDate = tds[completedIdx] || null;
            var plannedTime = tds[plannedIdx] || '';
            var spentTime = tds[spentIdx] || '';
            var responsible = tds[respIdx] || 'Не призначено';
            var pointsVal = tds[pointsIdx];
            var points = Number(pointsVal) || 1;
            var taskType = tds[typeIdx] || '';
            var direction = tds[dirIdx] || 'Загальне';
            var itemsInfo = itemsIdx !== -1 ? (tds[itemsIdx] || '') : '';

            var finalStatus = mapBitrixStatus(statusStr, completedDate);

            return {
                id: 'btx-auto-' + Date.now() + '-' + idx,
                name: name,
                status: finalStatus,
                assignedEmployee: responsible,
                points: points,
                plannedTime: plannedTime,
                spentTime: spentTime,
                direction: direction,
                taskType: taskType,
                itemsInfo: itemsInfo,
                startDate: createdDate ? formatDateISO(createdDate) : null,
                deadline: deadlineDate ? formatDateISO(deadlineDate) : null,
                completedAt: completedDate ? formatDateISO(completedDate) : null,
                type: 'bitrix',
                importedAt: new Date().toISOString()
            };
        }).filter(Boolean);
    }

    function getSelectedDates() {
        var select = document.getElementById('bx-period-select');
        var val = select ? select.value : 'current_month';

        if (val === 'custom') {
            var f = document.getElementById('bx-date-from') ? document.getElementById('bx-date-from').value.trim() : '';
            var t = document.getElementById('bx-date-to') ? document.getElementById('bx-date-to').value.trim() : '';
            return { from: f, to: t };
        } else {
            return getPeriodDates(val);
        }
    }

    function createControlPanel() {
        var isReportPage = window.location.href.includes('/tasks/report/');
        var currentSidebar = isReportPage ? (document.querySelector('.sidebar') || document.querySelector('#sidebar') || document.querySelector('.tasks-report-filter-block') || document.querySelector('.workarea-content-right') || document.querySelector('#workarea-content-right')) : null;

        if (document.getElementById('bx-auto-panel') && document.getElementById('bx-auto-fab')) {
            var panel = document.getElementById('bx-auto-panel');
            var fab = document.getElementById('bx-auto-fab');
            
            if (currentSidebar && !currentSidebar.contains(panel)) {
                currentSidebar.appendChild(panel);
                panel.style.cssText = 'background: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: Arial, sans-serif; font-size: 13px; display: flex; flex-direction: column; gap: 10px; margin-top: 15px; margin-bottom: 15px; box-sizing: border-box; width: 100%;';
                fab.style.display = 'none';
            } else if (!currentSidebar && panel.parentElement !== document.body) {
                document.body.appendChild(panel);
                panel.style.cssText = 'display: none; position: fixed; bottom: 80px; left: 20px; z-index: 99999; background: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); font-family: Arial, sans-serif; font-size: 13px; flex-direction: column; gap: 10px; max-width: 320px;';
                fab.style.display = 'flex';
            }
            return;
        }

        var fab = document.createElement('div');
        fab.id = 'bx-auto-fab';
        fab.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 99999; background: #2563eb; color: white; padding: 10px 16px; border-radius: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; transition: background 0.2s;';
        fab.innerHTML = '<span style="font-size: 16px;">🔄</span><span>Синхронізація</span><span id="bx-fab-status" style="font-size: 11px; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 10px; margin-left: 4px;">Готово</span>';
        
        var panel = document.createElement('div');
        panel.id = 'bx-auto-panel';

        if (currentSidebar) {
            panel.style.cssText = 'background: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px 16px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); font-family: Arial, sans-serif; font-size: 13px; display: flex; flex-direction: column; gap: 10px; margin-top: 15px; margin-bottom: 15px; box-sizing: border-box; width: 100%;';
            fab.style.display = 'none';
        } else {
            panel.style.cssText = 'display: none; position: fixed; bottom: 80px; left: 20px; z-index: 99999; background: #ffffff; border: 2px solid #2563eb; border-radius: 10px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); font-family: Arial, sans-serif; font-size: 13px; flex-direction: column; gap: 10px; max-width: 320px;';
            fab.style.display = 'flex';
        }

        fab.onclick = function() {
            if (panel.style.display === 'none') {
                panel.style.display = 'flex';
                fab.style.background = '#1d4ed8';
            } else {
                panel.style.display = 'none';
                fab.style.background = '#2563eb';
            }
        };

        document.body.appendChild(fab);
        if (currentSidebar) {
            currentSidebar.appendChild(panel);
        } else {
            document.body.appendChild(panel);
        }

        var savedIntervalMins = GM_getValue('bx_auto_sync_interval_mins', 10);
        var designUrls = getSavedReportUrls('design');
        var constrUrls = getSavedReportUrls('construction');

        var designStatusStr = designUrls.length > 0 ? (designUrls.length + ' звіт(и) 💾') : 'Поточна 🖥️';
        var constrStatusStr = constrUrls.length > 0 ? (constrUrls.length + ' звіт(и) 💾') : 'Поточна 🖥️';

        panel.innerHTML =
            '<div style="font-weight: bold; color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; display: flex; justify-content: space-between;">' +
            '<span>ViYar Load Planner Sync</span>' +
            '<span style="font-size: 10px; color: #94a3b8; font-weight: normal;">v5.7.0</span>' +
            '</div>' +

            '<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">' +
            '<strong style="color:#1e293b;">📅 Період:</strong>' +
            '<select id="bx-period-select" style="padding: 5px 8px; border-radius: 5px; border: 1px solid #cbd5e1; font-size: 12px; cursor: pointer; flex: 1;">' +
            '<option value="current_month">Поточний місяць</option>' +
            '<option value="prev_month">Минулий місяць</option>' +
            '<option value="last_30">Останні 30 днів</option>' +
            '<option value="custom">Кастомні дати</option>' +
            '</select>' +
            '</div>' +
            '<div id="bx-custom-dates" style="display:none; gap: 5px; align-items: center; justify-content: space-between;">' +
            '<input type="text" id="bx-date-from" placeholder="01.07.2026" style="width: 45%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 11px;">' +
            '<span>—</span>' +
            '<input type="text" id="bx-date-to" placeholder="31.07.2026" style="width: 45%; padding: 4px; border: 1px solid #ccc; border-radius: 4px; text-align: center; font-size: 11px;">' +
            '</div>' +

            '<!-- РАЗДЕЛ 1: ПРОЄКТУВАННЯ -->' +
            '<div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">' +
            '<strong style="color: #1e40af;">📐 Проєктування:</strong>' +
            '<span id="bx-design-status" style="font-weight: bold; color: #1e3a8a;">' + designStatusStr + '</span>' +
            '</div>' +
            '<div style="display: flex; gap: 4px;">' +
            '<button id="bx-btn-add-design" title="Додати поточний звіт до Проєктування" style="flex: 1; background: #ffffff; border: 1px solid #93c5fd; padding: 3px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold; color: #1d4ed8;">➕ Додати до Проєктування</button>' +
            '<button id="bx-btn-reset-design" title="Скинути збережені звіти Проєктування" style="background: #fee2e2; border: 1px solid #fca5a5; padding: 3px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold; color: #991b1b;">❌</button>' +
            '</div>' +
            '<button id="bx-btn-sync-design" style="background: #2563eb; color: white; border: none; padding: 6px; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 11px;">' +
            '⚡ Передати у Проєктування' +
            '</button>' +
            '</div>' +

            '<!-- РАЗДЕЛ 2: КОНСТРУЮВАННЯ -->' +
            '<div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 8px; border-radius: 6px; display: flex; flex-direction: column; gap: 4px;">' +
            '<div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">' +
            '<strong style="color: #166534;">🛠️ Конструювання:</strong>' +
            '<span id="bx-constr-status" style="font-weight: bold; color: #14532d;">' + constrStatusStr + '</span>' +
            '</div>' +
            '<div style="display: flex; gap: 4px;">' +
            '<button id="bx-btn-add-constr" title="Додати поточний звіт до Конструювання" style="flex: 1; background: #ffffff; border: 1px solid #86efac; padding: 3px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold; color: #15803d;">➕ Додати до Конструювання</button>' +
            '<button id="bx-btn-reset-constr" title="Скинути збережені звіти Конструювання" style="background: #fee2e2; border: 1px solid #fca5a5; padding: 3px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: bold; color: #991b1b;">❌</button>' +
            '</div>' +
            '<button id="bx-btn-sync-constr" style="background: #16a34a; color: white; border: none; padding: 6px; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 11px;">' +
            '🛠️ Передати у Конструювання' +
            '</button>' +
            '</div>' +

            '<!-- СИНХРОНІЗУВАТИ ОБИДВА -->' +
            '<button id="bx-btn-sync-all" style="background: #a855f7; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 12px; margin-top: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">' +
            '✨ Синхронізувати ОБИДВА відділи' +
            '</button>' +

            '<div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px;">' +
            '<span style="font-weight: bold; color:#1e293b;">⏱️ Автосинхр:</span>' +
            '<div>' +
            '<input type="number" id="bx-sync-interval-input" value="' + savedIntervalMins + '" style="width: 35px; padding: 2px; border: 1px solid #cbd5e1; border-radius: 4px; text-align: center; font-size: 11px;" min="1">' +
            '<span style="color:#64748b; font-size:11px; margin-left: 2px;">хв</span>' +
            '</div>' +
            '</div>' +

            '<button id="bx-btn-download" style="background: #0d9488; color: white; border: none; padding: 6px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">' +
            '📥 Скачати Excel' +
            '</button>' +

            '<div style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #edeef0; padding-top: 4px;">' +
            '<span id="bx-sync-status">Готово</span>' +
            '</div>';

        var select = document.getElementById('bx-period-select');
        var customDiv = document.getElementById('bx-custom-dates');
        var intervalInput = document.getElementById('bx-sync-interval-input');

        if (select && customDiv) {
            select.onchange = function () {
                if (select.value === 'custom') {
                    customDiv.style.display = 'flex';
                } else {
                    customDiv.style.display = 'none';
                }
            };
        }

        // Кнопки Проєктування
        document.getElementById('bx-btn-sync-design').onclick = function () {
            runDirectAutoSync(true, 'design');
        };
        document.getElementById('bx-btn-add-design').onclick = function () {
            var totalSaved = saveCurrentReportUrl('design');
            document.getElementById('bx-design-status').innerText = totalSaved + ' звіт(и) 💾';
            alert('Звіт додано до шаблонів Проєктування! Всього: ' + totalSaved);
        };
        document.getElementById('bx-btn-reset-design').onclick = function () {
            clearSavedReportUrls('design');
            document.getElementById('bx-design-status').innerText = 'Поточна 🖥️';
            alert('Шаблони Проєктування скинуто.');
        };

        // Кнопки Конструювання
        document.getElementById('bx-btn-sync-constr').onclick = function () {
            runDirectAutoSync(true, 'construction');
        };
        document.getElementById('bx-btn-add-constr').onclick = function () {
            var totalSaved = saveCurrentReportUrl('construction');
            document.getElementById('bx-constr-status').innerText = totalSaved + ' звіт(и) 💾';
            alert('Звіт додано до шаблонів Конструювання! Всього: ' + totalSaved);
        };
        document.getElementById('bx-btn-reset-constr').onclick = function () {
            clearSavedReportUrls('construction');
            document.getElementById('bx-constr-status').innerText = 'Поточна 🖥️';
            alert('Шаблони Конструювання скинуто.');
        };

        document.getElementById('bx-btn-download').onclick = function () {
            fetchAllPagesAndDownload();
        };

        // Кнопка Синхронізувати Все
        document.getElementById('bx-btn-sync-all').onclick = function () {
            runDirectAutoSync(true, 'all');
        };

        if (intervalInput) {
            intervalInput.oninput = function () {
                var val = Math.max(1, parseInt(intervalInput.value) || 10);
                GM_setValue('bx_auto_sync_interval_mins', val);
            };
        }
    }

    function getSavedReportUrls(dept) {
        var key = 'bx_saved_reports_' + (dept || 'design');
        var raw = GM_getValue(key, null);
        if (!raw) {
            var legacy = GM_getValue('bx_saved_filter_url', null);
            return legacy ? [legacy] : [];
        }
        try {
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function saveCurrentReportUrl(dept) {
        var pageDept = detectPageDepartment();
        if (pageDept && pageDept !== dept) {
            var pageDeptName = pageDept === 'construction' ? 'Конструювання' : 'Проєктування';
            var targetDeptName = dept === 'construction' ? 'Конструювання' : 'Проєктування';
            var confirmSave = confirm('⚠️ УВАГА: Заголовок або фільтр цієї сторінки вказує на "' + pageDeptName + '".\n\nВи дійсно хочете додати цю сторінку до шаблонів для "' + targetDeptName + '"?');
            if (!confirmSave) return getSavedReportUrls(dept).length;
        }

        var key = 'bx_saved_reports_' + (dept || 'design');
        var currentList = getSavedReportUrls(dept);

        var url = new URL(window.location.href);
        url.searchParams.delete('PAGEN_1');
        url.searchParams.delete('F_DATE_FROM');
        url.searchParams.delete('F_DATE_TO');
        url.searchParams.delete('F_DATE_TYPE');
        var cleanUrlStr = url.toString();

        if (!currentList.includes(cleanUrlStr)) {
            currentList.push(cleanUrlStr);
        }
        GM_setValue(key, JSON.stringify(currentList));
        return currentList.length;
    }

    function clearSavedReportUrls(dept) {
        var key = 'bx_saved_reports_' + (dept || 'design');
        GM_setValue(key, JSON.stringify([]));
        GM_setValue('bx_saved_filter_url', null);
    }

    async function fetchProjectsForUrls(urlsToFetch, dates) {
        var allProjects = [];

        for (var u = 0; u < urlsToFetch.length; u++) {
            var page = 1;
            var maxPages = 50;

            try {
                var baseUrl = new URL(urlsToFetch[u]);
                baseUrl.protocol = window.location.protocol;
                baseUrl.host = window.location.host;

                baseUrl.searchParams.set('set_filter', 'Y');
                baseUrl.searchParams.set('F_DATE_TYPE', 'interval');
                baseUrl.searchParams.set('F_DATE_FROM', dates.from);
                baseUrl.searchParams.set('F_DATE_TO', dates.to);

                while (page <= maxPages) {
                    baseUrl.searchParams.set('PAGEN_1', page);

                    var response = await fetch(baseUrl.toString(), {
                        credentials: 'same-origin',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' }
                    });
                    var htmlText = await response.text();

                    var parser = new DOMParser();
                    var doc = parser.parseFromString(htmlText, 'text/html');

                    var pageProjects = parseDocToProjects(doc);
                    if (pageProjects.length === 0) break;

                    allProjects = allProjects.concat(pageProjects);

                    var hasNextPage = doc.querySelector('a[href*="PAGEN_1=' + (page + 1) + '"], .modern-page-next');
                    if (!hasNextPage || pageProjects.length < 5) break;

                    page++;
                }
            } catch (err) {
                console.error('Помилка зчитування URL:', urlsToFetch[u], err);
            }
        }
        return allProjects;
    }

    function detectPageDepartment() {
        var selectors = [
            '#pagetitle',
            '.pagetitle',
            '#workarea-content-right',
            '.tasks-report-filter-block',
            '.main-ui-filter-search-square'
        ];
        var text = '';
        for (var i = 0; i < selectors.length; i++) {
            var el = document.querySelector(selectors[i]);
            if (el) text += ' ' + (el.innerText || '');
        }

        text += ' ' + window.location.href;
        text = text.toLowerCase();

        var hasConstruction = text.includes('04.02.02') || 
                              text.includes('09.02') || 
                              text.includes('конструювання') || 
                              text.includes('конструирование') || 
                              text.includes('конструктори') || 
                              text.includes('конструкторов') || 
                              text.includes('конструкторы') || 
                              text.includes('конструкторів') ||
                              text.includes('конструктор');

        var hasDesign = text.includes('04.02.01') || 
                        text.includes('04.01') || 
                        text.includes('проєктування') || 
                        text.includes('проектування') || 
                        text.includes('проектирование') || 
                        text.includes('проєктанти') || 
                        text.includes('проектанти') || 
                        text.includes('проектанты') || 
                        text.includes('проєктантів') || 
                        text.includes('проектантів') || 
                        text.includes('проектантов') ||
                        text.includes('проектант') ||
                        text.includes('проєктант');

        if (hasConstruction && !hasDesign) return 'construction';
        if (hasDesign && !hasConstruction) return 'design';
        if (hasDesign) return 'design';
        if (hasConstruction) return 'construction';

        return null;
    }

    async function runDirectAutoSync(isManual, targetDeptOverride) {
        var statusEl = document.getElementById('bx-sync-status');
        var fabStatus = document.getElementById('bx-fab-status');
        
        if (statusEl) statusEl.innerText = '⏳ Зчитування...';
        if (fabStatus) fabStatus.innerText = '⏳ Зчитування...';

        try {
            var dates = getSelectedDates();

            var departmentsToSync = [];
            if (!isManual || targetDeptOverride === 'all') {
                departmentsToSync = ['design', 'construction'];
            } else {
                departmentsToSync = [targetDeptOverride || GM_getValue('bx_target_department', 'design')];
            }

            var grandTotalCount = 0;

            for (var d = 0; d < departmentsToSync.length; d++) {
                var dept = departmentsToSync[d];
                var savedUrls = getSavedReportUrls(dept);
                var urlsToFetch = [];

                if (savedUrls.length > 0) {
                    urlsToFetch = savedUrls;
                } else {
                    var pageDept = detectPageDepartment();
                    
                    if (isManual && targetDeptOverride === 'all') {
                        var deptName = dept === 'construction' ? 'Конструювання' : 'Проєктування';
                        alert('⚠️ Щоб синхронізувати обидва відділи, вам потрібно спочатку зберегти посилання на обидва звіти!\n\nВідкрийте звіт "' + deptName + '", та натисніть кнопку "➕ Додати до ' + deptName + '".');
                        if (statusEl) statusEl.innerText = '⚠️ Скасовано';
                        if (fabStatus) fabStatus.innerText = '⚠️ Скасовано';
                        return;
                    }

                    if (pageDept && pageDept !== dept) {
                        if (isManual) {
                            var pageDeptName = pageDept === 'construction' ? 'Конструювання' : 'Проєктування';
                            var targetDeptName = dept === 'construction' ? 'Конструювання' : 'Проєктування';
                            alert('⚠️ Увага!\nПоточна відкрита сторінка — це звіт відділу "' + pageDeptName + '".\n\nЩоб передати у "' + targetDeptName + '", відкрийте відповідний звіт у Бітрікс і натисніть "➕ Додати до ' + targetDeptName + '".');
                            if (statusEl) statusEl.innerText = '⚠️ Скасовано';
                            if (fabStatus) fabStatus.innerText = '⚠️ Скасовано';
                            return;
                        } else {
                            continue;
                        }
                    }
                    if (isManual || pageDept === dept || pageDept === null) {
                        urlsToFetch = [window.location.href];
                    }
                }

                if (urlsToFetch.length === 0) continue;

                var deptProjects = await fetchProjectsForUrls(urlsToFetch, dates);

                if (deptProjects.length > 0) {
                    grandTotalCount += deptProjects.length;
                    var payloadStr = JSON.stringify({ projects: deptProjects, department: dept });
                    var deptKey = 'LM_SHARED_PROJECTS_' + dept.toUpperCase();
                    GM_setValue(deptKey, payloadStr);
                    GM_setValue('LM_SHARED_PROJECTS', payloadStr);

                    if (departmentsToSync.length > 1) {
                        await new Promise(function (r) { setTimeout(r, 3500); });
                    }
                }
            }

            GM_setValue('lm_last_sync_time', Date.now());

            if (statusEl) statusEl.innerText = '✅ Готово (' + grandTotalCount + ' задач)';
            if (fabStatus) fabStatus.innerText = '✅ Готово';

            if (isManual) {
                alert('Успішно зібрано ' + grandTotalCount + ' задач!');
            }
        } catch (err) {
            console.error('Помилка авто-синхронізації:', err);
            if (statusEl) statusEl.innerText = '❌ Помилка';
            if (fabStatus) fabStatus.innerText = '❌ Помилка';
        }
    }

    async function fetchAllPagesAndDownload() {
        var btn = document.getElementById('bx-btn-download');
        if (btn) {
            btn.innerText = '⏳ Зчитування...';
            btn.disabled = true;
        }

        try {
            var dates = getSelectedDates();
            var page = 1;
            var headerHtml = '';
            var allRowsHtml = '';
            var totalCount = 0;
            var maxPages = 50;

            var savedFilterUrl = GM_getValue('bx_saved_filter_url', null);
            var baseUrl = new URL(savedFilterUrl ? savedFilterUrl : window.location.href);
            if (savedFilterUrl) {
                baseUrl.protocol = window.location.protocol;
                baseUrl.host = window.location.host;
            }

            baseUrl.searchParams.set('set_filter', 'Y');
            baseUrl.searchParams.set('F_DATE_TYPE', 'interval');
            baseUrl.searchParams.set('F_DATE_FROM', dates.from);
            baseUrl.searchParams.set('F_DATE_TO', dates.to);

            while (page <= maxPages) {
                if (btn) btn.innerText = '⏳ ' + dates.from + '-' + dates.to + ' (ст. ' + page + ' | ' + totalCount + ' задач)';

                baseUrl.searchParams.set('PAGEN_1', page);

                var response = await fetch(baseUrl.toString(), {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                var htmlText = await response.text();

                var parser = new DOMParser();
                var doc = parser.parseFromString(htmlText, 'text/html');
                var table = findReportTable(doc);

                if (!table) break;

                if (!headerHtml) {
                    var firstHeaderTr = table.querySelector('thead tr, tr:first-child');
                    if (firstHeaderTr) headerHtml = '<thead>' + firstHeaderTr.outerHTML + '</thead>';
                }

                var allPageRows = Array.from(table.querySelectorAll('tr'));
                var taskRows = allPageRows.filter(isValidTaskRow);

                if (taskRows.length === 0) break;

                var pageRowsHtml = taskRows.map(function (r) { return r.outerHTML; }).join('');
                allRowsHtml += pageRowsHtml;
                totalCount += taskRows.length;

                var hasNextPage = doc.querySelector('a[href*="PAGEN_1=' + (page + 1) + '"], .modern-page-next');
                if (!hasNextPage || taskRows.length < 5) break;

                page++;
            }

            if (totalCount === 0) {
                alert('Не знайдено задач за період ' + dates.from + ' — ' + dates.to);
                return;
            }

            var fullTableHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">';
            fullTableHtml += '<head><meta charset="utf-8" /><style>td { mso-number-format:"\\@"; }</style></head><body>';
            fullTableHtml += '<table border="1">' + headerHtml + '<tbody>' + allRowsHtml + '</tbody></table>';
            fullTableHtml += '</body></html>';

            var blob = new Blob(['\ufeff' + fullTableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
            var a = document.createElement('a');
            var fileName = 'bitrix_zvit_CLEAN_' + dates.from.replace(/\./g, '_') + '_to_' + dates.to.replace(/\./g, '_') + '_' + totalCount + '_items.xls';
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

        } catch (err) {
            console.error('Помилка при вивантаженні Excel:', err);
            alert('Помилка при завантаженні Excel: ' + err.message);
        } finally {
            if (btn) {
                btn.innerText = '📥 Скачати Excel';
                btn.disabled = false;
            }
        }
    }

    function checkScheduledAutoSync() {
        var lastSync = GM_getValue('lm_last_sync_time', null);
        var now = Date.now();
        var currentIntervalMins = GM_getValue('bx_auto_sync_interval_mins', 10);
        var currentIntervalMs = currentIntervalMins * 60 * 1000;

        if (!lastSync || (now - Number(lastSync)) > currentIntervalMs) {
            console.log('[Auto-Sync Scheduler] Запуск автоматичної синхронізації за розкладом...');
            runDirectAutoSync(false);
        }
    }

    function updateCountdown() {
        var lastSync = GM_getValue('lm_last_sync_time', null);
        var currentIntervalMins = GM_getValue('bx_auto_sync_interval_mins', 10);
        var statusEl = document.getElementById('bx-sync-status');
        var fabStatus = document.getElementById('bx-fab-status');

        if (lastSync && statusEl && !statusEl.innerText.includes('⏳') && !statusEl.innerText.includes('❌')) {
            var now = Date.now();
            var diffMs = now - Number(lastSync);
            var totalIntervalMs = currentIntervalMins * 60 * 1000;
            var leftMs = totalIntervalMs - diffMs;

            if (leftMs <= 0) {
                statusEl.innerText = '⏳ Запуск...';
                if (fabStatus) fabStatus.innerText = '⏳ Запуск...';
            } else {
                var leftSecs = Math.floor(leftMs / 1000);
                var m = Math.floor(leftSecs / 60);
                var s = leftSecs % 60;
                statusEl.innerText = 'Наступна через ' + m + 'хв ' + s + 'с';
                if (fabStatus) fabStatus.innerText = m + 'хв ' + s + 'с';
            }
        }
    }

    function insertWidget() {
        createControlPanel();
    }

    setTimeout(function () {
        insertWidget();
        checkScheduledAutoSync();

        setInterval(checkScheduledAutoSync, 5000);
        setInterval(updateCountdown, 1000);
    }, 1500);

    setInterval(insertWidget, 3000);

})();
