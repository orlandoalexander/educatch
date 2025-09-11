import { useContext } from "react";
import { UserContext } from "../UserContext";
import { useMutation, useQueryClient } from "react-query";
import { message } from "antd";
import api from "./api";

const updateLesson = async ({ lessonId, data }) => {
  const hide = message.loading(
    `${data.update_type === "MODIFY" ? "Updating" : "Deleting"} lesson...`,
    0
  );
  try {
    const response = await api.put(`/lessons/${lessonId}`, data);
    return { success: response.data, data, hide };
  } catch (error) {
    hide(); // hide loading if error
    throw error;
  }
};

const useUpdateLesson = () => {
  const { user } = useContext(UserContext);
  const { id } = user;
  const queryClient = useQueryClient();

  return useMutation(updateLesson, {
    onSuccess: ({ success, data, hide }) => {
      hide();
      queryClient.invalidateQueries([
        "lesson--report",
        data.lesson_occurrence_id,
      ]);
      queryClient.invalidateQueries(["lessons", id]);
      queryClient.invalidateQueries(["reports", id]);
      message.success(success.message);
    },
    onError: (error) => {
      message.error(
        error.response.data.message ||
          "An error was encountered. Please try again later."
      );
    },
  });
};

export default useUpdateLesson;
