
from flask import Flask, request, jsonify, send_file, render_template, abort
from scheduler import generate_weekly_schedule, save_plan, export_schedule_csv, export_schedule_ics, load_plan
from datetime import date, timedelta
import os

app = Flask(__name__, static_folder='static', template_folder='templates')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/generate', methods=['POST'])
def api_generate():
    payload = request.get_json(force=True)
    plan_name = payload.get('plan_name', 'My Plan')
    subjects = payload.get('subjects', [])
    daily_availability = payload.get('daily_availability', {})
    slot_size = payload.get('slot_size', 1.0)
    start_hour = int(payload.get('start_hour', 8))
    schedule = generate_weekly_schedule(subjects, daily_availability, slot_size=slot_size, start_hour=start_hour)
    saved_path = save_plan(plan_name, subjects, daily_availability, schedule)
    return jsonify({'ok': True, 'schedule': schedule, 'saved_path': saved_path})

@app.route('/api/export/csv', methods=['POST'])
def api_export_csv():
    payload = request.get_json(force=True)
    schedule = payload.get('schedule')
    if not schedule:
        return abort(400, 'Missing schedule')
    out = export_schedule_csv(schedule, 'data/plans/schedule_export.csv')
    return send_file(out, as_attachment=True)

@app.route('/api/export/ics', methods=['POST'])
def api_export_ics():
    payload = request.get_json(force=True)
    schedule = payload.get('schedule')
    if not schedule:
        return abort(400, 'Missing schedule')
    # use next Monday as week start
    today = date.today()
    monday = today + timedelta(days=(7 - today.weekday())) if today.weekday() != 0 else today
    out = export_schedule_ics(schedule, 'data/plans/schedule_export.ics', week_start_date=monday)
    return send_file(out, as_attachment=True)

@app.route('/api/load/latest', methods=['GET'])
def api_load_latest():
    p = load_plan()
    if not p:
        return jsonify({'ok': False, 'msg': 'No saved plans'}), 404
    return jsonify({'ok': True, 'plan': p})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8501))
    app.run(host='0.0.0.0', port=port, debug=True)
