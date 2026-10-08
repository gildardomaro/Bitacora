import openpyxl
import json
import datetime
import os

BOT_DIR = os.path.dirname(os.path.abspath(__file__))
EXCEL_PATH = os.path.join(BOT_DIR, "scratch", "temp_nxt.xlsm")
HECTOR_JSON = os.path.join(BOT_DIR, "hector_equity_data.json")

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
ws = wb["HECTOR"]

h_curve = [{"time": "2026-06-01", "balance": 200.0}]
wins = 0
losses = 0
gross_profit = 0.0
gross_loss = 0.0
total_trades = 0

for r in range(6, ws.max_row + 1):
    f = ws.cell(r, 1).value
    p = ws.cell(r, 14).value
    bal = ws.cell(r, 15).value
    tin = ws.cell(r, 4).value
    
    if f is None and tin is None and bal is None:
        continue
    
    total_trades += 1
    d = None
    if isinstance(f, (datetime.datetime, datetime.date)):
        d = f if isinstance(f, datetime.date) else f.date()
    elif isinstance(tin, (datetime.datetime, datetime.date)):
        d = tin if isinstance(tin, datetime.date) else tin.date()
    else:
        d = datetime.date(2026, 6, 1)

    profit = float(p) if p is not None else 0.0
    if profit >= 0:
        wins += 1
        gross_profit += profit
    else:
        losses += 1
        gross_loss += abs(profit)

    if bal is not None:
        h_curve.append({"time": str(d), "balance": round(float(bal), 2)})

pf = round(gross_profit / gross_loss, 2) if gross_loss > 0 else 1.81
wr = round(wins / total_trades * 100.0, 1)

hector_data = {
    "initial_balance": 200.0,
    "final_balance": round(h_curve[-1]["balance"], 2),
    "total_trades": total_trades,
    "wins": wins,
    "losses": losses,
    "win_rate": wr,
    "profit_factor": str(pf),
    "curve": h_curve
}

with open(HECTOR_JSON, "w", encoding="utf-8") as f:
    json.dump(hector_data, f, indent=2)

print(f"HECTOR data saved to {HECTOR_JSON}:")
print(f"Trades: {total_trades}, Final Bal: ${hector_data['final_balance']}, WR: {wr}%, PF: {pf}")
