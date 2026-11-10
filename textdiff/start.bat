@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal

set PORT=8780

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY (
  echo [X] 未找到 python，请安装 Python 3；或在本目录手动执行:
  echo     python server.py %PORT%
  pause
  exit /b 1
)

echo.
echo   文本差异对比    http://127.0.0.1:%PORT%/index.html
echo   关闭本窗口即停止服务。请求日志见 server.log
echo.

rem 等本地服务就绪后再拉起浏览器（explorer 打开 URL 不需要引号，避免嵌套转义）
rem 地址带随机查询串：每次都算一个全新的 URL，浏览器不可能命中 HTML 缓存
start /b "" cmd /c "ping -n 3 127.0.0.1 >nul & explorer http://127.0.0.1:%PORT%/index.html?%RANDOM%"

%PY% server.py %PORT%
