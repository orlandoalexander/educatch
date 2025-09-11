import { useQuery } from "react-query";
import api from "./api";

const useGetLessonClash = ({
  lessonOccurrenceId,
  tutorId,
  studentId,
  startTime,
  endTime,
}) => {
  const getLessonClash = async () => {
    if (!startTime || !endTime) return;

    const response = await api.get(`/lessons/clash`, {
      params: {
        lesson_occurrence_id: lessonOccurrenceId,
        tutor_id: tutorId,
        student_id: studentId,
        start_time: startTime,
        end_time: endTime,
      },
    });
    return response.data;
  };
  return useQuery(
    ["lesson--clash", tutorId, studentId, startTime, endTime],
    getLessonClash
  );
};

export default useGetLessonClash;
