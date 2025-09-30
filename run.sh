
#!/usr/bin/env bash
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt
export FLASK_APP=app.py
flask run --host=0.0.0.0 --port=8501
