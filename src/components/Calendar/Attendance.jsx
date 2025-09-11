import { useState } from "react";
import PropTypes from "prop-types";
import { Select, Spin } from "antd";
import { Check, X, Watch } from "react-feather";
import useUpdateLessonOccurrence from "../../hooks/useUpdateLessonOccurrence";
import useGetAttendanceCodes from "../../hooks/useGetAttendanceCodes";
import TimePicker from "./TimePicker";
import "./Attendance.css";

export default function Attendance({
  selectedLesson: {
    id,
    start_time,
    end_time,
    actual_start_time,
    actual_end_time,
    attendance_status,
    attendance_code,
  },
  timeZoneAbbreviation,
  getDatabaseFormattedTime,
}) {
  const useUpdateLessonMutation = useUpdateLessonOccurrence();
  const { data: attendanceCodes, isLoading: attendanceCodesLoading } =
    useGetAttendanceCodes();

  const [attendance, setAttendance] = useState({
    actual_start_time,
    actual_end_time,
    attendance_status,
    attendance_code,
  });

  const currentTime = new Date();
  const buttonsDisabled = end_time > currentTime;

  const getFormattedAttendanceCodes = () => {
    if (attendanceCodesLoading) return [];
    return Object.entries(attendanceCodes).map(([key, value]) => ({
      value: key,
      label: value,
    }));
  };

  const handleUpdateLessonDetails = (updatedLessonDetails) => {
    setAttendance((prevAttendanceStatus) => ({
      ...prevAttendanceStatus,
      ...updatedLessonDetails,
    }));
    if (
      updatedLessonDetails.actual_start_time ||
      updatedLessonDetails.updated_actual_end_time
    ) {
      updatedLessonDetails.actual_start_time = getDatabaseFormattedTime(
        updatedLessonDetails.actual_start_time
      );
      updatedLessonDetails.actual_end_time = getDatabaseFormattedTime(
        updatedLessonDetails.actual_end_time
      );
    }
    useUpdateLessonMutation.mutate({
      lessonOccurrenceId: id,
      data: updatedLessonDetails,
    });
  };

  const handleSetPresent = () => {
    const updatedLessonDetails = {
      attendance_status:
        attendance.attendance_status === "present" ? null : "present",
    };
    handleUpdateLessonDetails(updatedLessonDetails);
  };

  const handleSetAbsent = () => {
    const updatedLessonDetails = {
      attendance_status:
        attendance.attendance_status === "absent" ? null : "absent",
    };
    handleUpdateLessonDetails(updatedLessonDetails);
  };

  const handleSetDisrupted = () => {
    const updatedLessonDetails = {
      attendance_status:
        attendance.attendance_status === "disrupted" ? null : "disrupted",
    };
    handleUpdateLessonDetails(updatedLessonDetails);
  };

  const handleSetActualLessonTime = (
    updated_actual_start_time,
    updated_actual_end_time
  ) => {
    const updatedLessonDetails = {
      actual_start_time: updated_actual_start_time,
      actual_end_time: updated_actual_end_time,
    };
    handleUpdateLessonDetails(updatedLessonDetails);
  };

  return (
    <div className="attendance">
      <section className="attendance--buttons">
        <button
          className={`attendance--button ${
            attendance.attendance_status === "present"
              ? "attendance--button-present"
              : ""
          }`}
          disabled={buttonsDisabled}
          onClick={handleSetPresent}
        >
          <Check />
        </button>
        <button
          className={`attendance--button ${
            attendance.attendance_status === "absent"
              ? "attendance--button-absent"
              : ""
          }`}
          disabled={buttonsDisabled}
          onClick={handleSetAbsent}
        >
          <X />
        </button>

        <button
          className={`attendance--button ${
            attendance.attendance_status === "disrupted"
              ? "attendance--button-disrupted"
              : ""
          }`}
          disabled={buttonsDisabled}
          onClick={handleSetDisrupted}
        >
          <Watch />
        </button>
      </section>
      {attendance.attendance_status === "disrupted" && (
        <section className="attendance--time-picker">
          <div>
            <h5 className="attendance--header">Actual lesson time</h5>
            <TimePicker
              start_time={start_time}
              end_time={end_time}
              actual_start_time={attendance.actual_start_time || start_time}
              actual_end_time={attendance.actual_end_time || end_time}
              handleSetActualLessonTime={handleSetActualLessonTime}
              timeZoneAbbreviation={timeZoneAbbreviation}
            />
          </div>
        </section>
      )}
      {(attendance.attendance_status === "absent" ||
        attendance.attendance_status === "disrupted") && (
        <div>
          <h5 className="attendance--header">Absence type</h5>
          <Select
            className="attendance--select"
            loading={attendanceCodesLoading && <Spin size="small" />}
            placeholder={
              attendanceCodesLoading ? "Loading..." : "Select absence type"
            }
            value={attendance.attendance_code}
            onChange={(value) => {
              const updatedLessonDetails = {
                attendance_code: value,
              };
              handleUpdateLessonDetails(updatedLessonDetails);
            }}
            options={getFormattedAttendanceCodes()}
          />
        </div>
      )}
    </div>
  );
}

Attendance.propTypes = {
  selectedLesson: PropTypes.object,
  getDatabaseFormattedTime: PropTypes.func,
  timeZoneAbbreviation: PropTypes.string,
};
