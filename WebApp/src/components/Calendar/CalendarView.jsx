import { useState, useContext } from "react";
import PropTypes from "prop-types";
import { Calendar, Whisper, Popover } from "rsuite";
import { Spin, Dropdown, Tooltip } from "antd";
import { UserContext } from "../../UserContext";
import "./CalendarView.css";

export default function CalendarView({
  isLoading,
  isError,
  getDayLessons,
  handleOpenLesson,
  handleOpenNewLesson,
  openDeleteRecurringLessonModal,
  openDeleteLessonModal,
  selectedLesson,
  setCurrentFetchedDate,
  currentFetchedDate,
  refetchDate,
  isStudentView,
  handleOpenLessonReport,
}) {
  const { user } = useContext(UserContext);
  const { role } = user;
  const [selectedDate, setSelectedDate] = useState(new Date());

  const items = [
    {
      label: "Open lesson report",
      key: "report",
    },
    {
      label: "Edit lesson",
      key: "modify",
    },
    {
      label: "Delete lesson",
      key: "delete",
    },
  ];

  const handleDropdownItemClick = (key, lesson) => {
    if (key === "modify") handleOpenLesson(lesson.id);
    if (key === "delete") {
      lesson.recurrence_rule && !lesson.exception_id
        ? openDeleteRecurringLessonModal(lesson)
        : openDeleteLessonModal(lesson);
    }
    if (key === "report") handleOpenLessonReport(lesson.id);
  };

  const handleCalendarDateChange = (newDate) => {
    if (refetchDate && newDate > refetchDate) {
      setCurrentFetchedDate(new Date(newDate));
    }
  };

  const renderCell = (date) => {
    const dayLessons = getDayLessons(date);
    const displayDayLessons = dayLessons.filter(
      (item, index) => index < 2 || item.id === selectedLesson?.id
    ); // ensure selected lesson is always displayed
    const uniqueDisplayDayLessons = [...new Set(displayDayLessons)]; // remove duplicates if `selectedLesson` is already in the first two items:

    if (dayLessons.length) {
      const moreCount = dayLessons.length - uniqueDisplayDayLessons.length;
      const moreItem = (
        <Whisper
          key={selectedLesson?.id}
          placement="rightEnd"
          trigger="click"
          speaker={
            <Popover>
              <div
                style={{
                  maxHeight: "150px",
                  width: "80px",
                  overflowY: "auto",
                }}
              >
                {dayLessons.map((lesson, index) => (
                  <div key={index}>
                    <Tooltip
                      styles={{ fontSize: "0.7rem" }}
                      placement="right"
                      title={`${lesson.start_time_short} - ${
                        lesson.end_time_short
                      } | ${
                        role === "admin"
                          ? isStudentView
                            ? `${lesson.tutor_name} | `
                            : `${lesson.student_name} | `
                          : ""
                      } ${lesson.location_name}`}
                      color="#0A5E84"
                    >
                      <button
                        className={`calendar--lesson-button ${
                          selectedLesson?.id === lesson.id ? "" : "unselected"
                        }`}
                        style={{
                          backgroundColor:
                            selectedLesson?.id === lesson.id
                              ? role === "tutor" ||
                                (role === "admin" && isStudentView)
                                ? lesson.student_color
                                : lesson.tutor_color
                              : "transparent",
                          color:
                            selectedLesson?.id === lesson.id
                              ? "white"
                              : "black",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenLesson(lesson.id);
                        }}
                      >
                        <div
                          className="calendar--lesson-dot"
                          style={{
                            backgroundColor:
                              selectedLesson?.id === lesson.id
                                ? "white"
                                : role === "tutor" ||
                                  (role === "admin" && isStudentView)
                                ? lesson.student_color
                                : lesson.tutor_color,
                          }}
                        />

                        <div className="calendar--lesson-title">
                          {role === "tutor" ||
                          (role === "admin" && isStudentView)
                            ? lesson.student_name
                            : lesson.tutor_name}
                        </div>
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </Popover>
          }
        >
          <a
            className="calendar--more-lessons-text"
            onClick={(e) => e.stopPropagation()}
          >
            {moreCount} more
          </a>
        </Whisper>
      );

      return (
        <ul className="calendar--lessons">
          {uniqueDisplayDayLessons.map((lesson, index) => (
            <Dropdown
              key={index}
              menu={{
                onClick: (e) => handleDropdownItemClick(e.key, lesson),
                items:
                  selectedLesson?.id === lesson.id || role !== "admin"
                    ? []
                    : items,
              }}
              trigger={["contextMenu"]}
            >
              <li>
                <Tooltip
                  styles={{ fontSize: "0.7rem" }}
                  placement="right"
                  title={`${lesson.start_time_short} - ${
                    lesson.end_time_short
                  } | ${
                    role === "admin"
                      ? isStudentView
                        ? `${lesson.tutor_name} | `
                        : `${lesson.student_name} | `
                      : ""
                  } ${lesson.location_name}`}
                  color="#0A5E84"
                >
                  <button
                    className={`calendar--lesson-button ${
                      selectedLesson?.id === lesson.id ? "" : "unselected"
                    }`}
                    style={{
                      backgroundColor:
                        selectedLesson?.id === lesson.id
                          ? role === "tutor" ||
                            (role === "admin" && isStudentView)
                            ? lesson.student_color
                            : lesson.tutor_color
                          : "transparent",
                      color:
                        selectedLesson?.id === lesson.id ? "white" : "black",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenLesson(lesson.id);
                    }}
                  >
                    <div
                      className="calendar--lesson-dot"
                      style={{
                        backgroundColor:
                          selectedLesson?.id === lesson.id
                            ? "white"
                            : role === "tutor" ||
                              (role === "admin" && isStudentView)
                            ? lesson.student_color
                            : lesson.tutor_color,
                      }}
                    />
                    <div className="calendar--lesson-title">
                      {role === "tutor" || (role === "admin" && isStudentView)
                        ? lesson.student_name
                        : lesson.tutor_name}
                    </div>
                  </button>
                </Tooltip>
              </li>
            </Dropdown>
          ))}
          {moreCount ? moreItem : null}
        </ul>
      );
    }

    return null;
  };

  const calendarProps = {
    bordered: true,
    weekStart: 1,
    renderCell: renderCell,
    cellClassName: (date) =>
      date.getDay() % 2 || date.getDay() === 0 ? "bg-gray" : undefined,
    onChange: handleCalendarDateChange,
    onSelect: (date) => setSelectedDate(date),
  };

  if (isLoading) {
    return (
      <div className="calendar--loading">
        <Spin size="large" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="calendar--error">
        Error loading lessons. Please try again later.
      </div>
    );
  }

  const handleDoubleClick = (event) => {
    if (role !== "admin") return;
    const dateCell = event.target.closest(".rs-calendar-table-cell-content");
    const dateString = new Date(
      selectedDate.getTime() - selectedDate.getTimezoneOffset() * 60000
    ).toISOString();
    if (dateCell) handleOpenNewLesson({ date: dateString });
  };

  return (
    <div onDoubleClick={handleDoubleClick}>
      <Calendar
        {...calendarProps}
        defaultValue={selectedLesson?.start_time || currentFetchedDate}
      />
    </div>
  );
}

CalendarView.propTypes = {
  getDayLessons: PropTypes.func,
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  selectedLesson: PropTypes.object,
  handleOpenLesson: PropTypes.func,
  handleOpenNewLesson: PropTypes.func,
  openDeleteRecurringLessonModal: PropTypes.func,
  openDeleteLessonModal: PropTypes.func,
  setCurrentFetchedDate: PropTypes.func,
  currentFetchedDate: PropTypes.instanceOf(Date),
  refetchDate: PropTypes.instanceOf(Date),
  isStudentView: PropTypes.bool,
  handleOpenLessonReport: PropTypes.func,
};
