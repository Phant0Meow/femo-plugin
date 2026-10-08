---
description: 挂载并启动运行一部 FEMO脚本（参数=FEMO脚本路径或FEMO脚本名）
allowed-tools: femo_mount, femo_run, Bash
---
请把「$ARGUMENTS」当作 FEMO脚本路径（或 user_data/projects 下的脚本名）：
1. 先读 femo 技能确认工具循环与视角纪律；
2. femo_mount 挂载该FEMO脚本（编译报错则修到通过）；
3. femo_run action=fresh_start 启动运行；此后按技能的运行循环推进。
