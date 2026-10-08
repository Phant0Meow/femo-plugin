@echo off
rem FEMO 网页座席 · 原生宿主登记（手动重跑入口，日常不用）
rem 2026-09-29 起：本地服务每次启动会自动登记（幂等）——双击上一级的
rem start-service.cmd 即登记+启动一步到位。本脚本只留给改了 manifest 的 key
rem 之后立刻重登记、或不想启动服务只想登记时用。
cd /d "%~dp0"
node install-native-host.mjs
pause
