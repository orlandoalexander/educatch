import { useContext } from "react";
import { UserContext } from "../UserContext";
import { useMutation, useQueryClient } from "react-query";
import { message } from "antd";
import api from "./api";

const updateLessonOccurrence = async ({ lessonOccurrenceId, data }) => {
  let hide;
  // Show loading message only when certain fields are not present
  if (
    ![
      "attendance_status",
      "attendance_code",
      "actual_start_time",
      "actual_end_time",
    ].some((key) => key in data)
  ) {
    hide = message.loading("Updating lesson...", 0); // Persist loading message
  }
  try {
    const response = await api.put(
      `/lesson_occurrences/${lessonOccurrenceId}`,
      data
    );
    return response.data;
  } finally {
    if (hide) hide();
  }
};

const useUpdateLessonOccurrence = () => {
  const { user } = useContext(UserContext);
  const { id } = user;
  const queryClient = useQueryClient();

  return useMutation(updateLessonOccurrence, {
    onSuccess: (success, data) => {
      queryClient.invalidateQueries(["lessons", id]);
      queryClient.invalidateQueries(["reports", id]);
      queryClient.invalidateQueries([
        "lesson--report",
        data.lessonOccurrenceId,
      ]);

      if (
        ![
          "attendance_status",
          "attendance_code",
          "actual_start_time",
          "actual_end_time",
        ].some((key) => key in data.data)
      ) {
        message.success(success.message);
      }
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useUpdateLessonOccurrence;
