@echo off
echo ========================================
echo   Система управління завантаженням (MODERN)
echo   Версія v2.0 (React)
echo ========================================
echo.

cd modern-load-manager

echo [1/2] Перевірка залежностей...
call npm install

echo.
echo [2/2] Запуск сервера розробки...
echo Додаток буде доступний за адресою: http://localhost:5173
echo.

call npm run dev

pause
