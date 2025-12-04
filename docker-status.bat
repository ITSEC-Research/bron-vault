@echo off
REM =====================================================
REM Bron Vault - Docker Status & URLs (Windows)
REM =====================================================
REM Script to display service status and access URLs
REM =====================================================

REM Check if docker-compose is available
where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] docker-compose not found!
    echo Make sure Docker Desktop is installed and running.
    exit /b 1
)

echo.
echo ============================================================
echo [INFO] Bron Vault Service Status
echo ============================================================
echo.

REM Check service status
docker-compose ps

echo.
echo ============================================================
echo [INFO] Access URLs:
echo.
echo   - Bron Vault App:    http://localhost:3000
echo   - ClickHouse Play:     http://localhost:8123/play
echo   - MySQL:              localhost:3306
echo   - ClickHouse HTTP:      http://localhost:8123
echo.
echo ============================================================
echo [INFO] Default Login Credentials:
echo.
echo   - Email:    admin@bronvault.local
echo   - Password: admin
echo.
echo [INFO] Please change the password after first login for security.
echo.
echo ============================================================
echo.
echo [INFO] Useful Commands:
echo.
echo   View logs:        docker-compose logs -f
echo   Stop services:    docker-compose down
echo   Restart services: docker-compose restart
echo   Check status:     docker-compose ps
echo.

