@echo off
REM =====================================================
REM Bron Vault - Docker Start Script with Summary (Windows)
REM =====================================================
REM Wrapper script for docker-compose up with summary
REM =====================================================

REM Check if docker-compose is available
where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] docker-compose not found!
    echo.
    echo Make sure Docker Desktop is installed and running.
    echo Download from: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

echo.
echo [INFO] Starting Bron Vault Services...
echo.

REM Check if containers already exist
docker-compose ps -q >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    REM Containers exist, just start them (no build needed)
    echo [INFO] Containers already exist, starting without rebuild...
    docker-compose up -d
) else (
    REM First time setup, need to build
    echo [INFO] First time setup, building images...
    docker-compose up -d --build
)

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Failed to run docker-compose up
    echo Make sure Docker Desktop is running.
    echo.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] All services started!
echo.

REM Wait a bit to ensure all services are ready
timeout /t 3 /nobreak >nul

REM Display status and URLs
echo.
if exist "docker-status.bat" (
    call docker-status.bat
) else (
    echo [INFO] Service Status:
    docker-compose ps
    echo.
    echo [INFO] Access URLs:
    echo   - Bron Vault App:    http://localhost:3000
    echo   - ClickHouse Play:     http://localhost:8123/play
    echo   - MySQL:              localhost:3306
    echo   - ClickHouse HTTP:      http://localhost:8123
    echo.
    echo [INFO] Default Login Credentials:
    echo   - Email:    admin@bronvault.local
    echo   - Password: admin
    echo.
    echo [INFO] Please change the password after first login for security.
    echo.
)

