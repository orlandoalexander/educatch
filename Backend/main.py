from flask import Flask, jsonify, request, send_file, session
from flask_cors import CORS
import requests
import mysql.connector
import io, zipfile, os
from dotenv import load_dotenv
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
import bcrypt
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, verify_jwt_in_request, get_jwt_identity
from datetime import timedelta
import pytz
import json
import tempfile
import uuid
import shutil
import sqlite3
from functools import wraps

load_dotenv()

DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST')
DB_NAME = os.getenv('DB_NAME')
FRONTEND_URL=os.getenv("FRONTEND_URL")
FRONTEND_URL_DEMO=os.getenv("FRONTEND_URL_DEMO")
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY')
DPDF_API_KEY=os.getenv('DPDF_API_KEY')
SEED_DB_PATH = "demo_data.db"
TEMP_DIR = tempfile.gettempdir()

app = Flask(__name__)

CORS(app, origins=[FRONTEND_URL, FRONTEND_URL_DEMO], supports_credentials=True, expose_headers=["Content-Disposition"])

def jwt_required_if_not_demo(refresh=False):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not request.path.startswith("/demo/"):
                verify_jwt_in_request(refresh=refresh)
            return fn(*args, **kwargs)
        return wrapper
    return decorator

@app.before_request
def allow_only_specific_url():
    origin = request.headers.get('Origin', '')
    referer = request.headers.get('Referer', '')
    if origin not in [FRONTEND_URL, FRONTEND_URL_DEMO] and referer not in [FRONTEND_URL, FRONTEND_URL_DEMO]:
        return "Requests from this origin are not allowed", 403

app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.secret_key = FLASK_SECRET_KEY

jwt = JWTManager(app)

def get_demo_db_path():
    if "demo_db_path" not in session:
        db_copy_path = os.path.join(TEMP_DIR, f"demo_{uuid.uuid4().hex}.db")
        shutil.copy(SEED_DB_PATH, db_copy_path)
        session["demo_db_path"] = db_copy_path
    return session["demo_db_path"]

def dict_factory_with_datetime(cursor, row):
    """Convert SQLite row to dict and parse date/datetime strings automatically"""
    d = {}
    for idx, col in enumerate(cursor.description):
        value = row[idx]
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    value = datetime.strptime(value, fmt)
                    # if format is only date, convert to date object
                    if fmt == "%Y-%m-%d":
                        value = value.date()
                    break
                except ValueError:
                    continue
        d[col[0]] = value
    return d

def get_demo_db_connection():
    db_path = get_demo_db_path()  # always get the current session path
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = dict_factory_with_datetime
    return conn

def get_db_connection():
    if request.path.startswith("/demo/"):
        return get_demo_db_connection()
    else:
        return mysql.connector.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            autocommit=True
        )

def get_cursor(connection):
    if request.path.startswith("/demo/"):
        return connection.cursor() # SQLite cursor already has row_factory
    return connection.cursor(dictionary=True, buffered=True)  # MySQL


def get_placeholder(connection):
    if isinstance(connection, sqlite3.Connection):
        return "?"
    else:
        return "%s"

def string_to_datetime(datetime_str):
    try:
        # Python ISO format with microseconds and Z
        return datetime.strptime(datetime_str[:-1], '%Y-%m-%dT%H:%M:%S.%f')
    except ValueError:
        try:
            # ISO format without microseconds or timezone
            return datetime.strptime(datetime_str, '%Y-%m-%dT%H:%M:%S')
        except ValueError:
            try:
                # Database format
                return datetime.strptime(datetime_str, '%Y-%m-%d %H:%M:%S')
            except ValueError:
                raise ValueError(f"Unrecognized datetime format: {datetime_str}")

def format_datetime_object(time, timezone, format=None):
    if timezone is None:
        timezone = "UTC"
    if time.tzinfo is None:
        time = pytz.utc.localize(time) # If the datetime is naive (lacking timezone info), assume it's in UTC

    local_timezone = pytz.timezone(timezone)
    time = time.astimezone(local_timezone)

    if format == 'time_short':
        return time.strftime("%H:%M")
    elif format == 'date':
        return time.strftime("%d %B %Y")
    elif format == 'date_short':
        return time.strftime("%d/%m/%Y")
    elif format == 'date_tiny':
        return time.strftime("%d/%m/%y")
    return time

def format_lesson_datetime_object(start_time, end_time, timezone, include_date=True):
    date_short = format_datetime_object(start_time, timezone, format='date_short')
    start_time_short = format_datetime_object(start_time, timezone, format='time_short')
    end_time_short = format_datetime_object(end_time, timezone, format='time_short')
    if include_date:
        return f"{date_short} ({start_time_short}-{end_time_short})"
    else:
        return f"{start_time_short}-{end_time_short}"

def parse_recurrence_rule(rule):
    rule_dict = {}
    components = rule.split(';')
    for component in components:
        key, value = component.split('=')
        if key == 'UNTIL':
            value = string_to_datetime(value)
        rule_dict[key] = value
    return rule_dict

def format_recurrence_rule(rule_dict):
    rule = ';'.join(f'{key}={value}' for key, value in rule_dict.items())
    return rule

def format_invoices(invoices):
    for invoice in invoices:
        invoice["key"] = invoice["id"]
        invoice["title"] = f"INV-{str(invoice['id']).zfill(5)}"
        invoice["week_short"] = invoice['week'].strftime("%d/%m/%Y")
        invoice["status_text"] = get_invoice_status_text(invoice['status'])
    return invoices

def get_report_status_text(status):
    status_map = {
        "incomplete": "Saved as draft",
        "empty": "Not started",
        "submitted": "Submitted"
    }
    return status_map.get(status, "Status unknown")

def get_invoice_status_text(status):
    status_map = {
        "incomplete": "Missing lesson report(s)",
        "ready": "Ready to submit",
        "upcoming": "Invoice week incomplete",
        "submitted": "Submitted and pending payment",
        "paid": "Paid"
    }
    return status_map.get(status, "Status unknown")

def get_attendance_code_text(code=None, get_map=False):
    code_map = {
        "L": "Arrived late",
        "D": "Left early",
        "O": "Unauthorised absence",
        "I": "Illness",
        "M": "Medical appointment",
        "C": "Authorised absence",
        "N": "No known reason",
        "T": "Not on timetable",
    }
    if get_map:
        return code_map
    return code_map.get(code, "No known reason")

def get_complete_attendance_status(lesson, timezone):
    return (
        "Present" if lesson["attendance_status"] == "present"
        else (
            f"Absent - {get_attendance_code_text(lesson['attendance_code'])}" if lesson["attendance_status"] == "absent"
            else (
                f"Disrupted ({format_lesson_datetime_object(lesson['actual_start_time'] or lesson['start_time'], lesson['actual_end_time'] or lesson['end_time'], timezone, include_date=False)}) - {get_attendance_code_text(lesson['attendance_code'])}"
                if lesson["attendance_status"] == "disrupted"
                else "Attendance not recorded"
            )
        )
    )

def get_lesson_occurrences(connection, timezone, tutor_id=None, student_id=None, current_fetched_date=None):
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    columns = ["SELECT lo.id, l.id as lesson_id, le.id as exception_id, COALESCE(le.exception_title, l.title) as title, COALESCE(le.exception_description, l.description) as description, COALESCE(le.exception_tutor_id, l.tutor_id) as tutor_id, COALESCE(le.exception_location_id, l.location_id) as location_id, COALESCE(le.exception_subject_id, l.subject_id) as subject_id, COALESCE(le.exception_student_id, l.student_id) as student_id, l.extended_until, l.recurrence_rule, COALESCE(le.exception_start_time, lo.start_time) as start_time, COALESCE(le.exception_end_time, lo.end_time) as end_time, lo.actual_start_time, lo.actual_end_time, lo.attendance_status, lo.attendance_code, COALESCE(su_e.name, su.name) as subject_name"]
    location_columns = ["COALESCE(loc_e.name, loc.name) as location_name, COALESCE(loc_e.address, loc.address) as address"]
    student_columns = ["COALESCE(st_e.name, st.name) as student_name, COALESCE(st_e.color, st.color) as student_color"]
    tutor_columns = ["COALESCE(t_e.name, t.name) as tutor_name, COALESCE(t_e.color, t.color) as tutor_color"]
    conditions = []
    parameters = []

    query = """
        FROM LessonOccurrences lo
        JOIN Lessons l ON lo.lesson_id = l.id
        JOIN Students st ON l.student_id = st.id
        JOIN Locations loc ON l.location_id = loc.id
        JOIN Subjects su ON l.subject_id = su.id
        JOIN Tutors t ON l.tutor_id = t.id
        LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
        LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
        LEFT JOIN Locations loc_e ON le.exception_location_id = loc_e.id
        LEFT JOIN Subjects su_e ON le.exception_subject_id = su_e.id
        LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
    """

    if tutor_id:
        columns.extend(location_columns+student_columns)
        conditions.append(f"(le.exception_tutor_id = {placeholder} OR (le.exception_tutor_id IS NULL AND l.tutor_id = {placeholder}))")
        parameters.extend([tutor_id, tutor_id])
    if student_id:
        columns.extend(location_columns+tutor_columns)
        conditions.append(f"(le.exception_student_id = {placeholder} OR (le.exception_student_id IS NULL AND l.student_id = {placeholder}))")
        parameters.extend([student_id, student_id])
    else: # admin view
        columns.extend(location_columns+tutor_columns+student_columns)

    recurrence_query = """SELECT DISTINCT l.id as lesson_id, l.start_time, l.end_time, l.tutor_id, l.extended_until, l.recurrence_rule
                            FROM Lessons l
                            JOIN LessonOccurrences lo ON l.id = lo.lesson_id
                            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id"""

    recurrence_query += " WHERE "
    if conditions:
        recurrence_query += " AND ".join(conditions) + " AND "
    recurrence_query += f"extended_until < {placeholder}"
    cursor.execute(recurrence_query, tuple(parameters) + (current_fetched_date,))
    recurrence_results = cursor.fetchall()

    lesson_occurrences = []

    for result in recurrence_results:
        if result['recurrence_rule']:
            recurrence_rule = parse_recurrence_rule(result['recurrence_rule'])
            until_date = recurrence_rule.get('UNTIL')
            if not until_date or until_date > result['extended_until']: # if recurrence rule not fully extended (either no end date or end date is greater than current extended date)
                if until_date:
                    extend_until = until_date
                else:
                    extend_until =  string_to_datetime(current_fetched_date) + timedelta(days=180) # extend by 180 days from current date
                if result['extended_until']: # if lesson has already been extended, update the start and end time to start when it is currently extended until
                    extension_duration = result['extended_until'] - result['start_time']
                    result['start_time'] = result['extended_until']
                    result['end_time'] += extension_duration

                recurrence_rule = format_recurrence_rule(recurrence_rule)

                invoice_ids = get_or_create_invoices(connection=connection, min_date=result['extended_until'], max_date=extend_until, tutor_id=result['tutor_id'])
                add_lesson_occurrences(connection=connection, lesson_id=result['lesson_id'], start_time=result['start_time'], end_time=result['end_time'], invoice_ids=invoice_ids, recurrence_rule=recurrence_rule, lesson_occurrences=lesson_occurrences, execute_immediately=False) # execute all lesson occurrences at once by passing execute_immediately=False

    cursor.executemany(f"""
        INSERT INTO LessonOccurrences (lesson_id, start_time, end_time, invoice_id)
        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})""", lesson_occurrences)
    connection.commit()
    create_reports(connection)

    query = ", ".join(columns) + query
    query += " WHERE "
    if conditions:
        query += " AND ".join(conditions) + " AND "
    query += " (le.exception_type IS NULL OR le.exception_type <> 'CANCEL') ORDER BY COALESCE(le.exception_start_time, lo.start_time)"
    cursor.execute(query, tuple(parameters))
    occurrences = cursor.fetchall()

    for occurrence in occurrences:
        occurrence["start_time_short"] = format_datetime_object(occurrence['start_time'], timezone, format='time_short')
        occurrence["end_time_short"] = format_datetime_object(occurrence['end_time'], timezone, format='time_short')
        occurrence["date"] = format_datetime_object(occurrence['start_time'], timezone, format='date')
        occurrence["date_short"] = format_datetime_object(occurrence['start_time'], timezone, format='date_short')

    already_extended_until_dates = [
        occurrence['extended_until']
        for occurrence in occurrences
        if occurrence['extended_until'] and occurrence['recurrence_rule']
        and ((until_date := parse_recurrence_rule(occurrence['recurrence_rule']).get('UNTIL')) is None
            or (isinstance(until_date, datetime) and until_date > occurrence['extended_until']))
    ]
    min_already_extended_until = min(already_extended_until_dates, default=None)

    cursor.close()
    return {"lessons": occurrences, "extended_until": min_already_extended_until}

def create_reports(connection):
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    query = """
        SELECT lo.id
        FROM LessonOccurrences lo
        LEFT JOIN Reports r ON lo.id = r.lesson_occurrence_id
        WHERE r.lesson_occurrence_id IS NULL;
    """
    cursor.execute(query)
    lesson_occurrences_without_reports = cursor.fetchall()

    new_reports = [(lo_id['id'], 'empty') for lo_id in lesson_occurrences_without_reports]

    if new_reports:
        insert_query = f"""
        INSERT INTO Reports (lesson_occurrence_id, status)
        VALUES ({placeholder}, {placeholder});
        """
        cursor.executemany(insert_query, new_reports)
        connection.commit()

    cursor.close()

def get_or_create_invoices(connection, min_date, max_date, tutor_id, single=False):
    cursor = get_cursor(connection)
    min_week_start = (min_date - timedelta(days=min_date.weekday())).date()
    max_week_start = (max_date - timedelta(days=max_date.weekday())).date()
    placeholder = get_placeholder(connection)

    # fetch existing invoices for the relevant weeks
    cursor.execute(f"""
        SELECT id, week
        FROM Invoices
        WHERE week BETWEEN {placeholder} AND {placeholder}
        AND tutor_id = {placeholder}
    """, (min_week_start, max_week_start, tutor_id))

    existing_invoices = cursor.fetchall()
    invoice_dict = {invoice['week']: invoice['id'] for invoice in existing_invoices}

    # determine the range of weeks that need to be processed
    week = min_week_start
    weeks_to_process = []
    while week <= max_week_start:
        if week not in invoice_dict:
            weeks_to_process.append(week)
        week += timedelta(weeks=1)

    if weeks_to_process:
        # insert new invoices
        insert_query = f"""
            INSERT INTO Invoices (week, status, tutor_id)
            VALUES ({placeholder}, {placeholder}, {placeholder})
        """
        current_week = (datetime.now() - timedelta(days=datetime.now().weekday())).date()
        cursor.executemany(insert_query, [(week, 'upcoming' if week >= current_week else 'incomplete', tutor_id) for week in weeks_to_process]) # set status to upcoming if invoice week in future, otherwise incomplete
        connection.commit()

        # re-fetch all invoices to include newly created ones
        cursor.execute(f"""
            SELECT id, week
            FROM Invoices
            WHERE tutor_id = {placeholder}
        """, (tutor_id, ))
        all_invoices = cursor.fetchall()
        invoice_dict.update({invoice['week']: invoice['id'] for invoice in all_invoices})

    cursor.close()

    if single:
        return invoice_dict.get(max_week_start, None)
    return invoice_dict


def update_invoice_status(connection):
    cursor = get_cursor(connection)

    cursor.execute("""
            UPDATE LessonExceptions
            SET exception_invoice_id = NULL
            WHERE exception_invoice_id IN (
                SELECT invoice_id FROM (
                    SELECT i.id AS invoice_id
                    FROM Invoices i
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM LessonOccurrences lo
                        JOIN Lessons l ON lo.lesson_id = l.id
                        LEFT JOIN LessonExceptions le2 ON lo.id = le2.lesson_occurrence_id
                        WHERE COALESCE(le2.exception_invoice_id, lo.invoice_id) = i.id
                          AND COALESCE(le2.exception_tutor_id, l.tutor_id) = i.tutor_id
                          AND (le2.exception_type IS NULL OR le2.exception_type != 'CANCEL')
                    )
                ) AS temp
            )""")

    # delete all empty invoices
    cursor.execute("""
            DELETE FROM Invoices
            WHERE id IN (
                SELECT id FROM (
                    SELECT i.id
                    FROM Invoices i
                    WHERE NOT EXISTS (
                        SELECT 1
                        FROM LessonOccurrences lo
                        JOIN Lessons l ON lo.lesson_id = l.id
                        LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                        WHERE COALESCE(le.exception_invoice_id, lo.invoice_id) = i.id
                          AND COALESCE(le.exception_tutor_id, l.tutor_id) = i.tutor_id
                          AND (le.exception_type IS NULL OR le.exception_type != 'CANCEL')
                    )
                ) AS temp
                )""")
    # update invoice status from upcoming --> incomplete when end of invoice week reached
    demo = request.path.startswith("/demo/")
    cursor.execute(f"""
        UPDATE Invoices
        SET status = 'incomplete'
        WHERE {"strftime('%W', 'now')" if demo else "WEEK(NOW())"} > {"strftime('%W', week)" if demo else "WEEK(week)"}
        AND status = 'upcoming'
    """)

    # update invoice status from incomplete --> ready if all reports submitted and from ready --> incomplete if not all reports submitted
    cursor.execute("""
        UPDATE Invoices
        SET status = CASE
            WHEN status = 'incomplete' AND id NOT IN (
                SELECT lo.invoice_id
                FROM Reports r
                JOIN LessonOccurrences lo ON r.lesson_occurrence_id = lo.id
                JOIN Lessons l ON lo.lesson_id = l.id
                LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                WHERE r.status <> 'submitted'
                  AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                  AND (le.exception_tutor_id IS NULL OR le.exception_tutor_id = l.tutor_id)
            ) THEN 'ready'
            WHEN status = 'ready' AND id IN (
                SELECT lo.invoice_id
                FROM Reports r
                JOIN LessonOccurrences lo ON r.lesson_occurrence_id = lo.id
                JOIN Lessons l ON lo.lesson_id = l.id
                LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                WHERE r.status <> 'submitted'
                  AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                  AND (le.exception_tutor_id IS NULL OR le.exception_tutor_id = l.tutor_id)
            ) THEN 'incomplete'
            ELSE status
        END
    """)

    connection.commit()


def add_lesson_occurrences(connection, lesson_id, start_time, end_time, recurrence_rule=None, invoice_ids=None, tutor_id=None, lesson_occurrences=None, reports=None, invoices=None, execute_immediately=True, ignore_first_occurrence=False):
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    # this is important to avoid mutable default arguments (which are shared between function calls)
    if invoice_ids is None:
        invoice_ids = []
    if lesson_occurrences is None:
        lesson_occurrences = []
    if reports is None:
        reports = []
    if invoices is None:
        invoices = []

    if recurrence_rule:
        rule = parse_recurrence_rule(recurrence_rule)
        interval = int(rule.get('INTERVAL', 1))
        freq = rule.get('FREQ')
        extend_until = rule.get('UNTIL') if 'UNTIL' in rule else start_time + timedelta(days=180)

        if not invoice_ids:
            invoice_ids = get_or_create_invoices(connection=connection, min_date=start_time, max_date=extend_until, tutor_id=tutor_id)
            if invoice_ids:
                format_invoice_ids = ','.join([placeholder] * len(invoice_ids))
                query = f"UPDATE Invoices SET status = 'ready' WHERE status = 'submitted' AND id IN ({format_invoice_ids})"
                cursor.execute(query, tuple(invoice_ids.values()))

        first_occurrence = True
        while start_time.date() <= extend_until.date():
            week = (start_time - timedelta(days=start_time.weekday())).date()

            if (first_occurrence and ignore_first_occurrence) == False:
                lesson_occurrences.append((
                    lesson_id,
                    start_time.strftime('%Y-%m-%d %H:%M:%S'),
                    end_time.strftime('%Y-%m-%d %H:%M:%S'),
                    invoice_ids[week]
                ))

            if freq == 'daily':
                start_time += timedelta(days=interval)
                end_time += timedelta(days=interval)
            elif freq == 'weekly':
                start_time += timedelta(weeks=interval)
                end_time += timedelta(weeks=interval)
            elif freq == 'monthly':
                start_time += relativedelta(months=interval)
                end_time += relativedelta(months=interval)
            else:
                break

            first_occurrence = False

        if execute_immediately:
            cursor.executemany(f"""
                INSERT INTO LessonOccurrences (lesson_id, start_time, end_time, invoice_id)
                VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})""", lesson_occurrences)
            create_reports(connection)

    else:
        invoice_id = get_or_create_invoices(connection=connection, min_date=start_time, max_date=start_time,
                                            tutor_id=tutor_id, single=True)
        cursor.execute(f"UPDATE Invoices SET status = 'ready' WHERE status = 'submitted' AND id = {placeholder}",
                       (invoice_id,))  # set invoice status to ready if previously submitted as it is now modified
        if ignore_first_occurrence:
            cursor.execute(f"""
                UPDATE LessonOccurrences
                SET start_time = {placeholder}, end_time = {placeholder}, invoice_id = {placeholder}
                WHERE lesson_id = {placeholder}""", (start_time, end_time, invoice_id, lesson_id))
        else:
            if request.path.startswith("/demo/"):  # demo → SQLite
                query = """
                   INSERT INTO LessonOccurrences (lesson_id, start_time, end_time, invoice_id)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(lesson_id) DO UPDATE SET
                       start_time = excluded.start_time,
                       end_time = excluded.end_time
                   """
                params = (lesson_id, start_time, end_time, invoice_id)

            else:  # production → MySQL
                query = """
                   INSERT INTO LessonOccurrences (lesson_id, start_time, end_time, invoice_id)
                   VALUES (%s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                       start_time = VALUES(start_time),
                       end_time = VALUES(end_time)
                   """
                params = (lesson_id, start_time, end_time, invoice_id)

            cursor.execute(query, params)
        create_reports(connection)

    cursor.execute(f"""
            UPDATE Lessons SET extended_until = {placeholder} WHERE id = {placeholder}
        """, (start_time, lesson_id))

    cursor.close()
    return True

def format_reports(reports, timezone):
    formatted_reports = {"lesson-based": [], "weekly": []}
    seen_weekly_combinations = set()

    for report in reports:
        report["key"] = report["id"]
        report["id_ext"] = str(report['id']).zfill(5)
        report["title"] = f"Report No. {str(report['id']).zfill(5)}"
        report['week_short'] = format_datetime_object(datetime.combine(report['week'], datetime.min.time()), timezone, format='date_short')
        report["invoice_title"] = f"INV-{str(report['invoice_id']).zfill(5)}"
        report['lesson_time_short'] = format_lesson_datetime_object(report['start_time'], report['end_time'], timezone)
        report["status_text"] = get_report_status_text(report['status'])
        report['attendance_status_complete'] = get_complete_attendance_status(report, timezone)
        formatted_reports['lesson-based'].append(report)

        weekly_key = (report['invoice_id'], report['student_name'])
        if weekly_key not in seen_weekly_combinations:
            seen_weekly_combinations.add(weekly_key)
            weekly_report = {
                'key': f"{report['invoice_id']}-{report['student_id']}",
                'week': report['week'],
                'week_short': report['week_short'],
                'student_id': report['student_id'],
                'student_name': report['student_name'],
                'tutor_name': report['tutor_name'],
                'invoice_id': report['invoice_id'],
                'invoice_title': f"INV-{str(report['invoice_id']).zfill(5)}",
                'report_ids': [report['id']],
                'safeguarding_concern': report['safeguarding_concern']
            }
            formatted_reports['weekly'].append(weekly_report)
        else:
            for weekly_report in formatted_reports['weekly']:
                if weekly_report['invoice_id'] == report['invoice_id'] and weekly_report['student_id'] == report['student_id']:
                    weekly_report['report_ids'].append(report['id'])

    for weekly_report in formatted_reports['weekly']:
        invoice_id = weekly_report['invoice_id']
        student_id = weekly_report['student_id']

        # Find all reports with the same invoice_id and student_name
        related_reports = [report for report in formatted_reports['lesson-based'] if
                           report['invoice_id'] == invoice_id and report['student_id'] == student_id]

        # Check the statuses of the related reports
        statuses = {report['status'] for report in related_reports}

        # Set the weekly report status
        if all(status == "empty" for status in statuses):  # All reports are empty
            weekly_report['status'] = "empty"
        elif all(status == "submitted" for status in statuses):  # All reports are submitted
            weekly_report['status'] = "submitted"
        else:
            weekly_report['status'] = "incomplete"

        weekly_report['status_text'] = get_report_status_text(weekly_report['status'])

    return formatted_reports

@app.route('/', methods=['GET'])
def home():
    return "Educatch Charity API is running", 200

@app.route("/demo/reset-db", methods=["POST"])
def reset_demo_db():
    # Delete old DB file if it exists
    old_db_path = session.get("demo_db_path")
    if old_db_path and os.path.exists(old_db_path):
        os.remove(old_db_path)

    session.clear()
    # Create a fresh DB and associate it with this session
    get_demo_db_path()

    return jsonify({"message": "Demo database has been reset."}), 200

@app.route('/demo/lessons/admin', methods=['GET'])
@app.route('/lessons/admin', methods=['GET'])
@jwt_required_if_not_demo()
def get_lessons_admin():
    connection = get_db_connection()
    cursor = get_cursor(connection)

    try:
        current_fetched_date = request.args.get('current_fetched_date')
        timezone = request.headers.get('X-Timezone')

        occurrences = get_lesson_occurrences(connection, timezone, current_fetched_date=current_fetched_date)

        connection.commit()
        return occurrences, 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/lessons/tutor/<int:tutor_id>', methods=['GET'])
@app.route('/lessons/tutor/<int:tutor_id>', methods=['GET'])
@jwt_required_if_not_demo()
def get_lessons_tutor(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)

    try:
        current_fetched_date = request.args.get('current_fetched_date')
        timezone = request.headers.get('X-Timezone')

        occurrences = get_lesson_occurrences(connection, timezone, tutor_id=tutor_id, current_fetched_date=current_fetched_date)

        return occurrences, 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/lessons/student/<int:student_id>', methods=['GET'])
@app.route('/lessons/student/<int:student_id>', methods=['GET'])
@jwt_required_if_not_demo()
def get_lessons_student(student_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)

    try:
        current_fetched_date = request.args.get('current_fetched_date')
        timezone = request.headers.get('X-Timezone')

        occurrences = get_lesson_occurrences(connection, timezone, student_id=student_id, current_fetched_date=current_fetched_date)

        return occurrences, 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/lessons/clash', methods=["GET"])
@app.route('/lessons/clash', methods=["GET"])
@jwt_required_if_not_demo()
def get_lesson_clash():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        lesson_occurrence_id = request.args.get('lesson_occurrence_id')
        tutor_id = request.args.get('tutor_id')
        student_id = request.args.get('student_id')
        start_time = request.args.get('start_time')
        end_time = request.args.get('end_time')
        start_time_formatted = string_to_datetime(start_time)
        end_time_formatted = string_to_datetime(end_time)
        # COALESCE is used to account for any lesson exceptions (such as changing student_id or tutor_id or cancelling the lesson)
        query = f"""
            SELECT COUNT(lo.id) as clash_count
            FROM LessonOccurrences lo
            JOIN Lessons l ON lo.lesson_id = l.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            WHERE {placeholder} < COALESCE(le.exception_end_time, lo.end_time)
            AND {placeholder} > COALESCE(le.exception_start_time, lo.start_time)
            AND (COALESCE(le.exception_tutor_id, l.tutor_id) = {placeholder} OR COALESCE(le.exception_student_id, l.student_id) = {placeholder})
            AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')"""
        parameters = [start_time_formatted, end_time_formatted, tutor_id, student_id]

        if lesson_occurrence_id: # if editing existing lesson
            query+=f" AND lo.id <> {placeholder}"
            parameters.append(lesson_occurrence_id)

        cursor.execute(query, tuple(parameters))
        clash_count = cursor.fetchone()['clash_count']
        if clash_count > 0:
            return jsonify({'clash': True, 'clash_count': clash_count}), 200
        return jsonify({'clash': False}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/lessons', methods=['POST'])
@app.route('/lessons', methods=['POST'])
@jwt_required_if_not_demo()
def add_lesson():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        data = request.json
        title = data.get('title')
        description = data.get('description')
        start_time = data.get('start_time')
        end_time = data.get('end_time')
        tutor_id = data.get('tutor_id')
        student_id = data.get('student_id')
        subject_id = data.get('subject_id')
        location_id = data.get('location_id')
        recurrence_rule = data.get('recurrence_rule')

        cursor.execute(f"""
            INSERT INTO Lessons (title, description, start_time, end_time, tutor_id, student_id, subject_id, location_id, recurrence_rule)
            VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})
        """, (title, description, start_time, end_time, tutor_id, student_id, subject_id, location_id, recurrence_rule))

        start_time = string_to_datetime(start_time)
        end_time = string_to_datetime(end_time)

        lesson_id = cursor.lastrowid
        connection.commit()

        add_lesson_occurrences(connection=connection, lesson_id=lesson_id, start_time=start_time, end_time=end_time, tutor_id=tutor_id, recurrence_rule=recurrence_rule)

        connection.commit()
        return jsonify({'message': 'Lesson added successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error adding lesson. Please try again later"}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/lesson_exceptions', methods=['POST'])
@app.route('/lesson_exceptions', methods=['POST'])
@jwt_required_if_not_demo()
def add_lesson_exception():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        data = request.json
        lesson_occurrence_id = data['lesson_occurrence_id']
        fields_to_update = {
            'exception_type': data.get('exception_type', False),
            'exception_title': data.get('title', False),
            'exception_description': data.get('description', False),
            'exception_tutor_id': data.get('tutor_id', False),
            'exception_student_id': data.get('student_id', False),
            'exception_location_id': data.get('location_id', False),
            'exception_start_time': data.get('start_time', False),
            'exception_end_time': data.get('end_time', False),
        }

        fields_to_update = {k: v for k, v in fields_to_update.items() if v is not False}  #filter out False values (missing keys)

        if not fields_to_update:
            return jsonify({'message': 'No valid fields to update'}), 400

        if fields_to_update.get('exception_tutor_id') or fields_to_update.get('exception_start_time') and data['exception_type'] != 'CANCEL': # if updating tutor_id or start_time (and not cancelling lesson), update invoice_id
            tutor_id = fields_to_update.get('exception_tutor_id')
            if not tutor_id:
                cursor.execute(f"""SELECT COALESCE(le.exception_tutor_id, l.tutor_id) as tutor_id FROM Lessons l
                            JOIN LessonOccurrences lo ON l.id = lo.lesson_id
                            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                            WHERE lo.id = {placeholder}""", (lesson_occurrence_id,))
                tutor_id = cursor.fetchone()['tutor_id']
            start_time = fields_to_update.get('exception_start_time')

            if start_time:
                start_time = string_to_datetime(start_time)
            else:
                cursor.execute(f"""SELECT COALESCE(le.exception_start_time, lo.start_time) as start_time FROM LessonOccurrences lo
                            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                            WHERE lo.id = {placeholder}""", (lesson_occurrence_id,))
                start_time = cursor.fetchone()['start_time']

            invoice_id = get_or_create_invoices(connection=connection, min_date=start_time, max_date=start_time, tutor_id=tutor_id, single=True)
            cursor.execute(f"UPDATE Invoices SET status = 'ready' WHERE status = 'submitted' AND id = {placeholder}", (invoice_id,)) # set invoice status to ready if previously submitted as it is now modified
            fields_to_update['exception_invoice_id'] = invoice_id


        columns = ", ".join(fields_to_update.keys())
        placeholders = ", ".join([placeholder] * len(fields_to_update))
        if request.path.startswith("/demo/"):  # SQLite
            update_set_sql = ", ".join([f"{col} = excluded.{col}" for col in fields_to_update.keys()])
            query = f"""
                INSERT INTO LessonExceptions (lesson_occurrence_id, {columns})
                VALUES (?, {placeholders})
                ON CONFLICT(lesson_occurrence_id) DO UPDATE SET {update_set_sql}
            """
        else:  # MySQL
            update_set_sql = ", ".join([f"{col} = VALUES({col})" for col in fields_to_update.keys()])
            query = f"""
                INSERT INTO LessonExceptions (lesson_occurrence_id, {columns})
                VALUES (%s, {placeholders})
                ON DUPLICATE KEY UPDATE {update_set_sql}
            """
        parameters = [lesson_occurrence_id] + list(fields_to_update.values())

        cursor.execute(query, tuple(parameters))
        connection.commit()

        return jsonify({'message': "Lesson deleted successfully" if data.get('exception_type') == "CANCEL" else "Lesson updated successfully"}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error deleting lesson. Please try again later" if data.get('exception_type') == "CANCEL" else "Error updating lesson. Please try again later"}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/lessons/<int:lesson_id>', methods=['PUT'])
@app.route('/lessons/<int:lesson_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_lesson(lesson_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        new_lesson_data = request.json

        lesson_occurrence_id = new_lesson_data.pop('lesson_occurrence_id')
        update_type = new_lesson_data.pop('update_type')

        if not new_lesson_data:
            return jsonify({"message": "No lesson data provided"}), 400

        # get original lesson details
        cursor.execute(f"SELECT * FROM Lessons WHERE id = {placeholder}", (lesson_id,))
        original_lesson_data = cursor.fetchone()

        original_lesson_data.pop("id") # remove the ID from the data, so a new ID will be generated on insert
        combined_lesson_data =  {**original_lesson_data, **new_lesson_data} # update the original lesson data with the new values

        cursor.execute(f"""
                SELECT start_time
                FROM LessonOccurrences
                WHERE id = {placeholder}""", (lesson_occurrence_id, ))
        current_occurrence_date = cursor.fetchone()['start_time']

        cursor.execute(f"""
                SELECT MAX(start_time) AS start_time
                FROM LessonOccurrences
                WHERE lesson_id = {placeholder}
                AND start_time < {placeholder}""", (lesson_id, current_occurrence_date))
        previous_occurrence_date = cursor.fetchone()['start_time'] # date of previous lesson occurrence before the one being modified

        # if updating lesson recurrence rule or lesson start date of lesson with recurrence
        if original_lesson_data.get('recurrence_rule') and ('recurrence_rule' in new_lesson_data or ('start_time' in new_lesson_data and current_occurrence_date.date() != string_to_datetime(new_lesson_data.get('start_time')).date())):

            new_recurrence_rule = new_lesson_data.get('recurrence_rule')
            new_recurrence_rule_dict = parse_recurrence_rule(new_recurrence_rule) if new_recurrence_rule else {}

            original_recurrence_rule = original_lesson_data.get('recurrence_rule')
            original_recurrence_rule_dict = parse_recurrence_rule(original_recurrence_rule)

            # if changing recurrence rule until date only, modify the existing lesson. otherwise, create new lesson and delete future occurrences of current lesson
            modify_existing_lesson = (
                set(new_lesson_data.keys()) == {"start_time", "end_time", "recurrence_rule"} and
                new_recurrence_rule_dict.get('FREQ') == original_recurrence_rule_dict.get('FREQ') and
                new_recurrence_rule_dict.get('INTERVAL') == original_recurrence_rule_dict.get('INTERVAL')
            )

            # if creating new lesson with new recurrence rule and transfer report_id across
            if update_type == 'MODIFY':
                if modify_existing_lesson:  # if only updating recurrence rule of existing lesson and nothing else
                    new_lesson_id = lesson_id

                    cursor.execute(f"""
                        SELECT MAX(start_time) AS start_time, MAX(end_time) AS end_time
                        FROM LessonOccurrences
                        WHERE lesson_id = {placeholder}
                    """, (lesson_id,))
                    result = cursor.fetchone()
                    start_time_datetime = result['start_time']  # current most extended date of recurrence
                    end_time_datetime = result['end_time']

                    if new_recurrence_rule:  # if recurrence rule has not been removed, just changed
                        delete_after_date = parse_recurrence_rule(new_recurrence_rule).get("UNTIL")
                    else:
                        delete_after_date = current_occurrence_date
                        original_recurrence_rule_dict['UNTIL'] = current_occurrence_date
                        new_recurrence_rule = format_recurrence_rule(original_recurrence_rule_dict)
                    cursor.execute(
                        f"UPDATE Lessons SET recurrence_rule = {placeholder} WHERE id = {placeholder}",
                        (new_recurrence_rule, lesson_id)
                    )

                    # Delete LessonExceptions where occurring after updated repeat-until date
                    cursor.execute(f"""
                        DELETE FROM LessonExceptions
                        WHERE lesson_occurrence_id IN (
                            SELECT id
                            FROM LessonOccurrences
                            WHERE lesson_id = {placeholder}
                        )
                        AND DATE(COALESCE(exception_start_time, 
                                         (SELECT start_time FROM LessonOccurrences WHERE id = lesson_occurrence_id))) > DATE({placeholder})
                    """, (lesson_id, delete_after_date))

                    # Delete LessonOccurrences where occurring after updated repeat-until date
                    cursor.execute(f"""
                        DELETE FROM LessonOccurrences
                        WHERE id IN (
                            SELECT lo.id
                            FROM LessonOccurrences lo
                            LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id
                            WHERE lo.lesson_id = {placeholder}
                            AND DATE(COALESCE(le.exception_start_time, lo.start_time)) > DATE({placeholder})
                        )""", (lesson_id, delete_after_date))

                else:
                    start_time = combined_lesson_data['start_time']
                    end_time = combined_lesson_data['end_time']
                    start_time_datetime = string_to_datetime(start_time)
                    end_time_datetime = string_to_datetime(end_time)

                    new_invoice_id = get_or_create_invoices(connection, start_time_datetime, end_time_datetime,
                                                        combined_lesson_data['tutor_id'], single=False)

                    new_invoice_id = next(iter(new_invoice_id.values()))

                    insert_columns = ", ".join(combined_lesson_data.keys())
                    placeholders = ", ".join([placeholder] * len(combined_lesson_data))
                    insert_query = f"INSERT INTO Lessons ({insert_columns}) VALUES ({placeholders})"  # create new lesson with updated details (to be populated as lesson occurrences)

                    parameters = list(combined_lesson_data.values())
                    cursor.execute(insert_query, parameters)

                    new_lesson_id = cursor.lastrowid

                    # manually insert first lesson occurrence so that the report_id can be set correctly
                    cursor.execute(f"""
                        INSERT INTO LessonOccurrences (lesson_id, start_time, end_time, invoice_id)
                        VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})""", (new_lesson_id, start_time, end_time, new_invoice_id))

                    new_lesson_occurrence_id = cursor.lastrowid

                    # transfer the report to the new lesson occurrence
                    cursor.execute(f"""
                        UPDATE Reports
                        SET lesson_occurrence_id = {placeholder}
                        WHERE lesson_occurrence_id = {placeholder}""", (new_lesson_occurrence_id, lesson_occurrence_id))

                if new_recurrence_rule:
                    add_lesson_occurrences(connection=connection, lesson_id=new_lesson_id, start_time=start_time_datetime,
                                            end_time=end_time_datetime, tutor_id=combined_lesson_data['tutor_id'],
                                            recurrence_rule=new_recurrence_rule, ignore_first_occurrence=True)

            # delete all lesson occurrences on and after current lesson date if deleting or creating new lesson
            if update_type == 'DELETE' or not modify_existing_lesson:
                # Delete LessonExceptions where lessons on/after the current lesson
                cursor.execute(f"""
                    DELETE FROM LessonExceptions
                    WHERE lesson_occurrence_id IN (
                        SELECT lo.id
                        FROM LessonOccurrences lo
                        WHERE lo.lesson_id = {placeholder}
                          AND COALESCE((
                                SELECT le.exception_start_time
                                FROM LessonExceptions le
                                WHERE le.lesson_occurrence_id = lo.id
                            ), lo.start_time) >= {placeholder}
                    )
                """, (lesson_id, current_occurrence_date))

                # Delete LessonOccurrences where lessons on/after the current lesson
                cursor.execute(f"""
                    DELETE FROM LessonOccurrences
                    WHERE id IN (
                        SELECT lo.id
                        FROM LessonOccurrences lo
                        LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id
                        WHERE lo.lesson_id = {placeholder}
                          AND COALESCE(le.exception_start_time, lo.start_time) >= {placeholder}
                    )
                """, (lesson_id, current_occurrence_date))

                # update until_date to be that of the previous lesson occurrence as that is the new end of the occurence
                original_recurrence_rule_dict['UNTIL'] = previous_occurrence_date
                new_recurrence_rule = format_recurrence_rule(original_recurrence_rule_dict)
                cursor.execute(f"UPDATE Lessons SET recurrence_rule = {placeholder}, extended_until = {placeholder} WHERE id = {placeholder}", (new_recurrence_rule, previous_occurrence_date, lesson_id))

            connection.commit()

        # updating lesson time (not date) of recurring lesson
        elif original_lesson_data.get('recurrence_rule') and new_lesson_data.get('start_time'):
            cursor.execute(f"SELECT id, start_time FROM LessonOccurrences WHERE lesson_id = {placeholder} AND start_time >= {placeholder}", (lesson_id, current_occurrence_date))
            lesson_occurrences = cursor.fetchall()

            for lesson_occurrence in lesson_occurrences:
                occurrence_id = lesson_occurrence['id']
                existing_start_time = lesson_occurrence['start_time']

                # extract the date from the current occurrence's start_time
                existing_date = existing_start_time.date()

                # get the time part from the new lesson data
                new_start_time = string_to_datetime(new_lesson_data.get('start_time')).time()
                new_end_time = string_to_datetime(new_lesson_data.get('end_time')).time()

                # combine the original date with the new times
                updated_start_time = datetime.combine(existing_date, new_start_time)
                updated_end_time = datetime.combine(existing_date, new_end_time)

                # update the specific occurrence by its id
                cursor.execute(f"UPDATE LessonOccurrences SET start_time = {placeholder}, end_time = {placeholder} WHERE id = {placeholder}",
                            (updated_start_time, updated_end_time, occurrence_id))

        # if modifying recurring lesson but not changing recurrence rule
        elif original_lesson_data.get('recurrence_rule'):
            set_clause = ", ".join([f"{key} = {placeholder}" for key in new_lesson_data.keys()])
            values = list(new_lesson_data.values()) + [lesson_id]
            cursor.execute(f"UPDATE Lessons SET {set_clause} WHERE id = {placeholder}", values)

        else: # if modifying single lesson without existing recurrence rule
            set_clause = ", ".join([f"{key} = {placeholder}" for key in new_lesson_data.keys()])
            values = list(new_lesson_data.values()) + [lesson_id]
            cursor.execute(f"UPDATE Lessons SET {set_clause} WHERE id = {placeholder}", values)

            recurrence_rule = new_lesson_data.get('recurrence_rule')

            start_time = combined_lesson_data['start_time']
            end_time = combined_lesson_data['end_time']

            if isinstance(start_time, str):
                start_time =  string_to_datetime(start_time)
            if isinstance(end_time, str):
                end_time =  string_to_datetime(end_time)
            add_lesson_occurrences(connection=connection, lesson_id=lesson_id, start_time=start_time, end_time=end_time, tutor_id=original_lesson_data['tutor_id'], recurrence_rule=recurrence_rule, ignore_first_occurrence=True)

        connection.commit()

        return jsonify({'message': f'Lesson {"updated" if update_type == "MODIFY" else "deleted"} successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error updating lesson. Please try again later"}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/lesson_occurrences/<int:lesson_occurrence_id>', methods=['PUT'])
@app.route('/lesson_occurrences/<int:lesson_occurrence_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_lesson_occurrence(lesson_occurrence_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        data = request.json
        fields_to_update = {
            'actual_start_time': data.get('actual_start_time', False),
            'actual_end_time': data.get('actual_end_time', False),
            'attendance_status': data.get('attendance_status', False),
            'attendance_code': data.get('attendance_code', False),
        } # differentiate between missing keys and None values

        fields_to_update = {k: v for k, v in fields_to_update.items() if v is not False} # filter out False values (missing keys)
        if not fields_to_update:
            return jsonify({'message': 'No valid fields to update'}), 400

        set_clause = ", ".join(f"{field} = {placeholder}" for field in fields_to_update.keys())
        query = f"UPDATE LessonOccurrences SET {set_clause} WHERE id = {placeholder}"
        parameters = list(fields_to_update.values())
        parameters.append(lesson_occurrence_id)

        cursor.execute(query, tuple(parameters))
        connection.commit()

        return jsonify({'message': 'Lesson updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error updating lesson. Please try again later"}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/invoices/tutor/<int:tutor_id>', methods=['GET'])
@app.route('/invoices/tutor/<int:tutor_id>', methods=['GET'])
@jwt_required_if_not_demo()
def get_invoices_tutor(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        update_invoice_status(connection)

        cursor.execute(f"""SELECT DISTINCT i.id, i.week, i.status, t.name AS tutor_name
                FROM Invoices i
                JOIN Tutors t ON i.tutor_id = t.id
                LEFT JOIN LessonExceptions le ON le.exception_invoice_id = i.id
                WHERE COALESCE(le.exception_tutor_id, i.tutor_id) = {placeholder}
                ORDER BY week""", (tutor_id,))
        results = cursor.fetchall()

        return format_invoices(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
          connection.close()

@app.route('/demo/invoices/admin', methods=['GET'])
@app.route('/invoices/admin', methods=['GET'])
@jwt_required_if_not_demo()
def get_invoices_admin():
    connection = get_db_connection()
    cursor = get_cursor(connection)

    try:
        update_invoice_status(connection)

        query = """SELECT i.*, t.name AS tutor_name
        FROM Invoices i
        JOIN Tutors t ON i.tutor_id = t.id
        ORDER BY week"""

        cursor.execute(query)
        results = cursor.fetchall()

        return format_invoices(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/invoices/<int:invoice_id>/lessons', methods=['GET'])
@app.route('/invoices/<int:invoice_id>/lessons', methods=['GET'])
@jwt_required_if_not_demo()
def get_invoice_lessons(invoice_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        timezone = request.headers.get('X-Timezone')

        # get all lesson occurrences (accounting for lesson exceptions) belonging to the invoice id
        cursor.execute(f"""
            SELECT
                lo.id,
                r.id as report_id,
                r.status as report_status,
                i.week,
                i.id as invoice_id,
                COALESCE (le.exception_start_time, lo.start_time) as start_time,
                COALESCE(le.exception_end_time, lo.end_time) as end_time,
                COALESCE(le.exception_student_id, l.student_id) as student_id,
                COALESCE(st_e.name, st.name) as student_name
            FROM LessonOccurrences lo
            JOIN Lessons l ON lo.lesson_id = l.id
            JOIN Students st ON l.student_id = st.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
            LEFT JOIN Reports r ON COALESCE(le.lesson_occurrence_id, lo.id) = r.lesson_occurrence_id
            LEFT JOIN Invoices i ON COALESCE(le.exception_invoice_id, lo.invoice_id) = i.id
            WHERE i.id = {placeholder}
            AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
            ORDER BY COALESCE(le.exception_start_time, lo.start_time)
            """, (invoice_id, ))

        lessons = cursor.fetchall()

        lessons_formatted = {}

        # format the lessons for use in frontend (group by student and add fields to be used in frontend)
        for lesson in lessons:
            student_id = lesson['student_id']
            student_name = lesson['student_name']
            start_time = lesson['start_time']
            end_time = lesson['end_time']
            lesson_details = {k: v for k, v in lesson.items() if k not in ['student_id', 'student_name', 'start_time', 'end_time']}

            lesson_duration_hours = (end_time - start_time).total_seconds() / 3600

            if student_id not in lessons_formatted:
                lessons_formatted[student_id] = {
                    'key': student_id,
                    'student_id': student_id,
                    'student_name': student_name,
                    'total_lesson_hours': 0,
                    'lessons': [],
                    'reports_status': []
                }

            lessons_formatted[student_id]['lessons'].append({
                'lesson_time_short': format_lesson_datetime_object(start_time, end_time, timezone),
                **lesson_details,
            })

            lessons_formatted[student_id]['total_lesson_hours'] += lesson_duration_hours

            if lesson['report_status']:
                lessons_formatted[student_id]['reports_status'].append(lesson['report_status'])

        # find overall report status for each student
        for student_id, data in lessons_formatted.items():
            overall_status = 'empty'
            if all(status == 'submitted' for status in data['reports_status']):
                overall_status = 'submitted'
            elif 'incomplete' in data['reports_status'] or 'submitted' in data['reports_status']:
                overall_status = 'incomplete'

            lessons_formatted[student_id]['reports_status'] = overall_status

        cursor.execute(f"""
            SELECT
                t.rate
            FROM Tutors t
            JOIN Lessons l ON l.tutor_id = t.id
            LEFT JOIN (
                SELECT lo.id, lo.lesson_id, lo.invoice_id
                FROM LessonOccurrences lo
                WHERE lo.invoice_id = {placeholder}
                LIMIT 1
            ) lo ON lo.lesson_id = l.id
            LEFT JOIN (
                SELECT le.lesson_occurrence_id, le.exception_invoice_id
                FROM LessonExceptions le
                WHERE le.exception_invoice_id = {placeholder}
                LIMIT 1
            ) le ON le.lesson_occurrence_id = lo.id""", (invoice_id, invoice_id))

        rate = cursor.fetchone()['rate']

        return jsonify({'lessons': list(lessons_formatted.values()), 'rate': rate}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/invoices/<int:invoice_id>/student/<int:student_id>/report', methods=['GET'])
@app.route('/invoices/<int:invoice_id>/student/<int:student_id>/report', methods=['GET'])
@jwt_required_if_not_demo()
def get_invoice_student_report(invoice_id, student_id, timezone=None):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        timezone = timezone or request.headers.get('X-Timezone')
        # COALESCE allows us to account for lesson exceptions in our query
        cursor.execute(f"""
            SELECT
                r.id,
                r.status,
                r.safeguarding_concern,
                lo.id as lesson_occurrence_id,
                lo.start_time,
                lo.end_time,
                lo.actual_start_time,
                lo.actual_end_time,
                lo.attendance_code,
                lo.attendance_status,
                l.student_id,
                i.week,
                i.id as invoice_id,
                COALESCE(st_e.name, st.name) as student_name,
                COALESCE(t_e.name, t.name) as tutor_name
            FROM LessonOccurrences lo
            JOIN Lessons l ON lo.lesson_id = l.id
            JOIN Students st ON l.student_id = st.id
            JOIN Tutors t ON l.tutor_id = t.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
            LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
            LEFT JOIN Reports r ON COALESCE(le.lesson_occurrence_id, lo.id) = r.lesson_occurrence_id
            JOIN Invoices i ON COALESCE(le.exception_invoice_id, lo.invoice_id) = i.id
            WHERE i.id = {placeholder}
            AND COALESCE(st_e.id, st.id) = {placeholder}
            AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
            ORDER BY COALESCE(le.exception_start_time, lo.start_time)
            """, (invoice_id, student_id))

        results = cursor.fetchall()
        for result in results:
            result["title"] = f"Report No. {str(result['id']).zfill(5)}"
            result["date"] = result['start_time'].strftime("%d/%m/%Y")
            result["lesson_time_short"] = format_lesson_datetime_object(result['start_time'], result['end_time'], timezone)
            result['attendance_status_complete'] = get_complete_attendance_status(result, timezone)
            result["status_text"] = get_report_status_text(result['status'])
            result["content"] = get_report(result['id'])[0]
            result['safeguarding_concern'] = result['safeguarding_concern']
        overall_status = 'empty'
        if all(result['status'] == 'submitted' for result in results):
            overall_status = 'submitted'
        elif any(result['status'] == 'incomplete' or result['status'] == 'submitted' for result in results):
            overall_status = 'incomplete'

        results_formatted = {}

        results_formatted["status"] = overall_status
        results_formatted["status_text"] = get_report_status_text(overall_status)
        results_formatted["id"] = f'{invoice_id}-{student_id}'  # new ID for multiple reports combined of invoice ID and student ID
        results_formatted["title"] = f"INV-{str(invoice_id).zfill(5)} Reports"
        results_formatted["multiple_reports"] = True
        results_formatted["content"] = results
        results_formatted["student_name"] = results[0]['student_name']
        results_formatted["student_id"] = results[0]['student_id']
        results_formatted["tutor_name"] = results[0]['tutor_name']
        results_formatted["attendance_code"] = results[0]['attendance_code']
        results_formatted["attendance_status"] = results[0]['attendance_status']
        results_formatted["week_short"] = results[0]['week'].strftime("%d/%m/%Y")
        results_formatted["invoice_id"] = results[0]['invoice_id']
        return results_formatted, 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/invoices', methods=['PUT'])
@app.route('/demo/invoices/<int:invoice_id>', methods=['PUT'])
@app.route('/invoices', methods=['PUT'])
@app.route('/invoices/<int:invoice_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_invoice(invoice_id=None):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        invoice_ids = data.pop('invoice_ids', None)  # Remove to avoid it being used in SET clause
        if not data:
            return jsonify({"message": "No fields to update"}), 400

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        parameters = list(data.values())

        if invoice_ids and isinstance(invoice_ids, list):
            # Update multiple invoices
            format_strings = ','.join([placeholder] * len(invoice_ids))
            query = f"""
                UPDATE Invoices
                SET {set_clause}
                WHERE id IN ({format_strings})
            """
            parameters.extend(invoice_ids)
        else:
            # Update a single invoice
            query = f"""
                UPDATE Invoices
                SET {set_clause}
                WHERE id = {placeholder}
            """
            parameters.append(invoice_id)
        cursor.execute(query, tuple(parameters))
        connection.commit()

        return jsonify({"message": "Invoice(s) updated successfully"}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error updating invoice"}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/reports/tutor/<int:tutor_id>', methods=['GET'])
@app.route('/reports/tutor/<int:tutor_id>', methods=['GET'])
@jwt_required_if_not_demo()
def get_reports_tutor(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        timezone = request.headers.get('X-Timezone')

        query = f"""
            SELECT r.id,
                COALESCE(le.exception_invoice_id, lo.invoice_id) AS invoice_id,
                COALESCE(le.exception_start_time, lo.start_time) AS start_time,
                COALESCE(le.exception_end_time, lo.end_time) AS end_time,
                COALESCE(st_e.name, st.name) AS student_name,
                COALESCE(st_e.id, st.id) AS student_id,
                COALESCE(t_e.name, t.name) AS tutor_name,
                lo.id as lesson_occurrence_id,
                lo.actual_start_time,
                lo.actual_end_time,
                lo.attendance_code,
                lo.attendance_status,
                r.status,
                r.safeguarding_concern,
                i.week
            FROM Reports r
            JOIN LessonOccurrences lo ON r.lesson_occurrence_id = lo.id
            JOIN Lessons l ON lo.lesson_id = l.id
            JOIN Students st ON l.student_id = st.id
            JOIN Tutors t ON l.tutor_id = t.id
            JOIN Invoices i ON lo.invoice_id = i.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
            LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
            WHERE
                COALESCE(le.exception_tutor_id, l.tutor_id) = {placeholder}
                AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
        """

        cursor.execute(query, (tutor_id,))
        results = cursor.fetchall()

        return format_reports(results, timezone), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/reports/admin', methods=['GET'])
@app.route('/reports/admin', methods=['GET'])
@jwt_required_if_not_demo()
def get_reports_admin():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        timezone = request.headers.get('X-Timezone')

        query = """
            SELECT r.id,
                COALESCE(le.exception_invoice_id, lo.invoice_id) AS invoice_id,
                COALESCE(le.exception_start_time, lo.start_time) AS start_time,
                COALESCE(le.exception_end_time, lo.end_time) AS end_time,
                COALESCE(st_e.name, st.name) AS student_name,
                COALESCE(st_e.id, st.id) AS student_id,
                COALESCE(t_e.name, t.name) AS tutor_name,
                lo.id as lesson_occurrence_id,
                lo.actual_start_time,
                lo.actual_end_time,
                lo.attendance_code,
                lo.attendance_status,
                r.status,
                r.safeguarding_concern,
                i.week
            FROM Reports r
            JOIN LessonOccurrences lo ON r.lesson_occurrence_id = lo.id
            JOIN Lessons l ON lo.lesson_id = l.id
            JOIN Students st ON l.student_id = st.id
            JOIN Tutors t ON l.tutor_id = t.id
            JOIN Invoices i ON lo.invoice_id = i.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
            LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
            WHERE (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
        """
        cursor.execute(query)
        results = cursor.fetchall()
        return format_reports(results, timezone), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/reports/<int:report_id>', methods=['GET'])
@app.route('/reports/<int:report_id>', methods=['GET'])
@jwt_required_if_not_demo()
def get_report(report_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        demo = request.path.startswith("/demo/")
        query = f"""
            SELECT ra.answer_text, ra.answer_boolean, ra.answer_number, ra.answer_option, rq.id, rq.title, rq.type, rq.options, rq.hidden, {'rq."order"' if demo else 'rq.order'} FROM ReportQuestions rq
            LEFT JOIN ReportAnswers ra ON rq.id = ra.question_id AND ra.report_id = {placeholder}
        """
        cursor.execute(query, (report_id,))
        results = cursor.fetchall()

        return results, 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/reports', methods=['PUT'])
@app.route('/demo/reports/<int:report_id>', methods=['PUT'])
@app.route('/reports', methods=['PUT'])
@app.route('/reports/<int:report_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_report(report_id=None):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        status = data.get('status')
        report_ids = data.get('report_ids')

        # If a list of report IDs is passed, update them all
        if report_ids and isinstance(report_ids, list):
            format_strings = ','.join([placeholder] * len(report_ids))
            query = f"""
                UPDATE Reports
                SET status = {placeholder}
                WHERE id IN ({format_strings})
            """
            cursor.execute(query, [status] + report_ids)
        else:
            # Otherwise, use the single report_id from the URL
            cursor.execute(f"""
                UPDATE Reports
                SET status = {placeholder}
                WHERE id = {placeholder}
            """, (status, report_id))

        content = data.get('content')
        if content:
            if not isinstance(content, list):
                content = [content]

            queries_and_data = []

            for item in content:
                answer_col = f"answer_{item['type']}"  # e.g. answer_boolean, answer_text

                if request.path.startswith("/demo/"):  # SQLite
                    query = f"""
                        INSERT INTO ReportAnswers (question_id, report_id, {answer_col})
                        VALUES (?, ?, ?)
                        ON CONFLICT(question_id, report_id) DO UPDATE SET {answer_col} = excluded.{answer_col}
                    """
                else:  # MySQL
                    query = f"""
                        INSERT INTO ReportAnswers (question_id, report_id, {answer_col})
                        VALUES (%s, %s, %s)
                        ON DUPLICATE KEY UPDATE {answer_col} = VALUES({answer_col})
                    """

                data = (item.get('id'), report_id, item.get(answer_col))
                queries_and_data.append((query, data))

                if item.get('id') == 6 and item.get('answer_boolean') is not None:
                    update_query = f"""
                               UPDATE Reports
                               SET safeguarding_concern = {placeholder}
                               WHERE id = {placeholder}
                    """
                    cursor.execute(update_query, (item.get('answer_boolean'), report_id))

            # Now execute each query with its data
            for query, data in queries_and_data:
                cursor.execute(query, data)

        connection.commit()

        return jsonify({'message': "Report updated successfully"}), 200

    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error processing report. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/lessons/<int:lesson_occurrence_id>/report', methods=['GET'])
@app.route('/lessons/<int:lesson_occurrence_id>/report', methods=['GET'])
@jwt_required_if_not_demo()
def get_lesson_report(lesson_occurrence_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        timezone = request.headers.get('X-Timezone')
        query = f"""
            SELECT
                r.id,
                r.safeguarding_concern,
                lo.actual_start_time,
                lo.actual_end_time,
                lo.attendance_code,
                lo.attendance_status,
                lo.id as lesson_occurrence_id,
                COALESCE(le.exception_invoice_id, lo.invoice_id) AS invoice_id,
                COALESCE(i_e.week, i.week) AS week,
                COALESCE(le.exception_start_time, lo.start_time) AS start_time,
                COALESCE(le.exception_end_time, lo.end_time) AS end_time,
                COALESCE(st_e.name, st.name) AS student_name,
                COALESCE(t_e.name, t.name) AS tutor_name,
                r.status
            FROM Reports r
            JOIN LessonOccurrences lo ON r.lesson_occurrence_id = lo.id
            JOIN Lessons l ON lo.lesson_id = l.id
            JOIN Students st ON l.student_id = st.id
            JOIN Tutors t ON l.tutor_id = t.id
            JOIN Invoices i ON lo.invoice_id = i.id
            LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
            LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
            LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
            LEFT JOIN Invoices i_e ON le.exception_invoice_id = i_e.id
            WHERE r.lesson_occurrence_id = {placeholder}
        """
        cursor.execute(query, (lesson_occurrence_id,))
        result = cursor.fetchone()

        if result:
            report_id = result['id']
            result["title"] = f"Report No. {str(report_id).zfill(5)}"
            result['lesson_time_short'] = format_lesson_datetime_object(result['start_time'], result['end_time'], timezone)
            result['attendance_status_complete'] = get_complete_attendance_status(result, timezone)
            result["student_name"] = result['student_name']
            result["week_short"] = result['week'].strftime("%d/%m/%Y")
            result["status_text"] = get_report_status_text(result['status'])
            result["content"] = get_report(report_id)[0]

            return result, 200

        return jsonify({'message': 'Lesson report does not exist'}), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/tutors/<int:tutor_id>/rate', methods=['GET'])
@app.route('/tutors/<int:tutor_id>/rate', methods=['GET'])
@jwt_required_if_not_demo()
def get_tutor_rate(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        query = f"SELECT rate FROM Tutors WHERE id = {placeholder}"

        cursor.execute(query, (tutor_id,))
        result = cursor.fetchone()

        return str(result['rate']), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/tutors', methods=['GET'])
@app.route('/tutors', methods=['GET'])
@jwt_required_if_not_demo()
def get_all_tutors():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        query = "SELECT * FROM Tutors"

        cursor.execute(query)
        results = cursor.fetchall()

        # if no rows, get column headers
        columns = [
            {'name': desc[0], 'data_type': 'number' if desc[1] == 3 else 'string'}
            for desc in cursor.description if desc[0] != 'id'
        ]

        if not results:
            return jsonify({'columns': columns, 'records': []}), 200

        for result in results:
            result['key'] = result['id']
        return jsonify({'columns': columns, 'records': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/tutors', methods=['POST'])
@app.route('/tutors', methods=['POST'])
@jwt_required_if_not_demo()
def add_tutor():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        sort_code = data.get('sort_code')
        account_number = data.get('account_number')

        rate = data.get('rate', 20)
        color = data.get('color', 'Red')

        cursor.execute(f"INSERT INTO Tutors (name, email, phone, sort_code, account_number, rate, color) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})", (name, email, phone, sort_code, account_number, rate, color))
        connection.commit()

        return jsonify({'message': 'Tutor added successfully', 'id': cursor.lastrowid}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error adding tutor. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/tutors/<int:tutor_id>', methods=['PUT'])
@app.route('/tutors/<int:tutor_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_tutor(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        query = f"UPDATE Tutors SET {set_clause} WHERE id = {placeholder}"
        parameters = list(data.values())
        parameters.append(tutor_id)
        cursor.execute(query, tuple(parameters))

        connection.commit()
        return jsonify({'message': 'Tutor updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/tutors/<int:tutor_id>', methods=['DELETE'])
@app.route('/tutors/<int:tutor_id>', methods=['DELETE'])
@jwt_required_if_not_demo()
def delete_tutor(tutor_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        cursor.execute(f"""
            SELECT COUNT(*) as lesson_count
            FROM Lessons l
            JOIN LessonOccurrences lo ON lo.lesson_id = l.id
            LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id AND le.exception_type = 'cancel'
            WHERE l.tutor_id = {placeholder} AND le.id IS NULL
        """, (tutor_id,))
        result = cursor.fetchone()

        if result['lesson_count'] == 0:
            cursor.execute(f"""
                DELETE FROM LessonOccurrences
                WHERE id IN (
                    SELECT lo.id
                    FROM LessonOccurrences lo
                    JOIN Lessons l ON lo.lesson_id = l.id
                    WHERE l.tutor_id = {placeholder})""", (tutor_id, ))
            cursor.execute(f"DELETE FROM Lessons WHERE tutor_id = {placeholder}", (tutor_id,))
            cursor.execute(f"DELETE FROM Invoices WHERE tutor_id = {placeholder}", (tutor_id,))
            cursor.execute(f"DELETE FROM Tutors WHERE id = {placeholder}", (tutor_id,))
        else:
            return jsonify({'message': 'Error deleting tutor as they are still assigned to existing lessons or invoices. Please remove associated lessons/invoices first.'}), 400

        connection.commit()
        return jsonify({'message': 'Tutor deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error deleting tutor. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/students', methods=['GET'])
@app.route('/students', methods=['GET'])
@jwt_required_if_not_demo()
def get_all_students():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        query = "SELECT * FROM Students"

        cursor.execute(query)
        results = cursor.fetchall()

        # if no rows, get column headers
        columns = [
            {'name': desc[0], 'data_type': 'number' if desc[1] == 3 else 'string'}
            for desc in cursor.description if desc[0] != 'id'
        ]

        if not results:
            return jsonify({'columns': columns, 'records': []}), 200

        for result in results:
            result['key'] = result['id']

        return jsonify({'columns': columns, 'records': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/students', methods=['POST'])
@app.route('/students', methods=['POST'])
@jwt_required_if_not_demo()
def add_student():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        name = data.get('name')
        email = data.get('email')
        phone = data.get('phone')
        color = data.get('color', 'Blue')

        cursor.execute(f"INSERT INTO Students (name, email, phone, color) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder})", (name, email, phone, color))
        connection.commit()

        return jsonify({'message': 'Student added successfully', 'id': cursor.lastrowid}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error adding student. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/students/<int:student_id>', methods=['PUT'])
@app.route('/students/<int:student_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_student(student_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        query = f"UPDATE Students SET {set_clause} WHERE id = {placeholder}"
        parameters = list(data.values())
        parameters.append(student_id)

        cursor.execute(query, tuple(parameters))

        connection.commit()
        return jsonify({'message': 'Student updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error deleting student as they are still assigned to existing lessons or invoices. Please remove associated lessons/invoices first.'}), 400
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/students/<int:student_id>', methods=['DELETE'])
@app.route('/students/<int:student_id>', methods=['DELETE'])
@jwt_required_if_not_demo()
def delete_student(student_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        cursor.execute(f"""
            SELECT COUNT(*) as lesson_count
            FROM Lessons l
            JOIN LessonOccurrences lo ON lo.lesson_id = l.id
            LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id AND le.exception_type = 'cancel'
            WHERE l.student_id = {placeholder} AND le.id IS NULL
        """, (student_id,))
        result = cursor.fetchone()

        if result['lesson_count'] == 0:
            cursor.execute(f"""
            DELETE FROM LessonOccurrences
            WHERE id IN (
                SELECT lo.id
                FROM LessonOccurrences lo
                JOIN Lessons l ON lo.lesson_id = l.id
                WHERE l.student_id = {placeholder})""", (student_id, ))
            cursor.execute(f"DELETE FROM Lessons WHERE student_id = {placeholder}", (student_id,))
            cursor.execute(f"DELETE FROM Students WHERE id = {placeholder}", (student_id,))
        else:
            return jsonify({'message': 'Error deleting student as they are still assigned to existing lessons or invoices. Please remove associated lessons/invoices first.'}), 400

        connection.commit()
        return jsonify({'message': 'Student deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error deleting student. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/locations', methods=['GET'])
@app.route('/locations', methods=['GET'])
@jwt_required_if_not_demo()
def get_all_locations():
    connection = get_db_connection()
    cursor = get_cursor(connection)

    try:
        query = "SELECT * FROM Locations"

        cursor.execute(query)
        results = cursor.fetchall()

        # if no rows, get column headers
        columns = [
            {'name': desc[0], 'data_type': 'number' if desc[1] == 3 else 'string'}
            for desc in cursor.description if desc[0] != 'id'
        ]

        if not results:
            return jsonify({'columns': columns, 'records': []}), 200

        for result in results:
            result['key'] = result['id']

        return jsonify({'columns': columns, 'records': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/locations', methods=['POST'])
@app.route('/locations', methods=['POST'])
@jwt_required_if_not_demo()
def add_location():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        name = data.get('name')
        address = data.get('address')

        cursor.execute(f"INSERT INTO Locations (name, address) VALUES ({placeholder}, {placeholder})", (name, address))
        connection.commit()

        return jsonify({'message': 'Location added successfully', 'id': cursor.lastrowid}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error adding location. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/locations/<int:location_id>', methods=['PUT'])
@app.route('/locations/<int:location_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_location(location_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        query = f"UPDATE Locations SET {set_clause} WHERE id = {placeholder}"
        parameters = list(data.values())
        parameters.append(location_id)

        cursor.execute(query, tuple(parameters))

        connection.commit()
        return jsonify({'message': 'Location updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/locations/<int:location_id>', methods=['DELETE'])
@app.route('/locations/<int:location_id>', methods=['DELETE'])
@jwt_required_if_not_demo()
def delete_location(location_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        cursor.execute(f"""
            SELECT COUNT(*) as lesson_count
            FROM Lessons l
            JOIN LessonOccurrences lo ON lo.lesson_id = l.id
            LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id AND le.exception_type = 'cancel'
            WHERE l.location_id = {placeholder} AND le.id IS NULL
        """, (location_id,))
        result = cursor.fetchone()

        if result['lesson_count'] == 0:
            cursor.execute(f"""
                DELETE FROM LessonOccurrences
                WHERE id IN (
                    SELECT lo.id
                    FROM LessonOccurrences lo
                    JOIN Lessons l ON lo.lesson_id = l.id
                    WHERE l.location_id = {placeholder})""", (location_id, ))
            cursor.execute(f"DELETE FROM Lessons WHERE location_id = {placeholder}", (location_id,))
            cursor.execute(f"DELETE FROM Locations WHERE id = {placeholder}", (location_id,))
        else:
            return jsonify({'message': 'Error deleting location as they are still assigned to existing lessons or invoices. Please remove associated lessons/invoices first.'}), 400

        connection.commit()
        return jsonify({'message': 'Location deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error deleting location. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/subjects', methods=['GET'])
@app.route('/subjects', methods=['GET'])
@jwt_required_if_not_demo()
def get_all_subjects():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        query = "SELECT * FROM Subjects"

        cursor.execute(query)
        results = cursor.fetchall()

        # if no rows, get column headers
        columns = [
            {'name': desc[0], 'data_type': 'number' if desc[1] == 3 else 'string'}
            for desc in cursor.description if desc[0] != 'id'
        ]

        if not results:
            return jsonify({'columns': columns, 'records': []}), 200

        for result in results:
            result['key'] = result['id']

        return jsonify({'columns': columns, 'records': results}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/subjects', methods=['POST'])
@app.route('/subjects', methods=['POST'])
@jwt_required_if_not_demo()
def add_subject():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        name = data.get('name')
        description = data.get('description')

        cursor.execute(f"INSERT INTO Subjects (name, description) VALUES ({placeholder}, {placeholder})", (name, description))
        connection.commit()

        return jsonify({'message': 'Subject added successfully', 'id': cursor.lastrowid}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': "Error adding subject. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/subjects/<int:subject_id>', methods=['PUT'])
@app.route('/subjects/<int:subject_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_subject(subject_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        query = f"UPDATE Subjects SET {set_clause} WHERE id = {placeholder}"
        parameters = list(data.values())
        parameters.append(subject_id)

        cursor.execute(query, tuple(parameters))

        connection.commit()
        return jsonify({'message': 'Subject updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/subjects/<int:subject_id>', methods=['DELETE'])
@app.route('/subjects/<int:subject_id>', methods=['DELETE'])
@jwt_required_if_not_demo()
def delete_subject(subject_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        cursor.execute(f"""
            SELECT COUNT(*) as lesson_count
            FROM Lessons l
            JOIN LessonOccurrences lo ON lo.lesson_id = l.id
            LEFT JOIN LessonExceptions le ON le.lesson_occurrence_id = lo.id AND le.exception_type = 'cancel'
            WHERE l.subject_id = {placeholder} AND le.id IS NULL
        """, (subject_id,))
        result = cursor.fetchone()

        if result['lesson_count'] == 0:
            cursor.execute(f"""
                DELETE FROM LessonOccurrences
                WHERE id IN (
                    SELECT lo.id
                    FROM LessonOccurrences lo
                    JOIN Lessons l ON lo.lesson_id = l.id
                    WHERE l.subject_id = {placeholder})""", (subject_id, ))
            cursor.execute(f"DELETE FROM Lessons WHERE subject_id = {placeholder}", (subject_id,))
            cursor.execute(f"DELETE FROM Subjects WHERE id = {placeholder}", (subject_id,))
        else:
            return jsonify({'message': 'Error deleting subject as they are still assigned to existing lessons or invoices. Please remove associated lessons/invoices first.'}), 400

        connection.commit()
        return jsonify({'message': 'Subject deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error deleting location. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/users', methods=['POST'])
@app.route('/users', methods=['POST'])
def add_user():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        role = data.get('role')
        role_id = data.get('role_id')
        name = data.get('name')

        if not email or not password:
            return jsonify({'message': 'Email and password are required'}), 400

        cursor.execute(f'SELECT * FROM Users WHERE email = {placeholder}', (email,))
        user = cursor.fetchone()
        if user:
            return jsonify({'message': 'User with this email already exists'}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

        cursor.execute(f'INSERT INTO Users (email, password_hash, role, role_id, name) VALUES ({placeholder}, {placeholder}, {placeholder}, {placeholder}, {placeholder})',
                       (email, hashed_password.decode('utf-8'), role, role_id, name))
        connection.commit()

        return jsonify({'message': 'Account created successfully. Please contact Educatch to activate your account.'}), 200
    except Exception as e:
        return jsonify({'error': str(e), 'message': 'Error creating account. Please try again later'}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/users', methods=['GET'])
@app.route('/users', methods=['GET'])
@jwt_required_if_not_demo()
def get_users():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    try:
        cursor.execute("SELECT * FROM Users")
        results = cursor.fetchall()

        for result in results:
            result['key'] = result['id']

        return results, 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/users/<int:user_id>', methods=['PUT'])
@app.route('/users/<int:user_id>', methods=['PUT'])
@jwt_required_if_not_demo()
def update_user(user_id):
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json

        set_clause = ", ".join(f"{field} = {placeholder}" for field in data.keys())
        query = f"UPDATE Users SET {set_clause} WHERE id = {placeholder}"
        parameters = list(data.values())
        parameters.append(user_id)

        cursor.execute(query, tuple(parameters))

        connection.commit()
        return jsonify({'message': 'User updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/refresh', methods=['POST'])
@app.route('/refresh', methods=['POST'])
@jwt_required_if_not_demo(refresh=True)
def refresh_token():
    current_user = get_jwt_identity()
    access_token = create_access_token(identity=current_user)
    return jsonify({
        'access_token': access_token
    }), 200


@app.route('/demo/login', methods=['POST'])
@app.route('/login', methods=['POST'])
def login():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'message': 'Email and password are required'}), 400

        cursor.execute(f'SELECT password_hash, id, role, role_id FROM Users WHERE email = {placeholder}', (email,))
        user = cursor.fetchone()

        if user:
            password_valid = bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8'))

            if password_valid:
                if user.get('role'):
                    access_token = create_access_token(identity=email) # generate JWT token
                    refresh_token = create_refresh_token(identity=email) # generate JWT refresh token
                    return jsonify({
                        'message': 'Successfully logged in',
                        'data': {
                            'id': user['id'],
                            'role': user['role'],
                            'role_id': user['role_id'],
                            'access_token': access_token,
                            'refresh_token': refresh_token
                        }
                    }), 200
                else:
                    return jsonify({'message': 'User not activated. Please contact Educatch to activate your account'}), 401
            else:
                return jsonify({'message': 'Invalid email or password'}), 401
        else:
            return jsonify({'message': 'Invalid email or password'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()
        connection.close()

@app.route('/demo/roles', methods=['GET'])
@app.route('/roles', methods=['GET'])
@jwt_required_if_not_demo()
def get_roles():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    try:
        cursor.execute("""
            SELECT id as value, name as label
            FROM Tutors
            """)
        tutors = cursor.fetchall()

        cursor.execute("""
            SELECT id as value, name as label
            FROM Students
            """)
        students = cursor.fetchall()

        results_formatted = [
            {'value': 'admin', 'label': 'Admin'},
            {'value': 'tutor', 'label': 'Tutor', 'children': tutors},
            {'value': 'student', 'label': 'Student', 'children': students}
        ]

        return results_formatted, 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/attendance-codes', methods=['GET'])
@app.route('/attendance-codes', methods=['GET'])
@jwt_required_if_not_demo()
def get_attendance_codes():
    return jsonify(get_attendance_code_text(get_map=True)), 200


@app.route('/demo/report-pdf', methods=['POST'])
@app.route('/report-pdf', methods=['POST'])
@jwt_required_if_not_demo()
def report_pdf():
    try:
        data = request.json
        invoice_id = data.get('invoice_id')
        student_id = data.get('student_id')
        timezone = request.headers.get('X-Timezone')

        response = get_invoice_student_report(invoice_id, student_id, timezone)
        report_data = response[0]
        formatted_report_data = {
            "StudentName": report_data['student_name'],
            "TutorName": report_data['tutor_name'],
            "CurrentDate": date.today().strftime("%d/%m/%Y")
        }
        total_hours = sum(
            (lesson['end_time'] - lesson['start_time']).total_seconds() / 3600
            for lesson in  report_data["content"]
        )
        total_hours = int(total_hours) if total_hours.is_integer() else round(total_hours, 1)
        formatted_report_data["TotalHours"] = total_hours

        formatted_report_data["Lessons"] = [
            {
                "DateTime": lesson["lesson_time_short"],
                "AttendanceStatus": lesson["attendance_status_complete"]
            }
            for lesson in report_data["content"]
        ]

        risk_notification_times = [
            lesson.get("lesson_time_short")
            for lesson in report_data.get("content", [])
            if lesson.get("safeguarding_concern") == 1
        ]
        formatted_report_data["RiskNotification"] = "No"
        if len(risk_notification_times) > 0:
            formatted_report_data["RiskNotification"] = f"Yes - {len(risk_notification_times)} reports\n\n{', '.join(risk_notification_times)}"
        formatted_report_data["AbsenceNotification"] = ", ".join(
            f'{answer["answer_text"]} on {lesson.get("lesson_time_short")}'
            for lesson in report_data["content"]
                for answer in lesson.get("content", [])
                    if answer.get("id") == 7)

        for key, qid in [
            ("Curriculum", 1),
            ("Aims", 2),
            ("Overview", 3),
            ("Planning", 4),
            ("Feedback", 5)
        ]:
            formatted_report_data[key] = [
                {
                    "Date": lesson["lesson_time_short"],
                    "Details": item["answer_text"]
                }
                for lesson in report_data["content"]
                for item in lesson.get("content", [])
                if item.get("id") == qid
                   and item.get("answer_text")
                   and item["answer_text"].strip().lower() != ""
            ]
        report_data_file = io.BytesIO(json.dumps(formatted_report_data).encode("utf-8"))

        report_data_file.name = "layout.json"

        files = {
            "DlexPath": (None, 'educatch-report.dlex'),
            "LayoutData":  ("layout.json", report_data_file, "application/json")
        }

        headers = {
            "Authorization": f"Bearer {DPDF_API_KEY}",
        }

        response = requests.post("https://api.dpdf.io/v1.0/dlex-layout", headers=headers, files=files)

        if response.status_code == 200:
            output_path = "report.pdf"
            with open(output_path, "wb") as f:
                f.write(response.content)
            return send_file(output_path, as_attachment=True)
        else:
            return jsonify({"error": response.text, "message": "Error downloading report. Please try again later."}), 500
    except Exception as e:
        return jsonify({"error": str(e), "message": "Error downloading report. Please try again later."}), 500


@app.route('/demo/invoice-pdf', methods=['POST'])
@app.route('/invoice-pdf', methods=['POST'])
@jwt_required_if_not_demo()
def invoice_pdf():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        data = request.json
        invoice_id = data.get('invoice_id')
        timezone = request.headers.get('X-Timezone')

        # get all lesson occurrences (accounting for lesson exceptions) belonging to the invoice id
        cursor.execute(f"""
                SELECT
                    lo.id,
                    COALESCE (le.exception_start_time, lo.start_time) as start_time,
                    COALESCE(le.exception_end_time, lo.end_time) as end_time,
                    COALESCE(le.exception_student_id, l.student_id) as student_id,
                    COALESCE(st_e.name, st.name) as student_name
                FROM LessonOccurrences lo
                JOIN Lessons l ON lo.lesson_id = l.id
                JOIN Students st ON l.student_id = st.id
                LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
                LEFT JOIN Invoices i ON COALESCE(le.exception_invoice_id, lo.invoice_id) = i.id
                WHERE i.id = {placeholder}
                AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                ORDER BY COALESCE(le.exception_start_time, lo.start_time)
                """, (invoice_id,))

        lessons = cursor.fetchall()

        cursor.execute(f"""
                    SELECT
                        t.rate,
                        t.name,
                        t.account_number,
                        t.sort_code
                    FROM Tutors t
                    JOIN Lessons l ON l.tutor_id = t.id
                    LEFT JOIN (
                        SELECT lo.id, lo.lesson_id, lo.invoice_id
                        FROM LessonOccurrences lo
                        WHERE lo.invoice_id = {placeholder}
                        LIMIT 1
                    ) lo ON lo.lesson_id = l.id
                    LEFT JOIN (
                        SELECT le.lesson_occurrence_id, le.exception_invoice_id
                        FROM LessonExceptions le
                        WHERE le.exception_invoice_id = {placeholder}
                        LIMIT 1
                    ) le ON le.lesson_occurrence_id = lo.id""", (invoice_id, invoice_id))

        payment_details = cursor.fetchone()

        structured_lessons = []
        total = 0

        for lesson in lessons:
            duration = (lesson["end_time"] - lesson["start_time"]).total_seconds() / 3600
            subtotal = round(duration * payment_details['rate'], 2)
            total += subtotal
            structured_lessons.append({
                "StudentName": lesson["student_name"],
                "Date": format_datetime_object(lesson["start_time"], timezone, format='date_short'),
                "Time": format_lesson_datetime_object(lesson['start_time'], lesson['end_time'], timezone, include_date=False),
                "Hours": round(duration, 2),
                "Rate": payment_details['rate'],
                "Subtotal": subtotal
            })

        invoice_data = {
            "TutorName": payment_details['name'],
            "AccountNumber": payment_details['account_number'],
            "SortCode": payment_details['sort_code'],
            "CurrentDate": date.today().strftime("%d/%m/%Y"),
            "InvoiceNumber":  f"INV-{str(invoice_id).zfill(5)}",
            "Total": total,
            "Lessons": structured_lessons
        }

        invoice_data_file = io.BytesIO(json.dumps(invoice_data).encode("utf-8"))

        invoice_data_file.name = "layout.json"

        files = {
            "DlexPath": (None, 'educatch-invoice.dlex'),
            "LayoutData": ("layout.json", invoice_data_file, "application/json")
        }

        headers = {
            "Authorization": f"Bearer {DPDF_API_KEY}",
        }

        response = requests.post("https://api.dpdf.io/v1.0/dlex-layout", headers=headers, files=files)

        if response.status_code == 200:
            output_path = "invoice.pdf"
            with open(output_path, "wb") as f:
                f.write(response.content)
            return send_file(output_path, as_attachment=True)
        else:
            return jsonify(
                {"error": response.text, "message": "Error downloading invoice. Please try again later."}), 500
    except Exception as e:
        return jsonify({"error": str(e), "message": "Error downloading invoice. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()


@app.route('/demo/timetable-pdf', methods=['POST'])
@app.route('/timetable-pdf', methods=['POST'])
@jwt_required_if_not_demo()
def timetable_pdf():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)
    try:
        data = request.json
        role = data.get('role')
        role_ids = data.get('role_ids')
        timezone = request.headers.get('X-Timezone')
        start_raw = data.get('start_date')
        end_raw = data.get('end_date')

        # convert to date objects (handle time-aware strings too)
        start_date = string_to_datetime(start_raw)
        end_date = string_to_datetime(end_raw)

        # align to Monday and Sunday and convert back to string
        start_date -= timedelta(days=start_date.weekday())  # Monday
        end_date += timedelta(days=(6 - end_date.weekday()))  # Sunday

        # get all lesson occurrences (accounting for lesson exceptions) for tutor/student in date range
        placeholders = ', '.join([placeholder] * len(role_ids))
        if role=='tutor': # if getting timetable for tutor
            query = f"""
                    SELECT
                        COALESCE (le.exception_start_time, lo.start_time) as start_time,
                        COALESCE(le.exception_end_time, lo.end_time) as end_time,
                        COALESCE(st_e.name, st.name) as role_name,
                        COALESCE(loc_e.name, loc.name) as location_name,
                        COALESCE(le.exception_tutor_id, l.tutor_id) AS role_id
                    FROM LessonOccurrences lo
                    JOIN Lessons l ON lo.lesson_id = l.id
                    JOIN Students st ON l.student_id = st.id
                    JOIN Locations loc ON l.location_id = loc.id
                    LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                    LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
                    LEFT JOIN Locations loc_e ON le.exception_location_id = loc_e.id
                    WHERE COALESCE(le.exception_tutor_id, l.tutor_id) IN ({placeholders})
                    AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                    AND DATE(COALESCE(le.exception_start_time, lo.start_time)) >= DATE({placeholder})
                    AND DATE(COALESCE(le.exception_end_time, lo.end_time)) <= DATE({placeholder})
                    ORDER BY COALESCE(le.exception_start_time, lo.start_time)
                    """
        else: # if getting timetable for student
            query = f"""
                    SELECT
                        COALESCE (le.exception_start_time, lo.start_time) as start_time,
                        COALESCE(le.exception_end_time, lo.end_time) as end_time,
                        COALESCE(t_e.name, t.name) as role_name,
                        COALESCE(loc_e.name, loc.name) as location_name,
                        COALESCE(le.exception_student_id, l.student_id) AS role_id
                    FROM LessonOccurrences lo
                    JOIN Lessons l ON lo.lesson_id = l.id
                    JOIN Tutors t ON l.tutor_id = t.id
                    JOIN Locations loc ON l.location_id = loc.id
                    LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                    LEFT JOIN Tutors t_e ON le.exception_tutor_id = t_e.id
                    LEFT JOIN Locations loc_e ON le.exception_location_id = loc_e.id
                    WHERE COALESCE(le.exception_student_id, l.student_id) IN ({placeholders})
                    AND (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                    AND DATE(COALESCE(le.exception_start_time, lo.start_time)) >= DATE({placeholder})
                    AND DATE(COALESCE(le.exception_end_time, lo.end_time)) <= DATE({placeholder})
                    ORDER BY COALESCE(le.exception_start_time, lo.start_time)
                    """
        cursor.execute(query, (*role_ids, start_date, end_date))
        lessons = cursor.fetchall()

        if len(lessons) == 0:
            return jsonify({
                "message": f"No classes are scheduled for the selected {role}(s) within the chosen time period."
            }), 404

        roles_data = {id: {} for id in role_ids} # dictionary with all the weeks for each tutor/student id

        for lesson in lessons:
            start = lesson["start_time"]
            week = format_datetime_object(start - timedelta(days=start.weekday()), timezone, format='date_short') # monday of that week
            weekday = start.strftime("%A")
            role_id = lesson['role_id']

            if week not in roles_data[role_id]:
                roles_data[role_id][week] = {}
            if weekday not in roles_data[role_id][week]:
                roles_data[role_id][week][weekday] = []

            roles_data[role_id][week][weekday].append({
                "Name": lesson["role_name"][:20] + ("..." if len(lesson["role_name"]) > 20 else ''),
                "Time": format_lesson_datetime_object(lesson['start_time'], lesson['end_time'], timezone, include_date=False),
                "Location": lesson["location_name"][:20] + ("..." if len(lesson["location_name"]) > 20 else ''),
            })

        timetable_data = [] # list where each item is a new timetable (each timetable may be different week and/or tutor/student)
        for role_id in role_ids:
            if role=='tutor':
                query = f"SELECT name from Tutors where id = {placeholder}"
            else:
                query = f"SELECT name from Students where id = {placeholder}"
            cursor.execute(query, (role_id,))
            name = cursor.fetchone()['name']

            for week, days in roles_data[role_id].items():
                for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
                    if day not in days:
                        days[day] = []
                timetable_data.append({
                    "Week": week,
                    "Lessons": [days],
                    "Name": name
                })

        headers = {
            "Authorization": f"Bearer {DPDF_API_KEY}",
        }

        output_files = []
        for timetable in timetable_data:
            invoice_data_file = io.BytesIO(json.dumps(timetable).encode("utf-8"))
            invoice_data_file.name = "layout.json"

            files = {
                "DlexPath": (None, 'educatch-timetable.dlex'),
                "LayoutData": ("layout.json", invoice_data_file, "application/json")
            }

            response = requests.post("https://api.dpdf.io/v1.0/dlex-layout", headers=headers, files=files)
            if response.status_code != 200:
                return jsonify({
                    "error": str(response.text),
                    "message": f"Error generating timetable(s)."
                }), 500

            filename = f"{timetable['Name']}'s Timetable - {timetable['Week'].replace('/', '.')}.pdf"
            output_files.append((filename, response.content))

        # Send single PDF if only one
        if len(output_files) == 1:
            name, content = output_files[0]
            return send_file(
                io.BytesIO(content),
                as_attachment=True,
                download_name=name,
                mimetype="application/pdf"
            )

        # Otherwise, zip multiple files
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, "w") as zipf:
            for name, content in output_files:
                zipf.writestr(name, content)

        zip_buffer.seek(0)
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name="timetables.zip",
            mimetype="application/zip"
        )
    except Exception as e:
        return jsonify({"error": str(e), "message": "Error downloading timetable. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

@app.route('/demo/attendance-report-pdf', methods=['POST'])
@app.route('/attendance-report-pdf', methods=['POST'])
@jwt_required_if_not_demo()
def attendance_report_pdf():
    connection = get_db_connection()
    cursor = get_cursor(connection)
    placeholder = get_placeholder(connection)

    try:
        data = request.json
        timezone = request.headers.get('X-Timezone')
        student_id = data.get('student_id')
        student_name = data.get('student_name')
        include_incomplete_attendance = data.get('include_incomplete_attendance')
        start_raw = data.get('start_date')
        end_raw = data.get('end_date')

        # convert to date objects (handle time-aware strings too)
        start_date = string_to_datetime(start_raw)
        end_date = string_to_datetime(end_raw)

        start_date_string = format_datetime_object(start_date, timezone, format='date_tiny')
        end_date_string = format_datetime_object(end_date, timezone, format='date_tiny')

        cursor.execute(f"""
                SELECT COUNT(*) AS TotalLessons
                FROM LessonOccurrences lo
                JOIN Lessons l ON lo.lesson_id = l.id
                JOIN Students st ON l.student_id = st.id
                LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
                LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
                WHERE (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
                AND COALESCE(le.exception_student_id, l.student_id) = {placeholder}
                AND lo.start_time BETWEEN {placeholder} AND {placeholder}
        """, (student_id, start_date, end_date))
        total_lessons = cursor.fetchone()['TotalLessons']

        if request.path.startswith("/demo/"):
            duration_scheduled = "(strftime('%s', lo.end_time) - strftime('%s', lo.start_time))/60.0"
            duration_actual = "(strftime('%s', lo.actual_end_time) - strftime('%s', lo.actual_start_time))/60.0"
            duration_absent_disrupted = (
                "((CASE WHEN lo.actual_start_time > lo.start_time THEN "
                "strftime('%s', lo.actual_start_time) - strftime('%s', lo.start_time) ELSE 0 END) + "
                "(CASE WHEN lo.actual_end_time < lo.end_time THEN "
                "strftime('%s', lo.end_time) - strftime('%s', lo.actual_end_time) ELSE 0 END)) / 60.0"
            )
            cast_real = "CAST({} AS REAL)"
            cast_int = "CAST({} AS INTEGER)"
        else:  # MySQL
            duration_scheduled = "TIMESTAMPDIFF(MINUTE, lo.start_time, lo.end_time)"
            duration_actual = "TIMESTAMPDIFF(MINUTE, lo.actual_start_time, lo.actual_end_time)"
            duration_absent_disrupted = (
                "(CASE WHEN lo.actual_start_time > lo.start_time "
                "THEN TIMESTAMPDIFF(MINUTE, lo.start_time, lo.actual_start_time) ELSE 0 END + "
                "CASE WHEN lo.actual_end_time < lo.end_time "
                "THEN TIMESTAMPDIFF(MINUTE, lo.actual_end_time, lo.end_time) ELSE 0 END)"
            )
            cast_real = "CAST({} AS DOUBLE)"
            cast_int = "CAST({} AS UNSIGNED)"

        attendance_filter = "" if include_incomplete_attendance else "AND lo.attendance_status IS NOT NULL"

        query = f"""
        SELECT
            COUNT(*) AS LessonsScheduled,
            COUNT(CASE WHEN lo.attendance_status != 'absent' THEN 1 END) AS LessonsAttended,
            COUNT(CASE WHEN lo.attendance_status = 'absent' THEN 1 END) AS LessonsAbsent,
            COUNT(CASE WHEN lo.attendance_status = 'disrupted' AND lo.actual_start_time > lo.start_time THEN 1 END) AS LessonsDisruptedArrivedLate,
            COUNT(CASE WHEN lo.attendance_status = 'disrupted' AND lo.actual_end_time < lo.end_time THEN 1 END) AS LessonsDisruptedLeftEarly,
            COUNT(CASE WHEN r.safeguarding_concern = 1 THEN 1 END) AS SafeguardingConcerns,
            {cast_real.format(f'ROUND(SUM({duration_scheduled})/60.0,1)')} AS TotalHours,
            {cast_real.format(f'ROUND(SUM({duration_actual})/60.0,1)')} AS TotalHoursAttended,
            {cast_real.format(f'''
                ROUND(SUM(
                    CASE 
                        WHEN lo.attendance_status = 'absent' THEN {duration_scheduled}
                        WHEN lo.attendance_status = 'disrupted' THEN {duration_absent_disrupted}
                        ELSE 0
                    END
                )/60.0, 1)
            ''')} AS TotalHoursAbsentDisrupted,
            {cast_int.format(f'COUNT(CASE WHEN lo.attendance_status != "absent" THEN 1 END) * 100 / NULLIF(COUNT(*),1)')} AS AttendanceRate,
            {cast_int.format(f'COUNT(CASE WHEN lo.attendance_status = "disrupted" THEN 1 END) * 100 / NULLIF(COUNT(CASE WHEN lo.attendance_status != "absent" THEN 1 END),1)')} AS DisruptionRate,
            {cast_real.format(f'''
                ROUND(
                    SUM(
                        CASE WHEN lo.attendance_status = 'disrupted' THEN {duration_absent_disrupted} ELSE 0 END)
                        / NULLIF(COUNT(CASE WHEN lo.attendance_status = 'disrupted' THEN 1 END),0)
                ,1)
            ''')} AS AverageDisruptionLength,
            {cast_int.format(f'AVG({duration_scheduled})')} AS AverageScheduledLessonLength,
            {cast_int.format(f'AVG({duration_actual})')} AS AverageAttendedLessonLength,
            {cast_int.format(f'SUM({duration_actual}) * 100 / NULLIF(SUM({duration_scheduled}),1)')} AS TotalLessonHoursAttendedPercent,
            COUNT(CASE WHEN lo.attendance_code = 'L' THEN 1 END) AS ArrivedLate,
            COUNT(CASE WHEN lo.attendance_code = 'D' THEN 1 END) AS LeftEarly,
            COUNT(CASE WHEN lo.attendance_code = 'O' THEN 1 END) AS UnauthorisedAbsence,
            COUNT(CASE WHEN lo.attendance_code = 'I' THEN 1 END) AS Illness,
            COUNT(CASE WHEN lo.attendance_code = 'M' THEN 1 END) AS MedicalAppointment,
            COUNT(CASE WHEN lo.attendance_code = 'C' THEN 1 END) AS AuthorisedAbsence,
            COUNT(CASE WHEN lo.attendance_code = 'N' THEN 1 END) AS NoKnownReason,
            COUNT(CASE WHEN lo.attendance_code = 'T' THEN 1 END) AS NotOnTimetable
        FROM LessonOccurrences lo
        JOIN Lessons l ON lo.lesson_id = l.id
        JOIN Students st ON l.student_id = st.id
        JOIN Reports r ON r.lesson_occurrence_id = lo.id
        LEFT JOIN LessonExceptions le ON lo.id = le.lesson_occurrence_id
        LEFT JOIN Students st_e ON le.exception_student_id = st_e.id
        LEFT JOIN Invoices i ON COALESCE(le.exception_invoice_id, lo.invoice_id) = i.id
        WHERE (le.exception_type IS NULL OR le.exception_type <> 'CANCEL')
          {attendance_filter}
          AND COALESCE(le.exception_student_id, l.student_id) = {placeholder}
          AND lo.start_time BETWEEN {placeholder} AND {placeholder}
        """

        cursor.execute(query, (student_id, start_date, end_date))
        result = cursor.fetchone()
        result = {k: (0 if v is None else v) for k, v in result.items()}

        attendance_data = {**result, 'Name': student_name, 'Dates': f"{start_date_string} - {end_date_string}"}

        if not include_incomplete_attendance:
            attendance_data[
                'FooterMessage'] = f"This report only includes the lessons for which attendance was recorded ({result['LessonsScheduled']}). In total, there were {total_lessons} scheduled lessons during the selected time period."

        attendance_data_file = io.BytesIO(json.dumps(attendance_data).encode("utf-8"))

        attendance_data_file.name = "layout.json"

        files = {
            "DlexPath": (None, 'educatch-attendance-report.dlex'),
            "LayoutData": ("layout.json", attendance_data_file, "application/json")
        }

        headers = {
            "Authorization": f"Bearer {DPDF_API_KEY}",
        }

        response = requests.post("https://api.dpdf.io/v1.0/dlex-layout", headers=headers, files=files)

        if response.status_code == 200:
            output_path = "attendance-report.pdf"
            with open(output_path, "wb") as f:
                f.write(response.content)
            return send_file(output_path, as_attachment=True,
                             download_name=f"{student_name}'s Attendance Report - {start_date_string.replace('/', '.')} - {end_date_string.replace('/', '.')}.pdf")
        else:
            return jsonify(
                {"error": response.text, "message": "Error downloading attendance report. Please try again later."}), 500
    except Exception as e:
        return jsonify({"error": str(e), "message": "Error downloading attendance report. Please try again later."}), 500
    finally:
        if cursor:
            cursor.close()
        if connection:
            connection.close()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 5001)))
