import { useQuery } from "react-query";
import api from "./api";

const useGetLessonReport = (lessonOccurrenceId) => {
  const getLessonReport = async () => {
    if (!lessonOccurrenceId) return;
    const response = await api.get(`/lessons/${lessonOccurrenceId}/report`);

    return response.data;
  };

  return useQuery(["lesson--report", lessonOccurrenceId], getLessonReport, {
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    cacheTime: 1000 * 60 * 10,
  });
};

export default useGetLessonReport;
