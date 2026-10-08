@echo off
rem FEMO web seat - local service launcher (double-click or call from anywhere)
rem
rem Data root (2026-09-25 user decision): FEMO_DATA_DIR stays UNSET by default,
rem so the bridge uses <femoRoot>/user_data - the SAME world as dsh/zcode hosts
rem (one projection hub, one mailbox, one soul library, one cast ledger).
rem WARNING: do NOT set FEMO_DATA_DIR=user_data; setting the var switches every
rem path to the user_data\femo\ subtree - a parallel world cut off from prod.
rem For isolated testing, uncomment the next line:
rem set WEB_SANDBOX=1
cd /d "%~dp0"
node server\service.mjs
pause
