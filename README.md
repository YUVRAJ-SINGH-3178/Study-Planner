
# Smart Study Planner (Flask)
Lightweight, hostable study planner with a polished frontend and reliable backend scheduler.

## Run locally (Linux/macOS)
1. Create virtualenv:
   python3 -m venv venv
   source venv/bin/activate
2. Install:
   pip install -r requirements.txt
3. Run:
   export FLASK_APP=app.py
   flask run --host=0.0.0.0 --port=8501
4. Open http://127.0.0.1:8501

## Run on Windows (PowerShell)
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   set FLASK_APP=app.py
   flask run --host=0.0.0.0 --port=8501

## Notes
- The project saves plans to `data/plans` as JSON.
- Exports CSV and ICS (basic).
