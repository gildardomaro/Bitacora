import os
import shutil
import sys

def deploy():
    bot_dir = os.path.dirname(os.path.abspath(__file__))
    source_ex5 = os.path.join(bot_dir, "MARO.ex5")
    source_mq5 = os.path.join(bot_dir, "MARO.mq5")
    source_news = os.path.join(bot_dir, "maro_news_filter.csv")

    if not os.path.exists(source_ex5):
        print("[!] Error: No se encontró MARO.ex5 en la raíz del proyecto")
        return

    print("==================================================================")
    print("   DESPLEGANDO EA MARO v2.30 EN TODAS LAS TERMINALES DE MT5")
    print("==================================================================")
    print(f"[*] Origen: {source_ex5} ({os.path.getsize(source_ex5)} bytes)")

    user_home = os.path.expanduser("~")
    target_dirs = []

    # 1. Program Files
    prog_files = [
        r"C:\Program Files\Vantage01\MQL5\Experts",
        r"C:\Program Files\Vantage02\MQL5\Experts",
        r"C:\Program Files\Vantage03\MQL5\Experts",
        r"C:\Program Files\Vantage04\MQL5\Experts",
        r"C:\Program Files\Pepperstone MetaTrader5-4\MQL5\Experts",
        r"C:\Program Files\MetaTrader 5\MQL5\Experts",
    ]
    for p in prog_files:
        if os.path.exists(p):
            target_dirs.append(p)

    # 2. AppData Roaming (Carpetas dedicadas de broker)
    roaming = os.path.join(user_home, "AppData", "Roaming")
    if os.path.exists(roaming):
        for item in os.listdir(roaming):
            full_item = os.path.join(roaming, item)
            if os.path.isdir(full_item) and any(k in item.lower() for k in ['vantage', 'pepperstone']):
                exp_path = os.path.join(full_item, "MQL5", "Experts")
                if os.path.exists(exp_path):
                    target_dirs.append(exp_path)

    # 3. MetaQuotes Terminal hashes en AppData
    mq_term = os.path.join(roaming, "MetaQuotes", "Terminal")
    if os.path.exists(mq_term):
        for sub in os.listdir(mq_term):
            exp_path = os.path.join(mq_term, sub, "MQL5", "Experts")
            if os.path.exists(exp_path):
                target_dirs.append(exp_path)

    # Eliminar duplicados normalizando rutas
    unique_targets = []
    seen = set()
    for d in target_dirs:
        norm = os.path.normcase(os.path.abspath(d))
        if norm not in seen:
            seen.add(norm)
            unique_targets.append(d)

    print(f"[*] Se detectaron {len(unique_targets)} directorios Experts activos:")
    count_ok = 0
    for target in unique_targets:
        try:
            # Copiar MARO.ex5 (con mayúsculas y minúsculas para compatibilidad)
            shutil.copy2(source_ex5, os.path.join(target, "MARO.ex5"))
            shutil.copy2(source_ex5, os.path.join(target, "maro.ex5"))
            if os.path.exists(source_mq5):
                shutil.copy2(source_mq5, os.path.join(target, "MARO.mq5"))
            print(f"  [OK] Desplegado en: {target}")
            count_ok += 1
        except Exception as e:
            print(f"  [!] Error copiando a {target}: {e}")

    # 4. Asegurar archivo maro_news_filter.csv en Common\Files de MetaQuotes
    common_files = os.path.join(roaming, "MetaQuotes", "Terminal", "Common", "Files")
    if os.path.exists(common_files) and os.path.exists(source_news):
        try:
            shutil.copy2(source_news, os.path.join(common_files, "maro_news_filter.csv"))
            print(f"  [OK] Noticias sincronizadas en Common: {common_files}")
        except Exception as e:
            print(f"  [!] Error copiando noticias a Common: {e}")

    print("==================================================================")
    print(f"[*] Despliegue completado con éxito en {count_ok} terminales.")
    print("==================================================================")

if __name__ == "__main__":
    deploy()
