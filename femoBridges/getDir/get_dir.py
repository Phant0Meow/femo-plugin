# femoBridge/getDir/get_dir.py
"""
get_dir.py

提供 get_user_dir 函数，获取用户数据目录。
优先读取同目录下的 user_dir.txt，若不存在则自动使用项目根目录下的 user_data 文件夹。
"""

import os

def get_user_dir() -> str:
    """
    返回用户数据根目录路径。
    1. 优先从 user_dir.txt 第一行读取。
    2. 若文件不存在，使用 <项目根目录>/user_data，不存在则自动创建。
    """
    module_dir = os.path.dirname(os.path.abspath(__file__))
    config_path = os.path.join(module_dir, "user_dir.txt")

    # 尝试从配置文件读取
    try:
        with open(config_path, 'r', encoding='utf-8-sig') as f:
            path = f.readline().strip()
            if not path:
                raise ValueError(f"配置文件 {config_path} 为空")
            return path
    except FileNotFoundError:
        pass  # 文件不存在，使用回退逻辑

    # 回退：项目根目录（插件自包含布局——调用方按契约再拼 user_data/xxx，
    # 整个插件文件夹搬到哪里，用户数据就落在哪里的 user_data/ 下）
    fallback = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    os.makedirs(os.path.join(fallback, "user_data"), exist_ok=True)
    #print(f"[get_dir] 未找到 user_dir.txt，自动使用默认路径: {fallback}")
    return fallback

# ━━━ 已退役·观察期（2026-09-26 起）━━━ get_approot_dir / get_FEMOroot_dir：全仓零引用
# （get_FEMOroot_dir 仅剩 FEMO_runtime 一行从未调用的 import，已随本次同步摘除）。
# txt 寻址老机制，已被 FEMO_DATA_DIR 环境变量取代（见下方 get_data_dir）。无报错数日后整段删除（含本注）。
# def get_approot_dir() -> str:
#     """从 approot_dir.txt 读取应用根目录（保留原逻辑不变）"""
#     module_dir = os.path.dirname(os.path.abspath(__file__))
#     config_path = os.path.join(module_dir, "approot_dir.txt")
#     with open(config_path, 'r', encoding='utf-8') as f:
#         path = f.readline().strip()
#         if not path:
#             raise ValueError(f"配置文件 {config_path} 为空")
#         return path
#
#
# def get_FEMOroot_dir() -> str:
#     """从 FEMOain_dir.txt 读取 FEMO 根目录（保留原逻辑不变）"""
#     module_dir = os.path.dirname(os.path.abspath(__file__))
#     config_path = os.path.join(module_dir, "FEMOain_dir.txt")
#     with open(config_path, 'r', encoding='utf-8') as f:
#         path = f.readline().strip()
#         if not path:
#             raise ValueError(f"配置文件 {config_path} 为空")
#         return path
# ━━━ 观察期退役段结束：get_approot_dir / get_FEMOroot_dir ━━━


def get_data_dir() -> str:
    """返回 user_data 数据根（2026-09-24 多实例分桶）：优先 FEMO_DATA_DIR env
    （dsh 多实例按端口派生 user_data-<port>，桥/宿主两侧同值注入），否则回落
    <项目根>/user_data（单实例老形态零感知）。"""
    env = os.environ.get('FEMO_DATA_DIR')
    if env:
        return env
    return os.path.join(get_user_dir(), 'user_data')
