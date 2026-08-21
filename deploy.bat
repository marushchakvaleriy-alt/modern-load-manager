@echo off
echo ====================================================
echo   Deploying project to GitHub Pages (MODERN)
echo ====================================================
echo.

:: Check if we need to change directory to modern-load-manager
if exist modern-load-manager (
    cd modern-load-manager
)

echo [1/2] Building and deploying to GitHub Pages...
call npm run deploy

if %ERRORLEVEL% neq 0 (
    echo.
    echo Deployment failed. Please check the errors above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Deployment completed successfully!
echo The app will be available at:
echo https://marushchakvaleriy-alt.github.io/modern-load-manager/
echo.
pause
