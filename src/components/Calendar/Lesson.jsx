import PropTypes from "prop-types";
import { Divider, Button } from "antd";
import { Calendar, Clock, BookOpen, MapPin, X, User } from "react-feather";
import "./Lesson.css";
import Attendance from "./Attendance";

export default function Lesson({
  selectedLesson,
  handleCloseLesson,
  handleOpenReport,
  role,
  getDatabaseFormattedTime,
  getTimeZoneAbbreviation,
}) {
  return (
    <div className="lesson">
      <header className="lesson--header">
        <h3 className="lesson--header-title">{selectedLesson?.title}</h3>
        <div className="lesson--header-actions">
          <button onClick={handleCloseLesson}>
            <X strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <section className="lesson--details">
        <div>
          <User size={21} color="gray" />
          {role === "tutor"
            ? selectedLesson?.student_name
            : selectedLesson?.tutor_name}
        </div>
        <div>
          <BookOpen size={21} color="gray" />
          <p> {selectedLesson?.subject_name}</p>
        </div>
        <div>
          <Calendar size={21} color="gray" />
          {selectedLesson?.date}
        </div>
        <div>
          <Clock size={21} color="gray" />
          <p>
            {selectedLesson?.start_time_short} -{" "}
            {selectedLesson?.end_time_short}
            <span>
              {`(${getTimeZoneAbbreviation(
                new Date(getDatabaseFormattedTime(selectedLesson.start_time))
              )})`}
            </span>
          </p>
        </div>
        <div>
          <MapPin size={21} color="gray" />
          <p>
            {selectedLesson?.location_name}
            {selectedLesson?.address ? (
              <span>({selectedLesson?.address})</span>
            ) : null}
          </p>
        </div>
      </section>
      {role === "tutor" && (
        <>
          <Divider style={{ margin: "5px" }} />
          <Attendance
            selectedLesson={selectedLesson}
            getDatabaseFormattedTime={getDatabaseFormattedTime}
            timeZoneAbbreviation={getTimeZoneAbbreviation(
              new Date(getDatabaseFormattedTime(selectedLesson.start_time))
            )}
          />
          <Button
            className="lesson--report-button"
            type="primary"
            size="large"
            onClick={handleOpenReport}
          >
            Open lesson report
          </Button>
        </>
      )}
    </div>
  );
}

Lesson.propTypes = {
  selectedLesson: PropTypes.object,
  handleCloseLesson: PropTypes.func,
  handleOpenReport: PropTypes.func,
  role: PropTypes.string,
  getDatabaseFormattedTime: PropTypes.func,
  getTimeZoneAbbreviation: PropTypes.func,
};
