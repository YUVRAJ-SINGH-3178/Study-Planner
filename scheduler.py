
import json
from pathlib import Path
import math
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, date

DATA_DIR = Path('data/plans')
DATA_DIR.mkdir(parents=True, exist_ok=True)

DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

def _hours_to_slots(hours, slot_size=1.0):
    # Convert hours (float) into integer number of slots.
    if hours <= 0:
        return 0
    # Round to nearest slot using half-up
    slots = int(math.floor((hours / slot_size) + 0.5))
    return max(1, slots)

def generate_weekly_schedule(subjects, daily_availability, slot_size=1.0, start_hour=8):
    """Generate a weekly schedule.
    subjects: list of {name, hours, priority}
    daily_availability: dict day->hours
    Returns: dict day -> list of blocks {start, duration, subject}
    """
    # sanitize inputs
    subj_info = {}
    for s in subjects:
        name = s.get('name') if 'name' in s else s.get('subject') if 'subject' in s else None
        if not name:
            continue
        hours = float(s.get('hours', 0))
        prio = int(s.get('priority', 3))
        subj_info[name] = {'hours': hours, 'priority': max(1, min(prio, 5)), 'slots': _hours_to_slots(hours, slot_size)}

    # compute day capacities (in slots)
    day_capacity = {d: max(0, int(math.floor(daily_availability.get(d, 0) / slot_size))) for d in DAYS}
    total_capacity = sum(day_capacity.values())
    total_slots_needed = sum(v['slots'] for v in subj_info.values())

    # if oversubscribed, reduce slots proportionally (preserve priority by weighted trim)
    if total_slots_needed > total_capacity and total_capacity > 0:
        # compute weighted importance
        weights = {name: info['slots'] * info['priority'] for name, info in subj_info.items()}
        total_weight = sum(weights.values()) or 1.0
        for name, info in subj_info.items():
            share = weights[name] / total_weight
            new_slots = int(math.floor(share * total_capacity))
            subj_info[name]['slots'] = max(0, new_slots)

        total_slots_needed = sum(v['slots'] for v in subj_info.values())

    # Build priority queue: subjects with remaining slots
    remaining = {name: info['slots'] for name, info in subj_info.items()}
    weights = {name: info['priority'] for name, info in subj_info.items()}

    # Assign slots to days using a greedy approach with smoothing
    schedule_raw = {d: [] for d in DAYS}

    # Create a list of subjects repeated by priority to bias selection
    def pick_subject(sorted_names):
        # choose the subject with highest (remaining * priority)
        candidates = sorted(sorted_names, key=lambda n: remaining.get(n,0) * weights.get(n,1), reverse=True)
        return candidates[0] if candidates else None

    # First pass: fill each day up to capacity
    for day in DAYS:
        cap = day_capacity.get(day, 0)
        assigned = 0
        while assigned < cap and any(v > 0 for v in remaining.values()):
            name = pick_subject([n for n in remaining if remaining[n] > 0])
            if not name:
                break
            schedule_raw[day].append(name)
            remaining[name] -= 1
            assigned += 1

    # Second pass: if any leftover slots and remaining day space, assign round-robin
    if any(v > 0 for v in remaining.values()):
        for day in DAYS:
            cap = day_capacity.get(day, 0) - len(schedule_raw[day])
            idx = 0
            while cap > 0 and any(v > 0 for v in remaining.values()):
                # pick next subject with remaining >0
                names_with_remain = [n for n in remaining if remaining[n] > 0]
                if not names_with_remain:
                    break
                name = names_with_remain[idx % len(names_with_remain)]
                schedule_raw[day].append(name)
                remaining[name] -= 1
                cap -= 1
                idx += 1

    # Convert raw lists into timed blocks
    final = {d: [] for d in DAYS}
    for d in DAYS:
        h = start_hour
        for subj in schedule_raw[d]:
            final[d].append({'start': int(h), 'duration': slot_size, 'subject': subj})
            h += slot_size

    return final

def save_plan(plan_name, subjects, daily_availability, schedule):
    pid = uuid_hex()
    payload = {
        'id': pid,
        'name': plan_name,
        'created': datetime.utcnow().isoformat(),
        'subjects': subjects,
        'daily_availability': daily_availability,
        'schedule': schedule
    }
    path = DATA_DIR / f"{pid}.json"
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    return str(path)

def load_plan(path_or_id=None):
    # load latest if no arg
    files = sorted(DATA_DIR.glob('*.json'), key=lambda x: x.stat().st_mtime, reverse=True)
    if not files:
        return None
    p = files[0]
    with open(p, 'r', encoding='utf-8') as f:
        return json.load(f)

def export_schedule_csv(schedule, outpath):
    import csv
    rows = []
    for day, blocks in schedule.items():
        for b in blocks:
            rows.append({'day': day, 'start': f"{int(b['start']):02d}:00", 'duration_hours': b['duration'], 'subject': b['subject']})
    with open(outpath, 'w', newline='', encoding='utf-8') as csvf:
        writer = csv.DictWriter(csvf, fieldnames=['day','start','duration_hours','subject'])
        writer.writeheader()
        writer.writerows(rows)
    return outpath

def export_schedule_ics(schedule, outpath, week_start_date):
    lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SmartStudyPlanner//EN']
    days_map = {d:i for i,d in enumerate(DAYS)}
    if isinstance(week_start_date, date):
        monday = week_start_date
    else:
        monday = date.today()
    for day, blocks in schedule.items():
        for b in blocks:
            dt = datetime.combine(monday + timedelta(days=days_map[day]), datetime.min.time()) + timedelta(hours=b['start'])
            dt_end = dt + timedelta(hours=b['duration'])
            uid = uuid_hex()
            lines += ['BEGIN:VEVENT',
                      f'UID:{uid}',
                      f'DTSTAMP:{datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")} ',
                      f'DTSTART:{dt.strftime("%Y%m%dT%H%M%S")}',
                      f'DTEND:{dt_end.strftime("%Y%m%dT%H%M%S")}',
                      f'SUMMARY:{b["subject"]}',
                      'END:VEVENT']
    lines.append('END:VCALENDAR')
    with open(outpath, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return outpath

def uuid_hex():
    return uuid.uuid4().hex[:8]
