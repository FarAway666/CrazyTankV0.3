@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
    echo 正在首次安装依赖...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查是否已安装 Node.js。
        pause
        exit /b 1
    )
)

echo 正在启动服务器...
start "坦克大作战-服务器" cmd /k "node server.js"

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
echo 已打开浏览器，主机请使用本机，队友请访问 http://你的内网IP:3000
pause
