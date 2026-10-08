@echo off
rem FEMO 网页座席 · Native Messaging 启动器薄壳
rem Chrome 按注册表登记拉起它；壳只负责把调用转给 node 启动器本体。
node "%~dp0web-launcher.mjs"
