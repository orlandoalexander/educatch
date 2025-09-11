import PropTypes from "prop-types";
import { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { UserContext } from "../../UserContext";
import { message, Button, Modal } from "antd";
import CalendarView from "./CalendarView";
import Lesson from "./Lesson";
import EditableLesson from "./EditableLesson";
import ReportModal from "../Reports/ReportModal";
import useGetLessons from "../../hooks/useGetLessons";
import useGetLessonReport from "../../hooks/useGetLessonReport";
import useAddLessonException from "../../hooks/useAddLessonException";
import useUpdateLesson from "../../hooks/useUpdateLesson";
import "./index.css";

const verifyMatchesFilter = (lesson, selectedFilters) => {
  const { students, tutors, locations, subjects } = selectedFilters;
  return (
    students.includes(lesson.student_id) &&
    tutors.includes(lesson.tutor_id) &&
    locations.includes(lesson.location_id) &&
    subjects.includes(lesson.subject_id)
  );
};

const getTimeZoneAbbreviation = (date) => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "short",
  });

  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  return tzPart?.value || "UTC";
};

const getFormattedTime = (date, time) => {
  const toJSDate = (d) =>
    typeof d?.toDate === "function" ? d.toDate() : new Date(d);

  const baseDate = toJSDate(date);
  const [start, end] = time.map(toJSDate);

  const getDateTime = (base, target) =>
    new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      target.getHours(),
      target.getMinutes()
    );

  return {
    start_time: getDatabaseFormattedTime(getDateTime(baseDate, start)),
    end_time: getDatabaseFormattedTime(getDateTime(baseDate, end)),
  };
};

const getDatabaseFormattedTime = (date, useUTC = true) => {
  const get = useUTC
    ? {
        year: date.getUTCFullYear(),
        month: String(date.getUTCMonth() + 1).padStart(2, "0"),
        day: String(date.getUTCDate()).padStart(2, "0"),
        hours: String(date.getUTCHours()).padStart(2, "0"),
        minutes: String(date.getUTCMinutes()).padStart(2, "0"),
        seconds: String(date.getUTCSeconds()).padStart(2, "0"),
      }
    : {
        year: date.getFullYear(),
        month: String(date.getMonth() + 1).padStart(2, "0"),
        day: String(date.getDate()).padStart(2, "0"),
        hours: String(date.getHours()).padStart(2, "0"),
        minutes: String(date.getMinutes()).padStart(2, "0"),
        seconds: String(date.getSeconds()).padStart(2, "0"),
      };

  return `${get.year}-${get.month}-${get.day} ${get.hours}:${get.minutes}:${get.seconds}`;
};

export default function Calendar({
  handleOpenNewLesson,
  selectedFilters,
  isStudentView,
}) {
  const { user } = useContext(UserContext);
  const { role } = user;
  const { lessonOccurrenceId, initialDate } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedLesson, setSelectedLesson] = useState(null);
  const [currentFetchedDate, setCurrentFetchedDate] = useState(new Date());
  const [refetchDate, setRefetchDate] = useState(null);
  const [reportOpen, setReportOpen] = useState(
    location.pathname.includes("/report")
  );

  const [newLessonOpen, setNewLessonOpen] = useState(
    location.pathname.includes("/new")
  );
  const [formattedLessons, setFormattedLessons] = useState({});
  const [useDefaultValue, setUseDefaultValue] = useState(
    lessonOccurrenceId ? true : false
  ); // if lessonOccurrenceId is set, use default value to ensure calendar view shows displayed lesson date

  const {
    data: lessonsData,
    isLoading: lessonsLoading,
    isError: lessonsError,
  } = useGetLessons({ currentFetchedDate, setRefetchDate });

  const {
    data: reportData,
    isError: reportDataError,
    isFetching: reportDataFetching,
  } = useGetLessonReport(selectedLesson?.id);

  const addLessonException = useAddLessonException();
  const updateLesson = useUpdateLesson();

  // reusable modals to delete single or recurring lessons (whether accessed from within lesson view or calendar view)
  const deleteLessonModalConfig = (lesson) => ({
    title: "Delete lesson",
    content: "Are you sure you want to delete this lesson?",
    okText: "Yes, delete",
    onOk: () => handleCancelLessonOccurrence(lesson.id),
    footer: (_, { OkBtn, CancelBtn }) => (
      <>
        <CancelBtn />
        <OkBtn />
      </>
    ),
  });

  const openDeleteLessonModal = (lesson) => {
    Modal.confirm(deleteLessonModalConfig(lesson));
  };

  const deleteRecurringLessonModalConfig = (lesson) => ({
    width: 700,
    title: "You are deleting a recurring lesson",
    content:
      "Do you want to delete this lesson and all future occurrences of this lesson, or only the current lesson occurrence?",
    okText: "Delete all future lesson occurrences",
    cancelText: "Dismiss",
    onOk: () => {
      handleModifyLesson({
        lessonId: lesson.lesson_id,
        headerData: {
          update_type: "DELETE",
          recurrence_rule: lesson.recurrence_rule,
          lesson_occurrence_id: lesson.id,
        },
      });
    },
    footer: (_, { OkBtn, CancelBtn }) => (
      <>
        <CancelBtn />
        <Button
          onClick={() => {
            handleCancelLessonOccurrence(lesson?.id);
            deleteRecurringLessonModal.destroy(); // This line will close the modal
          }}
        >
          Delete only this lesson
        </Button>
        <OkBtn />
      </>
    ),
  });

  let deleteRecurringLessonModal;
  const openDeleteRecurringLessonModal = (lesson) => {
    deleteRecurringLessonModal = Modal.confirm(
      deleteRecurringLessonModalConfig(lesson)
    );
  };

  const getDayLessons = (date) => {
    const dateString = new Date(
      date.getTime() - date.getTimezoneOffset() * 60000 // convert to local timezone before converting to string
    )
      .toISOString()
      .split("T")[0];
    return formattedLessons[dateString] || [];
  };

  const handleOpenLesson = (lessonOccurrenceId) => {
    if (selectedLesson?.id === lessonOccurrenceId) {
      navigate("/timetable");
    } else navigate(`/timetable/${lessonOccurrenceId.toString()}`);
  };

  const handleCloseLesson = () => {
    navigate("/timetable");
  };

  const handleOpenLessonReport = (lessonId) => {
    navigate(`/timetable/${lessonId}/report`);
  };

  const handleOpenReport = () => {
    navigate("report");
  };

  const handleCloseReport = () => {
    navigate(`/timetable/${lessonOccurrenceId}`);
  };

  const handleCancelLessonOccurrence = (lessonOccurrenceId) => {
    addLessonException.mutate({
      lesson_occurrence_id: lessonOccurrenceId,
      exception_type: "CANCEL",
    });
    navigate("/timetable");
  };

  const handleModifyLessonOccurrence = ({
    lessonOccurrenceId,
    data,
    modifiedFields,
  }) => {
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([key]) => modifiedFields.includes(key))
    );
    addLessonException.mutate({
      lesson_occurrence_id: lessonOccurrenceId,
      exception_type: "MODIFY",
      ...filteredData,
    });
    navigate("/timetable");
  };

  const handleModifyLesson = ({
    lessonId,
    headerData,
    contentData,
    modifiedFields,
  }) => {
    const filteredData = contentData
      ? Object.fromEntries(
          Object.entries(contentData).filter(([key]) =>
            modifiedFields.includes(key)
          )
        )
      : {};
    updateLesson.mutate({
      lessonId: lessonId,
      data: { ...headerData, ...filteredData },
    });
    navigate("/timetable");
  };

  useEffect(() => {
    if (location.pathname.includes("/report")) setReportOpen(true);
    else setReportOpen(false);
    if (location.pathname.includes("/new")) {
      setNewLessonOpen(true);
      setSelectedLesson(null);
    } else setNewLessonOpen(false);
  }, [location.pathname, reportData]);

  useEffect(() => {
    if (lessonsData) {
      const lessonMap = {};
      const filteredLessons = lessonsData.filter((lesson) =>
        verifyMatchesFilter(lesson, selectedFilters)
      );

      filteredLessons.forEach((lesson) => {
        const date = lesson.start_time.toISOString().split("T")[0];
        if (!lessonMap[date]) {
          lessonMap[date] = [];
        }
        lessonMap[date].push(lesson);
      });
      setFormattedLessons(lessonMap);

      if (lessonOccurrenceId) {
        // if lessonOccurrenceId param is set
        const currentLesson = lessonsData.find(
          (lesson) => lesson.id === parseInt(lessonOccurrenceId)
        );
        if (currentLesson)
          setSelectedLesson((prevData) => ({ ...prevData, ...currentLesson }));
        // if lesson exists, set selected lesson
        else {
          // otherwise, navigate to timetable page and show message
          navigate("/timetable");
          message.error("Error loading lesson. Please try again later.");
        }
      } else setSelectedLesson(null);
      setUseDefaultValue(false);
    }
  }, [lessonsData, lessonOccurrenceId, navigate, selectedFilters]);

  return (
    <div className="calendar">
      <section className="calendar--calendar-view">
        <CalendarView
          isLoading={
            lessonsLoading || (useDefaultValue && !selectedLesson?.start_time) // if default value is required, show loading spinner until lesson data is loaded
          }
          isError={lessonsError}
          getDayLessons={getDayLessons}
          handleOpenLesson={handleOpenLesson}
          handleOpenNewLesson={handleOpenNewLesson}
          openDeleteRecurringLessonModal={openDeleteRecurringLessonModal}
          openDeleteLessonModal={openDeleteLessonModal}
          selectedLesson={selectedLesson}
          setCurrentFetchedDate={setCurrentFetchedDate}
          currentFetchedDate={currentFetchedDate}
          refetchDate={refetchDate}
          isStudentView={isStudentView}
          handleOpenLessonReport={handleOpenLessonReport}
        />
      </section>
      {newLessonOpen && (
        <section className="calendar--lesson">
          <EditableLesson
            handleCloseLesson={handleCloseLesson}
            initialDate={initialDate}
            getTimeZoneAbbreviation={getTimeZoneAbbreviation}
            getFormattedTime={getFormattedTime}
            getDatabaseFormattedTime={getDatabaseFormattedTime}
          />
        </section>
      )}
      {selectedLesson && role === "admin" && (
        <section className="calendar--lesson">
          <EditableLesson
            key={selectedLesson.id} // key is required to re-render component when selectedLesson changes
            handleCloseLesson={handleCloseLesson}
            setSelectedLesson={setSelectedLesson}
            selectedLesson={selectedLesson}
            openDeleteRecurringLessonModal={openDeleteRecurringLessonModal}
            openDeleteLessonModal={openDeleteLessonModal}
            handleModifyLesson={handleModifyLesson}
            handleModifyLessonOccurrence={handleModifyLessonOccurrence}
            handleOpenReport={handleOpenReport}
            getTimeZoneAbbreviation={getTimeZoneAbbreviation}
            getFormattedTime={getFormattedTime}
            getDatabaseFormattedTime={getDatabaseFormattedTime}
          />
        </section>
      )}

      {selectedLesson && role !== "admin" && (
        <section className="calendar--lesson">
          <Lesson
            key={selectedLesson.id}
            setSelectedLesson={setSelectedLesson}
            selectedLesson={selectedLesson}
            handleCloseLesson={handleCloseLesson}
            handleOpenReport={handleOpenReport}
            role={role}
            getTimeZoneAbbreviation={getTimeZoneAbbreviation}
            getDatabaseFormattedTime={getDatabaseFormattedTime}
          />
        </section>
      )}

      <ReportModal
        open={reportOpen}
        onClose={handleCloseReport}
        data={reportData}
        role={role}
        lessonOccurrenceId={selectedLesson?.id}
        isFetching={reportDataFetching}
        isError={reportDataError}
      />
    </div>
  );
}

Calendar.propTypes = {
  handleOpenNewLesson: PropTypes.func,
  selectedFilters: PropTypes.object,
  isStudentView: PropTypes.bool,
};
