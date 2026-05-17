# PROJECT_SUMMARY.md

## Project Overview

Police Station Visitor & Service Management System built with:

* GitHub Pages (frontend hosting)
* Google Apps Script (JSON API backend)
* Google Sheets (database)
* HTML/CSS/JavaScript (frontend)

Purpose:

* Manage visitor/service records
* Provide admin dashboard analytics
* Support full CRUD operations

---

## Architecture

```
User → https://rw6-mpb.github.io/project
              │
              ▼
       GitHub Pages
       (index.html — full SPA)
              │  fetch() API calls
              ▼
  Google Apps Script (JSON API)
       doGet  → dashboard / amphures / tambons
       doPost → submit / update / delete
              │
              ▼
       Google Sheets (database)
```

* No GAS banner or script.google.com in browser URL
* Frontend served entirely from GitHub Pages
* GAS acts as a serverless JSON API only
* All data stored in Google Sheets

---

## Core Features

* Public data entry form
* Admin dashboard with authentication
* View/Edit/Delete records
* Delete confirmation popup
* Responsive modern UI
* Cascading location dropdowns (จังหวัด / อำเภอ / ตำบล)
* Google Sheets integration

---

## Dashboard Structure

* Top summary card (Total Visitors)
* Statistic cards:

  * Male
  * Female
  * Officer/Police
  * General Visitor
* Analytics/chart section
* Information widgets:

  * Location statistics
  * Top categories
  * Top request reasons

---

## URLs

**Primary URL (GitHub Pages — full app):**
https://rw6-mpb.github.io/project

**Alternate GitHub Pages URL:**
https://k-tony-cloud.github.io/SheetAppScriptRW01/

**GAS API endpoint (backend only):**
https://script.google.com/macros/s/AKfycby5E9tAwCJBubnOnSLEzBkfCaGFpc0yLihZkmSZ7RI2vjciTEkz-xieMCe7bzHBDg/exec

---

## Tech Stack

* Frontend: HTML/CSS/JavaScript hosted on GitHub Pages (rw6-mpb/project)
* Backend: Google Apps Script JSON API (doGet + doPost)
* Database: Google Sheets
* Geography: Static province data + GAS UrlFetchApp for amphure/tambon (cached 6h)
* GAS Deployment ID: AKfycby5E9tAwCJBubnOnSLEzBkfCaGFpc0yLihZkmSZ7RI2vjciTEkz-xieMCe7bzHBDg

---

## GAS API Reference

| Method | Action | Description |
|--------|--------|-------------|
| GET | `?action=dashboard&password=` | Load all records (admin) |
| GET | `?action=amphures&provinceId=` | Get districts by province |
| GET | `?action=tambons&amphureId=` | Get subdistricts by district |
| POST | `{ action: "submit", col2…col41 }` | Create new record |
| POST | `{ action: "update", sheetRow, password, col2…col41 }` | Edit record |
| POST | `{ action: "delete", sheetRow, password }` | Delete record |

---

## Repositories

* **Frontend + source:** https://github.com/K-Tony-cloud/SheetAppScriptRW01
* **GitHub Pages app:** https://github.com/rw6-mpb/project

---

## Development Status

### Completed

* CRUD system
* Admin dashboard foundation
* Authentication flow
* Google Sheets connection
* Edit/Delete functionality
* GitHub + Claude Code workflow
* Cascading Thailand location dropdowns
* GitHub Pages hosting (no GAS frontend)
* GAS JSON API backend migration

### In Progress

* Dashboard UI redesign
* Responsive improvements
* Analytics enhancements

---

## Development Workflow

* Incremental section-by-section updates
* Token-efficient workflow
* Modular frontend improvements
* Avoid full-project rewrites

---

## Future Plans

* Advanced analytics
* Export/PDF reports
* Better filtering/search
* Dark mode
* Multi-role system
* Activity logs
