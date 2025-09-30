# 🎓Study Planner

> Organize your study schedule like a pro! 📝⏰

An **interactive weekly study planner** that helps students manage study hours, prioritize subjects, track progress, and stay productive. Built with **Flask**, **JavaScript**, and **Bootstrap 5** for a smooth, responsive experience.

---

## 🚀 Features

| Feature                     | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| 📅 **Weekly Schedule Grid** | Visual timetable to plan study hours per day.             |
| 🔀 **Drag & Drop**          | Move subjects between slots easily.                       |
| ⏲️ **Pomodoro Timer**       | Focused study sessions with start/pause/reset.            |
| 🗒️ **Subject Notes**       | Add & save notes per subject locally (localStorage).      |
| 💾 **Export**               | Download your schedule as **CSV** or **iCalendar (ICS)**. |
| 🌙 **Theme Toggle**         | Switch between Light and Dark mode.                       |
| ↩️ **Undo Changes**         | Revert mistakes instantly.                                |
| 🤖 **Auto-Prioritize**      | Suggest priorities based on study hours.                  |

---

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/YUVRAJ-SINGH-3178/smart-study-planner.git
cd smart-study-planner

# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

Open [http://localhost:8501](http://localhost:8501) in your browser.

---

## 📝 Usage

1. **Add Subjects** – Name, hours, priority.
2. **Set Daily Availability** – How many hours you can study per day.
3. **Generate Schedule** – Click the “Generate Schedule” button.
4. **Drag & Drop** – Rearrange subjects in the timetable.
5. **Add Notes** – Click a subject pill to add/view notes.
6. **Export Schedule** – Download as **CSV** or **ICS**.
7. **Pomodoro Timer** – Focused sessions to boost productivity.

---

## ⌨️ Keyboard Shortcuts

| Key         | Action                      |
| ----------- | --------------------------- |
| `P`         | Start / Pause Pomodoro      |
| `G`         | Generate Schedule           |
| Drag & Drop | Move subjects between slots |

---

## 💻 Tech Stack

* **Backend:** Flask (Python 3.11+)
* **Frontend:** HTML, CSS, JS, Bootstrap 5
* **Storage:** Browser LocalStorage (notes & theme preferences)
* **Export:** CSV & iCalendar (ICS)

---

## 🎨 Customization

* Light/Dark theme toggle
* Adjustable start hour & slot size
* Priority auto-suggestion based on study hours

---

## 🌟 Why Use This Planner?

* Stay organized and track your study efficiently
* Visualize your weekly schedule at a glance
* Boost productivity with Pomodoro technique
* Keep all subject notes in one place

---

## 📌 Screenshots / GIFs

* Drag & Drop your subjects
* Pomodoro timer in action
* Light/Dark theme toggle
---

## 📂 File Structure

```
study-planner/
├─ app.py
├─ requirements.txt
├─ scheduler.py
├─ static/
│  ├─ app.js
│  └─ styles.css
├─ templates/
│  └─ index.html
└─ data/plans/
```

---

## ⚡ Quick Tips

* Save notes frequently to LocalStorage
* Use “Undo” to revert mistakes
* Adjust slot size & start hour for optimal layout

---

## ❤️ Made with

Python 🐍 + Flask 🖤 + Bootstrap 💜

---
